import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { defaultCompositionLayout } from "../../map-composition/layout";
import { applyPaperPreset } from "../../map-composition/layoutPaper";
import CompositionCanvas from "./CompositionCanvas";

function Harness() {
  const [layout, setLayout] = useState(() =>
    defaultCompositionLayout("地图标题", [80, 30, 90, 40]),
  );
  return (
    <div style={{ width: 1000 }}>
      <CompositionCanvas
        layout={layout}
        previewUrl=""
        onChange={setLayout}
        onUndo={() => {}}
        onRedo={() => {}}
        canUndo={false}
        canRedo={false}
      />
      <output data-testid="layout">{JSON.stringify(layout)}</output>
    </div>
  );
}
describe("paper interaction", () => {
  afterEach(async () => {
    await page.viewport(1600, 900);
  });

  it("keeps fit responsive, preserves manual zoom during refresh, and restores the full page", async () => {
    const onChange = vi.fn();
    let layout = defaultCompositionLayout("地图标题", [80, 30, 90, 40]);
    const canvas = (previewUrl = "") => (
      <StrictMode>
        <div style={{ width: "90vw", height: "80vh", display: "flex" }}>
          <CompositionCanvas
            layout={layout}
            previewUrl={previewUrl}
            onChange={onChange}
            onUndo={() => {}}
            onRedo={() => {}}
            canUndo={false}
            canRedo={false}
          />
        </div>
      </StrictMode>
    );
    const view = render(canvas());
    const viewport = document.querySelector<HTMLElement>(
      ".composition-canvas-scroll",
    )!;
    const paper = document.querySelector<HTMLElement>(
      ".composition-editable-paper",
    )!;
    const expectFit = async () =>
      waitFor(() => {
        expect(paper.clientWidth).toBeGreaterThan(80);
        expect(viewport.scrollWidth).toBeLessThanOrEqual(
          viewport.clientWidth + 1,
        );
        expect(viewport.scrollHeight).toBeLessThanOrEqual(
          viewport.clientHeight + 1,
        );
      });
    await expectFit();
    const originalWidth = paper.clientWidth;
    await page.viewport(900, 600);
    await expectFit();
    expect(paper.clientWidth).toBeLessThan(originalWidth);
    layout = applyPaperPreset(layout, "A3", "portrait");
    view.rerender(canvas());
    await expectFit();
    expect(paper.clientWidth / paper.clientHeight).toBeCloseTo(297 / 420, 2);
    const chooseZoom = async (label: string) => {
      fireEvent.mouseDown(screen.getByRole("combobox", { name: "画布缩放" }));
      fireEvent.click(
        await screen.findByText(label, {
          selector: ".ant-select-item-option-content",
        }),
      );
    };
    await chooseZoom("150%");
    await waitFor(() =>
      expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth),
    );
    const manualWidth = paper.clientWidth;
    viewport.scrollTo({ left: 150, top: 200 });
    view.rerender(
      canvas(
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='297' height='420'/%3E",
      ),
    );
    await screen.findByRole("img", { name: "专题图预览" });
    expect(paper.clientWidth).toBe(manualWidth);
    await chooseZoom("适应画布");
    await expectFit();
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("commits a drag once, supports keyboard movement, and locks the element", async () => {
    const capture = vi
      .spyOn(HTMLElement.prototype, "setPointerCapture")
      .mockImplementation(() => {});
    render(<Harness />);
    const title = screen.getByRole("button", { name: "制图要素：标题" });
    const read = () => JSON.parse(screen.getByTestId("layout").textContent!);
    const before = read().title.xMm;
    fireEvent.pointerDown(title, {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(title, { pointerId: 1, clientX: 160, clientY: 120 });
    expect(read().title.xMm).toBe(before);
    fireEvent.pointerUp(title, { pointerId: 1 });
    expect(read().title.xMm).toBeGreaterThan(before);
    const moved = read().title.xMm;
    fireEvent.keyDown(title, { key: "ArrowLeft" });
    expect(read().title.xMm).toBe(moved - 1);
    fireEvent.click(screen.getByRole("button", { name: /锁\s*定/ }));
    fireEvent.keyDown(title, { key: "ArrowLeft" });
    expect(read().title.xMm).toBe(moved - 1);
    capture.mockRestore();
  });
  it("adds editable text and persists its layer order", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "添加文字" }));
    fireEvent.change(screen.getByLabelText("选中要素文字"), {
      target: { value: "区域概况" },
    });
    fireEvent.click(screen.getByRole("button", { name: /置\s*底/ }));
    const layout = JSON.parse(screen.getByTestId("layout").textContent!);
    expect(layout.extraTexts[0].text).toBe("区域概况");
    expect(layout.editor.order[0]).toBe(layout.extraTexts[0].id);
  });
});
