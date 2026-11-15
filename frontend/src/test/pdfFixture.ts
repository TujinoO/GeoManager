export function twoPagePdf(withImage = false) {
  const drawing = "0.1 0.6 0.4 rg 20 20 150 200 re f\n";
  const secondDrawing = "0.8 0.2 0.1 rg 20 20 150 200 re f\n";
  const image = document.createElement("canvas");
  image.width = 800;
  image.height = 1200;
  const context = image.getContext("2d")!;
  context.fillStyle = "#199966";
  context.fillRect(0, 0, image.width, image.height);
  const jpeg = atob(image.toDataURL("image/jpeg").split(",")[1]!);
  const firstDrawing = withImage ? "q 200 0 0 300 0 0 cm /Im0 Do Q\n" : drawing;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R /Resources << /XObject << /Im0 7 0 R >> >> >>",
    `<< /Length ${firstDrawing.length} >>\nstream\n${firstDrawing}endstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 6 0 R /Resources << >> >>",
    `<< /Length ${secondDrawing.length} >>\nstream\n${secondDrawing}endstream`,
    `<< /Type /XObject /Subtype /Image /Width 800 /Height 1200 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n${jpeg}\nendstream`,
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
  return new Blob([Uint8Array.from(pdf, (char) => char.charCodeAt(0))], {
    type: "application/pdf",
  });
}
