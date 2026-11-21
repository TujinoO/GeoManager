import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import {
  cloneDefaultRasterSymbolization,
  cloneDefaultVectorSymbolization,
  type RasterSymbolization,
  type VectorSymbolization,
} from "../symbolization";
import { appTheme } from "../theme";
import {
  RasterSymbolizationEditor,
  VectorSymbolizationEditor,
} from "./SymbolizationEditor";
import "../styles.css";

afterEach(() => vi.restoreAllMocks());

it("requires a fresh unique-value palette when changing the classification band", async () => {
  const onApply = vi.fn();
  let finishClassification: (result: {
    band: number;
    items: [{ value: number; label: string; color: string }];
  }) => void = () => {};
  const classify = vi
    .spyOn(api, "classifyRasterUniqueValues")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishClassification = resolve;
        }),
    )
    .mockResolvedValueOnce({
      band: 2,
      items: [{ value: 19, label: "B2 匹配值", color: "#59a678" }],
    });
  render(
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntApp>
        <RasterEditorHarness onApply={onApply} datasetId={24} />
      </AntApp>
    </ConfigProvider>,
  );

  fireEvent.click(screen.getByRole("radio", { name: "唯一值" }));
  const apply = screen.getByRole("button", { name: "确定" });
  expect(apply).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /^分\s*类$/ }));
  expect(classify).toHaveBeenCalledWith(24, 1, {
    signal: expect.any(AbortSignal),
  });
  expect(apply).toBeDisabled();
  finishClassification({
    band: 1,
    items: [{ value: 43, label: "B1 匹配值", color: "#a05a31" }],
  });
  await waitFor(() => expect(apply).toBeEnabled());
  expect(screen.getByText("B1 匹配值")).toBeVisible();

  fireEvent.mouseDown(screen.getByRole("combobox", { name: "分类波段" }));
  fireEvent.click(await screen.findByText("2 · Band 2"));
  expect(screen.queryByText("B1 匹配值")).not.toBeInTheDocument();
  expect(apply).toBeDisabled();
  const classifyButton = await screen.findByRole("button", {
    name: /分\s*类$/,
  });
  await waitFor(() =>
    expect(classifyButton).not.toHaveClass("ant-btn-loading"),
  );
  fireEvent.click(classifyButton);
  expect(classify).toHaveBeenLastCalledWith(24, 2, {
    signal: expect.any(AbortSignal),
  });
  await waitFor(() => expect(apply).toBeEnabled());
  fireEvent.click(apply);
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: "unique",
      bands: [2],
      uniqueValues: [{ value: 19, label: "B2 匹配值", color: "#59a678" }],
    }),
  );
});

describe("symbolization JSON reuse", () => {
  it("keeps raster import instructions and JSON text readable", async () => {
    render(
      <ConfigProvider locale={zhCN} theme={appTheme}>
        <AntApp>
          <RasterEditorHarness onApply={vi.fn()} />
        </AntApp>
      </ConfigProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "导入 JSON" }));

    const instruction = await screen.findByText(
      "粘贴由“复制 JSON”生成的完整方案",
    );
    const modalTitle = screen.getByText("导入栅格符号化方案");
    const jsonInput = screen.getByRole("textbox", {
      name: "符号化方案 JSON",
    });
    expect(getComputedStyle(modalTitle).color).toBe("rgb(17, 59, 54)");
    expect(getComputedStyle(instruction).color).toBe("rgb(244, 255, 251)");
    expect(getComputedStyle(jsonInput).color).toBe("rgb(17, 59, 54)");
    expect(getComputedStyle(jsonInput).backgroundColor).toBe(
      "rgb(247, 251, 250)",
    );
  });

  it("imports pasted raster JSON into the editor before applying it", async () => {
    const onApply = vi.fn();
    render(
      <ConfigProvider locale={zhCN} theme={appTheme}>
        <AntApp>
          <RasterEditorHarness onApply={onApply} />
        </AntApp>
      </ConfigProvider>,
    );

    expect(
      screen.getByRole("button", { name: "复制 JSON" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导入 JSON" }));

    const imported = cloneDefaultRasterSymbolization();
    imported.opacity = 63;
    fireEvent.change(
      await screen.findByRole("textbox", { name: "符号化方案 JSON" }),
      { target: { value: JSON.stringify(imported) } },
    );
    fireEvent.click(screen.getByRole("button", { name: "校验并导入" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "符号化方案 JSON" }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ opacity: 63 }),
    );
  });

  it("keeps an incompatible scheme in the dialog and explains the problem", async () => {
    render(
      <ConfigProvider locale={zhCN} theme={appTheme}>
        <AntApp>
          <RasterEditorHarness onApply={vi.fn()} />
        </AntApp>
      </ConfigProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "导入 JSON" }));
    const imported = cloneDefaultRasterSymbolization();
    imported.bands = [3];
    fireEvent.change(
      await screen.findByRole("textbox", { name: "符号化方案 JSON" }),
      { target: { value: JSON.stringify(imported) } },
    );
    fireEvent.click(screen.getByRole("button", { name: "校验并导入" }));

    expect(
      await screen.findByText("目标栅格缺少方案引用的波段：3"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "符号化方案 JSON" }),
    ).toBeInTheDocument();
  });

  it("offers the same copy, import, and apply chain for vector schemes", async () => {
    const onApply = vi.fn();
    render(
      <ConfigProvider locale={zhCN} theme={appTheme}>
        <AntApp>
          <VectorEditorHarness onApply={onApply} />
        </AntApp>
      </ConfigProvider>,
    );

    expect(
      screen.getByRole("button", { name: "复制 JSON" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导入 JSON" }));
    const imported = cloneDefaultVectorSymbolization();
    imported.opacity = 58;
    fireEvent.change(
      await screen.findByRole("textbox", { name: "符号化方案 JSON" }),
      { target: { value: JSON.stringify(imported) } },
    );
    fireEvent.click(screen.getByRole("button", { name: "校验并导入" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "符号化方案 JSON" }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ opacity: 58 }),
    );
  });
});

function RasterEditorHarness({
  onApply,
  datasetId,
}: {
  onApply: (value: RasterSymbolization) => void;
  datasetId?: number;
}) {
  const [value, setValue] = useState(cloneDefaultRasterSymbolization());
  return (
    <RasterSymbolizationEditor
      value={value}
      datasetId={datasetId}
      bands={[
        {
          band: 1,
          type: "Byte",
          description: "Band 1",
          colorInterpretation: "Gray",
          min: 0,
          max: 255,
          isInteger: true,
        },
        {
          band: 2,
          type: "Byte",
          description: "Band 2",
          colorInterpretation: "Gray",
          min: 0,
          max: 255,
          isInteger: true,
        },
      ]}
      onChange={setValue}
      onApply={() => onApply(value)}
    />
  );
}

function VectorEditorHarness({
  onApply,
}: {
  onApply: (value: VectorSymbolization) => void;
}) {
  const [value, setValue] = useState(cloneDefaultVectorSymbolization());
  return (
    <VectorSymbolizationEditor
      value={value}
      fields={[
        {
          name: "name",
          type: "String",
          nullable: false,
          sampleValues: ["胡杨"],
          description: "名称",
        },
      ]}
      geometryType="Point"
      onChange={setValue}
      onApply={() => onApply(value)}
    />
  );
}
