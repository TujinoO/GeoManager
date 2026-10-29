import { describe, expect, it } from "vitest";
import {
  localizedPlatformName,
  platformBrand,
  resolvePlatformName,
} from "./platformBrand";

describe("platform brand normalization", () => {
  it.each([
    "干旱区胡杨林生态智慧监测平台",
    "全球胡杨林生态系统保护数据共享平台",
    "中亚胡杨林生态系统保护数据共享平台",
    "中亚胡杨林生态保护数据共享平台",
    "中亚胡杨林生态数据共享平台",
    "中亚胡杨生态系统保护数据共享平台",
    "中亚胡杨生态数据门户",
  ])("upgrades the legacy platform name %s", (legacyName) => {
    expect(resolvePlatformName(legacyName)).toBe(platformBrand.chineseName);
  });

  it("preserves a custom deployment name", () => {
    expect(resolvePlatformName("科研数据测试平台")).toBe("科研数据测试平台");
  });

  it("localizes the restored brand and preserves custom deployment names", () => {
    expect(localizedPlatformName("干旱区胡杨林生态智慧监测平台", "en-US")).toBe(
      platformBrand.englishName,
    );
    expect(localizedPlatformName("科研数据测试平台", "en-US")).toBe(
      "科研数据测试平台",
    );
  });
});
