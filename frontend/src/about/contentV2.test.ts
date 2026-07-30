import { describe, expect, it } from "vitest";

import { institutionById } from "./contentV2";

describe("新疆生地所团队资料", () => {
  const institution = institutionById("xieg-cas");

  it("使用最新确认的八人名录并移除旧成员", () => {
    const names = institution?.members.map((member) => member.name) ?? [];

    expect(names).toEqual([
      "张久丹",
      "刘嘉伟",
      "李若楠",
      "汤珊珊",
      "邓蕊",
      "张甜",
      "范景超",
      "闫杨豪",
    ]);
    expect(names).not.toContain("刘铁");
    expect(names).not.toContain("包安明");
  });

  it("为最新名录中的每位成员提供证件照", () => {
    expect(institution?.members.every((member) => member.portrait)).toBe(true);
  });
});
