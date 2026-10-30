import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
import PdfPreview from "./PdfPreview";

function twoPagePdf() {
  const drawing = "0.1 0.6 0.4 rg 20 20 150 200 re f\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R /Resources << >> >>",
    `<< /Length ${drawing.length} >>\nstream\n${drawing}endstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R /Resources << >> >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

it("renders actual PDF pages without a browser plugin and keeps mobile pagination usable", async () => {
  await page.viewport(390, 844);
  const url = URL.createObjectURL(twoPagePdf());
  const view = render(<PdfPreview src={url} title="生态分析报告" />);
  try {
    await screen.findByText("第 1 / 2 页", {}, { timeout: 10000 });
    const canvas = screen.getByRole("img", {
      name: "生态分析报告 第1页",
    }) as HTMLCanvasElement;
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
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  } finally {
    view.unmount();
    URL.revokeObjectURL(url);
  }
});
