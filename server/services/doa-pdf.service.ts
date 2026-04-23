import type { jsPDF as JsPdfInstance } from "jspdf";

const DARK: [number, number, number] = [26, 31, 38];
const GRAY: [number, number, number] = [120, 130, 145];
const BORDER: [number, number, number] = [225, 228, 235];
const WHITE: [number, number, number] = [255, 255, 255];
const DANGER: [number, number, number] = [239, 68, 68];

export type DoaPdfItem = {
  itemName: string;
  quantity: number;
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

export async function generateDoaReportPdfBuffer(items: DoaPdfItem[]): Promise<Buffer> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pw = 210;
  const ph = 297;
  const m = 15;
  const cw = pw - m * 2;

  let firstPage = true;

  for (const item of items) {
    if (item.images.length === 0) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      drawItemHeader(doc, pw, m, cw, item);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(12);
      doc.setTextColor(...GRAY);
      doc.text("(No photos submitted)", pw / 2, ph / 2, { align: "center" });
      continue;
    }

    for (let imgIdx = 0; imgIdx < item.images.length; imgIdx++) {
      if (!firstPage) doc.addPage();
      firstPage = false;

      drawItemHeader(doc, pw, m, cw, item);

      const img = item.images[imgIdx];
      const format = detectImageFormat(img.buffer);
      const dataUrl = `data:image/${format.toLowerCase()};base64,${img.buffer.toString("base64")}`;

      try {
        const imgProps = doc.getImageProperties(dataUrl);
        const aspect = imgProps.width / imgProps.height;

        const headerBottom = 35;
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
        doc.text("(Image could not be rendered)", pw / 2, ph / 2, { align: "center" });
      }
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function drawItemHeader(
  doc: JsPdfInstance,
  pw: number,
  m: number,
  cw: number,
  item: DoaPdfItem
) {
  // Item name (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...DARK);

  const qtyText = `QTY ${item.quantity}`;
  doc.setFontSize(12);
  const qtyPadX = 6;
  const qtyW = doc.getTextWidth(qtyText) + qtyPadX * 2;

  doc.setFontSize(22);
  let displayName = item.itemName;
  const maxNameW = cw - qtyW - 8;
  if (doc.getTextWidth(displayName) > maxNameW) {
    while (doc.getTextWidth(displayName + "...") > maxNameW && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    displayName += "...";
  }
  doc.text(displayName, m, 22);

  // Quantity badge (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const qtyX = pw - m - qtyW;
  const qtyY = 14;
  const qtyH = 10;
  doc.setFillColor(...DANGER);
  doc.roundedRect(qtyX, qtyY, qtyW, qtyH, 2, 2, "F");
  doc.setTextColor(...WHITE);
  doc.text(qtyText, qtyX + qtyW / 2, qtyY + qtyH / 2 + 1.4, { align: "center" });

  // Separator
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(m, 28, pw - m, 28);
}
