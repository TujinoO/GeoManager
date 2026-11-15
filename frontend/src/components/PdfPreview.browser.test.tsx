import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { StrictMode } from "react";
import PdfPreview from "./PdfPreview";

import { twoPagePdf } from "../test/pdfFixture";

async function expectPageColor(canvas: HTMLCanvasElement, channel: number) {
  await waitFor(
    () => {
      const pixel = canvas
        .getContext("2d")!
        .getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      expect(pixel[channel]).toBeGreaterThan(
        pixel[channel === 0 ? 1 : 0]! + 50,
      );
    },
    { timeout: 10000 },
  );
}

it("renders actual PDF pages without a browser plugin and keeps mobile pagination usable", async () => {
  await page.viewport(390, 844);
  const url = URL.createObjectURL(twoPagePdf());
  const view = render(<PdfPreview src={url} title="生态分析报告" />);
  try {
    await screen.findByText("第 1 / 2 页", {}, { timeout: 10000 });
    const canvas = (await screen.findByRole("img", {
      name: "生态分析报告 第1页",
    })) as HTMLCanvasElement;
    await waitFor(
      () => {
        expect(canvas.width).toBeGreaterThan(300);
        const pixel = canvas
          .getContext("2d")!
          .getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
        expect(pixel[1]).toBeGreaterThan(pixel[0]! + 50);
      },
      { timeout: 10000 },
    );
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(await screen.findByText("第 2 / 2 页")).toBeVisible();
    await expectPageColor(canvas, 0);
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  } finally {
    view.unmount();
    URL.revokeObjectURL(url);
  }
});

it("previews image reports in low resolution, switches clarity and survives rapid navigation and resizing", async () => {
  await page.viewport(1100, 900);
  const url = URL.createObjectURL(twoPagePdf(true));
  const view = render(
    <StrictMode>
      <PdfPreview src={url} title="图片报告" />
    </StrictMode>,
  );
  try {
    await screen.findByText("第 1 / 2 页", {}, { timeout: 10000 });
    const canvas = (await screen.findByRole("img", {
      name: "图片报告 第1页",
    })) as HTMLCanvasElement;
    await expectPageColor(canvas, 1);
    expect(
      screen.getByRole("radio", { name: "快速预览（低清）" }),
    ).toBeChecked();
    const fastWidth = canvas.width;
    expect(fastWidth).toBeLessThanOrEqual(480);
    fireEvent.click(screen.getByRole("radio", { name: "清晰预览" }));
    await waitFor(() => expect(canvas.width).toBeGreaterThan(fastWidth));
    await expectPageColor(canvas, 1);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "下一页" }));
      fireEvent.click(screen.getByRole("button", { name: "上一页" }));
    }
    await page.viewport(390, 844);
    fireEvent.click(screen.getByRole("radio", { name: "快速预览（低清）" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await expectPageColor(canvas, 0);
    expect(canvas.width).toBeLessThanOrEqual(390);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  } finally {
    view.unmount();
    URL.revokeObjectURL(url);
  }
});

it("allows retrying a failed report request without reopening the drawer", async () => {
  const src = new URL("/pdf-preview-retry.pdf", location.href).href;
  const originalFetch = window.fetch;
  let requests = 0;
  const fetch = vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== src) return originalFetch(input, init);
    requests++;
    return Promise.resolve(
      requests === 1
        ? new Response("Unavailable", { status: 503 })
        : new Response(twoPagePdf(true), {
            headers: { "Content-Type": "application/pdf" },
          }),
    );
  });
  const view = render(<PdfPreview src={src} title="重试报告" />);
  try {
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PDF预览读取失败",
    );
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    await screen.findByText("第 1 / 2 页", {}, { timeout: 10000 });
    await expectPageColor(
      (await screen.findByRole("img", {
        name: "重试报告 第1页",
      })) as HTMLCanvasElement,
      1,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(requests).toBe(2);
  } finally {
    view.unmount();
    fetch.mockRestore();
  }
});
