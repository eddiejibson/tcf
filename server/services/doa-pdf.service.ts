import type { jsPDF as JsPdfInstance } from "jspdf";

const DARK: [number, number, number] = [26, 31, 38];
const GRAY: [number, number, number] = [120, 130, 145];
const BORDER: [number, number, number] = [225, 228, 235];
const WHITE: [number, number, number] = [255, 255, 255];
const DANGER: [number, number, number] = [239, 68, 68];

export type DoaPdfGroup = {
  items: { name: string; quantity: number }[];
  images: { buffer: Buffer; key: string }[];
};

function detectImageFormat(buffer: Buffer): "JPEG" | "PNG" | "WEBP" {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "JPEG";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "PNG";
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
    return "WEBP";
  return "JPEG";
}

export async function generateDoaReportPdfBuffer(groups: DoaPdfGroup[]): Promise<Buffer> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pw = 210;
  const ph = 297;
  const m = 15;
  const cw = pw - m * 2;

  let firstPage = true;

  for (const group of groups) {
    if (group.items.length === 0) continue;

    if (group.images.length === 0) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      const headerBottom = drawGroupHeader(doc, pw, m, cw, group);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(12);
      doc.setTextColor(...GRAY);
      doc.text("(No photos submitted)", pw / 2, headerBottom + (ph - headerBottom) / 2, { align: "center" });
      continue;
    }

    for (let imgIdx = 0; imgIdx < group.images.length; imgIdx++) {
      if (!firstPage) doc.addPage();
      firstPage = false;

      const headerBottom = drawGroupHeader(doc, pw, m, cw, group);

      const img = group.images[imgIdx];
      const format = detectImageFormat(img.buffer);
      const dataUrl = `data:image/${format.toLowerCase()};base64,${img.buffer.toString("base64")}`;

      try {
        const imgProps = doc.getImageProperties(dataUrl);
        const aspect = imgProps.width / imgProps.height;

        const bottomPadding = 15;
        const maxW = cw;
        const maxH = ph - headerBottom - bottomPadding;

        let w: number;
        let h: number;
        if (aspect > maxW / maxH) {
          w = maxW;
          h = w / aspect;
        } else {
          h = maxH;
          w = h * aspect;
        }

        const x = (pw - w) / 2;
        const y = headerBottom + (maxH - h) / 2;

        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.roundedRect(x - 1, y - 1, w + 2, h + 2, 1, 1, "S");

        doc.addImage(dataUrl, format, x, y, w, h, undefined, "FAST");
      } catch {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(12);
        doc.setTextColor(...GRAY);
        doc.text("(Image could not be rendered)", pw / 2, headerBottom + 20, { align: "center" });
      }
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function drawGroupHeader(
  doc: JsPdfInstance,
  pw: number,
  m: number,
  cw: number,
  group: DoaPdfGroup
): number {
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(group.items.length === 1 ? "DOA item" : `DOA — ${group.items.length} items`, m, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  for (const item of group.items) {
    const qtyText = `QTY ${item.quantity}`;
    const qtyPadX = 4;
    const qtyW = doc.getTextWidth(qtyText) + qtyPadX * 2;
    const qtyH = 6;

    let displayName = item.name;
    const maxNameW = cw - qtyW - 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    if (doc.getTextWidth(displayName) > maxNameW) {
      while (doc.getTextWidth(displayName + "...") > maxNameW && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += "...";
    }
    doc.setTextColor(...DARK);
    doc.text(displayName, m, y + 4);

    const qtyX = pw - m - qtyW;
    const qtyY = y - 0.5;
    doc.setFillColor(...DANGER);
    doc.roundedRect(qtyX, qtyY, qtyW, qtyH, 1.5, 1.5, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(qtyText, qtyX + qtyW / 2, qtyY + qtyH / 2 + 1.2, { align: "center" });

    y += 7;
  }

  y += 2;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(m, y, pw - m, y);

  return y + 4;
}
