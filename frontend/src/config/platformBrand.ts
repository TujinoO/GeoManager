export const platformBrand = {
  chineseName: "全球胡杨林生态系统保护数据共享平台",
  englishName:
    "Global Populus euphratica Forest Ecosystem Conservation Data Sharing Platform",
  shortName: "GPEDSP",
  edition: "GPEDSP · WebGIS Research Edition",
} as const;

const legacyPlatformNames = new Set([
  "中亚胡杨林生态系统保护数据共享平台",
  "中亚胡杨林生态保护数据共享平台",
  "中亚胡杨林生态数据共享平台",
  "中亚胡杨生态系统保护数据共享平台",
  "中亚胡杨生态数据门户",
]);

export function resolvePlatformName(name?: string | null) {
  const normalized = name?.trim() ?? "";
  if (!normalized || legacyPlatformNames.has(normalized)) {
    return platformBrand.chineseName;
  }
  return normalized;
}

export function applyPlatformDocumentTitle(name?: string | null) {
  const title = resolvePlatformName(name);
  document.title = title;
  return title;
}
