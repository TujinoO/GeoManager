import type {
  AnalysisReportDocument,
  AnalysisReportFigure,
} from "../../api/generated/types.gen";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图表读取失败，请重新生成预览"));
    img.src = src;
  });
}

async function pngFromSvg(svg: SVGElement) {
  const copy = svg.cloneNode(true) as SVGElement;
  const box = svg.getBoundingClientRect();
  // The opening modal scales its children during the transition. Its screen
  // bounding box must not replace the SVG's internal coordinate system.
  const viewBox = svg.getAttribute("viewBox")?.split(/[ ,]+/).map(Number);
  const width = Math.max(
    1,
    Number(svg.getAttribute("width")) || viewBox?.[2] || Math.round(box.width),
  );
  const height = Math.max(
    1,
    Number(svg.getAttribute("height")) ||
      viewBox?.[3] ||
      Math.round(box.height),
  );
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  if (!viewBox) copy.setAttribute("viewBox", `0 0 ${width} ${height}`);
  copy.style.position = "static";
  copy.style.width = `${width}px`;
  copy.style.height = `${height}px`;
  copy.style.transform = "none";
  copy.style.maxWidth = "none";
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  try {
    const img = await loadImage(url);
    const scale = Math.min(3, 3200 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function captureReportFigures(
  scope: HTMLElement | null,
): Promise<AnalysisReportFigure[]> {
  if (!scope) throw new Error("图表尚未就绪，请等待数据加载完成");
  await document.fonts.ready;
  const plots = [
    ...scope.querySelectorAll<HTMLElement>(
      ".analysis-chart-viewport > [role='img']",
    ),
  ];
  const deadline = Date.now() + 5000;
  while (plots.some((plot) => plot.dataset.analysisReady !== "true")) {
    if (Date.now() > deadline)
      throw new Error("部分图表尚未绘制完成，请关闭报告后稍后重试");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
  // ECharts signals finished before the SVG renderer has flushed its DOM update.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  const cards = [
    ...scope.querySelectorAll<HTMLElement>(
      ".analysis-chart-card, .analysis-genome-circle",
    ),
  ];
  const figures: AnalysisReportFigure[] = [];
  for (const [index, card] of cards.entries()) {
    // Card headings contain SVG action icons. Only capture the plotting surface.
    const svg = card.matches("svg.analysis-genome-circle")
      ? (card as unknown as SVGElement)
      : card.querySelector<SVGElement>(".analysis-chart-viewport svg");
    if (!svg || !svg.getBoundingClientRect().width) continue;
    const title =
      (card.matches("svg") ? card.closest("section") : card)?.querySelector(
        "h3",
      )?.textContent ?? "基因组图谱";
    if (figures.some((f) => f.title === title)) continue;
    figures.push({
      id: `figure-${index}`,
      title,
      caption: card.querySelector("p")?.textContent ?? "",
      imageData: await pngFromSvg(svg),
      included: true,
    });
  }
  return figures;
}

export function wrapReportText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of paragraph) {
      if (line && ctx.measureText(line + char).width > maxWidth) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}

/** A4 at 240 dpi. Text wraps across pages, and figures retain their aspect ratio. */
export async function renderReportPages(
  doc: AnalysisReportDocument,
): Promise<Blob[]> {
  await document.fonts.ready;
  const width = 1984,
    height = 2806,
    margin = 132,
    content = width - margin * 2,
    bottom = height - 145;
  const canvases: HTMLCanvasElement[] = [];
  let ctx!: CanvasRenderingContext2D;
  let y = 0;
  const font = (size: number, bold = false) =>
    `${bold ? "600 " : ""}${size}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
  function page() {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvases.push(canvas);
    ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#185e50";
    ctx.fillRect(margin, 90, content, 5);
    ctx.font = font(24);
    ctx.fillText("胡杨生态保护数据分析", margin, 70);
    y = 160;
    if (canvases.length > 20) throw new Error("报告超过20页，请减少图表或文字");
  }
  function text(value: string, size = 33, bold = false, color = "#28463f") {
    ctx.font = font(size, bold);
    const lines = wrapReportText(ctx, value, content);
    for (const line of lines) {
      if (y + size * 1.6 > bottom) {
        page();
        ctx.font = font(size, bold);
      }
      ctx.fillStyle = color;
      ctx.fillText(line, margin, y);
      y += size * 1.65;
    }
    y += 20;
  }
  page();
  text(doc.title, 54, true);
  text(doc.source || "来源见原始数据资料", 26, false, "#61766e");
  text("分析概述", 40, true);
  doc.paragraphs.filter((p) => p.trim()).forEach((p) => text(p));
  let index = 0;
  for (const figure of doc.figures.filter((f) => f.included)) {
    const image = await loadImage(figure.imageData);
    const targetHeight = Math.min((content * image.height) / image.width, 1420);
    ctx.font = font(38, true);
    const titleHeight =
      wrapReportText(ctx, `图${index + 1}  ${figure.title}`, content).length *
        38 *
        1.65 +
      20;
    if (y + titleHeight + targetHeight + 34 > bottom) page();
    text(`图${++index}  ${figure.title}`, 38, true);
    const drawWidth = Math.min(
      content,
      (targetHeight * image.width) / image.height,
    );
    ctx.drawImage(
      image,
      margin + (content - drawWidth) / 2,
      y,
      drawWidth,
      targetHeight,
    );
    y += targetHeight + 34;
    if (figure.caption.trim()) text(figure.caption, 29, false, "#506c62");
  }
  const pages: Blob[] = [];
  for (const [i, canvas] of canvases.entries()) {
    const footer = canvas.getContext("2d")!;
    footer.fillStyle = "#71877e";
    footer.font = font(25);
    footer.fillText(
      `${i + 1} / ${canvases.length}`,
      width - margin - 100,
      height - 65,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("无法生成报告页面"))),
        "image/png",
      ),
    );
    pages.push(blob);
  }
  return pages;
}
