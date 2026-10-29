import type { AppLocale } from "../i18n";

export const platformBrand = {
  chineseName: "全球胡杨林生态系统保护数据共享平台",
  englishName:
    "Global Populus euphratica Forest Ecosystem Conservation Data Sharing Platform",
  shortName: "GPEDSP",
  edition: "GPEDSP · WebGIS Research Edition",
} as const;

const legacyPlatformNames = new Set([
  "干旱区胡杨林生态智慧监测平台",
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

export function localizedPlatformName(
  name?: string | null,
  locale: AppLocale = "zh-CN",
) {
  const resolved = resolvePlatformName(name);
  if (locale !== "en-US") return resolved;
  return resolved === platformBrand.chineseName
    ? platformBrand.englishName
    : resolved;
}

export function applyPlatformDocumentTitle(
  name?: string | null,
  locale: AppLocale = "zh-CN",
) {
  const title = localizedPlatformName(name, locale);
  document.title = title;
  return title;
}
