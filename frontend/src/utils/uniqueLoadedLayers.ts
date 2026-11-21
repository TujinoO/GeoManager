import type {
  LoadedLayer,
  LoadedLayerGroup,
  LoadedVectorLayer,
} from "../types";

interface ResourceLayerIdentity {
  layerType: "vector" | "raster";
  sourceResource: { id: number };
  query?: LoadedVectorLayer["query"];
}

export function resourceLayerKey(layer: ResourceLayerIdentity): string {
  const query = layer.layerType === "vector" ? layer.query : undefined;
  if (!query || (!query.attributeFilters?.length && !query.spatialFilter)) {
    return `resource:${layer.sourceResource.id}`;
  }
  // A spatial/attribute query is a derived result, not another copy of its
  // complete source. Keep different results and collapse identical queries.
  const filterKeys = (query.attributeFilters ?? []).map(
    ({ field, operator, value, valueTo }) =>
      stableJson({
        field,
        operator,
        value,
        ...(operator === "between" ? { valueTo } : {}),
      }),
  );
  return `query:${layer.sourceResource.id}:${stableJson({
    spatialFilter: query.spatialFilter ?? null,
    attributeFilters: [...new Set(filterKeys)].sort(),
  })}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function findLoadedResourceLayer(
  groups: LoadedLayerGroup[],
  key: string,
) {
  for (const group of groups) {
    const layer = group.children.find(
      (candidate) => resourceLayerKey(candidate) === key,
    );
    if (layer) return { group, layer };
  }
  return null;
}

// Restore/cache dedup also includes appearance: intentional styled variants survive.
export function restoredLayerKey(layer: LoadedLayer): string {
  return `${layer.layerType}:${resourceLayerKey(layer)}:${stableJson(layer.symbolization)}`;
}

export function uniqueLoadedLayerGroups(
  groups: LoadedLayerGroup[],
  seen = new Set<string>(),
): LoadedLayerGroup[] {
  let changed = false;
  const next: LoadedLayerGroup[] = [];
  for (const group of groups) {
    const children = group.children.filter((layer) => {
      const key = restoredLayerKey(layer);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (children.length === group.children.length) {
      next.push(group);
    } else {
      changed = true;
      if (children.length || group.isManual) next.push({ ...group, children });
    }
  }
  return changed ? next : groups;
}

// Apply a successful attribute query as a single visibility change. Keep source
// and other derived/styled layers available in the tree for manual comparison.
export function showAttributeQueryLayer(
  groups: LoadedLayerGroup[],
  result: LoadedLayerGroup,
): LoadedLayerGroup[] {
  const resultLayer = result.children[0];
  if (resultLayer?.layerType !== "vector") return groups;
  const resultKey = restoredLayerKey(resultLayer);
  return [
    result,
    ...groups.flatMap((group) => {
      const children = group.children.flatMap((layer) => {
        if (
          layer.layerType !== "vector" ||
          layer.sourceResource.id !== resultLayer.sourceResource.id
        )
          return [layer];
        if (restoredLayerKey(layer) === resultKey) return [];
        return [layer.visible ? { ...layer, visible: false } : layer];
      });
      return children.length || group.isManual ? [{ ...group, children }] : [];
    }),
  ];
}
