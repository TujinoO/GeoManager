import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { StrictMode } from "react";
import { twoPagePdf } from "../test/pdfFixture";
import PdfThumbnail from "./PdfThumbnail";

it("defers offscreen reports and shows a real low-resolution first-page image when scrolled into view", async () => {
  await page.viewport(390, 844);
  const url = new URL("/lazy-thumbnail.pdf", location.href).href;
  const originalFetch = window.fetch;
  let requests = 0;
  const fetch = vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const requested = input instanceof Request ? input.url : String(input);
    if (requested !== url) return originalFetch(input, init);
    requests++;
    return Promise.resolve(
      new Response(twoPagePdf(true), {
        headers: { "Content-Type": "application/pdf" },
      }),
    );
  });
  const view = render(
    <StrictMode>
      <div style={{ marginTop: 2200, width: 360, height: 200 }}>
        <PdfThumbnail src={url} title="报告卡片预览" />
      </div>
    </StrictMode>,
  );
  try {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    expect(requests).toBe(0);
    view.container.scrollIntoView();
    const image = (await screen.findByRole(
      "img",
      { name: "报告卡片预览" },
      { timeout: 10000 },
    )) as HTMLImageElement;
    await image.decode();
    expect(image.naturalWidth).toBe(480);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    canvas
      .getContext("2d")!
      .drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    const pixel = canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data;
    expect(pixel[1]).toBeGreaterThan(pixel[0]! + 50);
    expect(
      screen.queryByRole("button", { name: "下一页" }),
    ).not.toBeInTheDocument();
    expect(requests).toBe(1);
    expect(screen.getByText("PDF · 首页预览")).toBeVisible();
  } finally {
    view.unmount();
    fetch.mockRestore();
    window.scrollTo(0, 0);
  }
});

it("offers a retry when a card preview request fails", async () => {
  const src = new URL("/thumbnail-retry.pdf", location.href).href;
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
  const view = render(
    <div style={{ width: 360, height: 200 }}>
      <PdfThumbnail src={src} title="重试卡片" />
    </div>,
  );
  try {
    fireEvent.click(await screen.findByRole("button", { name: "重新预览" }));
    const image = (await screen.findByRole(
      "img",
      { name: "重试卡片" },
      { timeout: 10000 },
    )) as HTMLImageElement;
    await image.decode();
    await waitFor(() => expect(image.naturalWidth).toBe(480));
    expect(requests).toBe(2);
  } finally {
    view.unmount();
    fetch.mockRestore();
  }
});
