import { useCallback, useState } from "react";
import type {
  LoadedLayer,
  LoadedLayerGroup,
  LoadedRasterLayer,
} from "../types";
import { reorderLayerGroups } from "../utils/geometry";

export function useLayerGroups() {
  const [groups, setGroups] = useState<LoadedLayerGroup[]>([]);

  const updateLayer = useCallback(
    (
      groupId: string,
      layerId: string,
      updater: (layer: LoadedLayer) => LoadedLayer,
    ) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                children: group.children.map((layer) =>
                  layer.id === layerId ? updater(layer) : layer,
                ),
              }
            : group,
        ),
      );
    },
    [],
  );

  const updateRasterLayer = useCallback(
    (
      groupId: string,
      layerId: string,
      updater: (layer: LoadedRasterLayer) => LoadedRasterLayer,
    ) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                children: group.children.map((layer) =>
                  layer.id === layerId && layer.layerType === "raster"
                    ? updater(layer)
                    : layer,
                ),
              }
            : group,
        ),
      );
    },
    [],
  );

  const setGroupVisibility = useCallback(
    (groupId: string, visible: boolean) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId ? { ...group, visible } : group,
        ),
      );
    },
    [],
  );

  const setGroupName = useCallback((groupId: string, name: string) => {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId ? { ...group, name } : group,
      ),
    );
  }, []);

  const setGroupSymbolization = useCallback(
    (groupId: string, symbolization: LoadedLayerGroup["symbolization"]) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId ? { ...group, symbolization } : group,
        ),
      );
    },
    [],
  );

  const setLayerVisibility = useCallback(
    (groupId: string, layerId: string, visible: boolean) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                children: group.children.map((layer) =>
                  layer.id === layerId ? { ...layer, visible } : layer,
                ),
              }
            : group,
        ),
      );
    },
    [],
  );

  const setLayerName = useCallback(
    (groupId: string, layerId: string, name: string) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                children: group.children.map((layer) =>
                  layer.id === layerId ? { ...layer, name } : layer,
                ),
              }
            : group,
        ),
      );
    },
    [],
  );

  const setLayerSymbolization = useCallback(
    (
      groupId: string,
      layerId: string,
      symbolization: LoadedLayer["symbolization"],
    ) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                children: group.children.map((layer) =>
                  layer.id === layerId
                    ? ({ ...layer, symbolization } as LoadedLayer)
                    : layer,
                ),
              }
            : group,
        ),
      );
    },
    [],
  );

  const removeGroup = useCallback((groupId: string) => {
    setGroups((current) => current.filter((group) => group.id !== groupId));
  }, []);

  const removeLayer = useCallback((groupId: string, layerId: string) => {
    setGroups((current) =>
      current
        .map((group) =>
          group.id === groupId
            ? {
                ...group,
                children: group.children.filter(
                  (layer) => layer.id !== layerId,
                ),
              }
            : group,
        )
        .filter((group) => group.children.length > 0),
    );
  }, []);

  const reorderGroups = useCallback(
    (
      sourceGroupId: string,
      targetGroupId: string,
      placement: "before" | "after",
    ) => {
      setGroups((current) =>
        reorderLayerGroups(current, sourceGroupId, targetGroupId, placement),
      );
    },
    [],
  );

  const addGroup = useCallback((group: LoadedLayerGroup) => {
    setGroups((current) => [group, ...current]);
  }, []);

  return {
    groups,
    setGroups,
    addGroup,
    updateLayer,
    updateRasterLayer,
    setGroupVisibility,
    setGroupName,
    setGroupSymbolization,
    setLayerVisibility,
    setLayerName,
    setLayerSymbolization,
    removeGroup,
    removeLayer,
    reorderGroups,
  };
}
