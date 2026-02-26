import PDFDocument from "pdfkit";

type PDFDoc = InstanceType<typeof PDFDocument>;
import packageJson from "@/package.json";

const PAGE_HEIGHT = 842; // A4
const PAGE_WIDTH = 595;

/** Adds the app footer (matching AppFooter) to the bottom of a PDF document */
export function addPdfFooter(
  doc: PDFDoc,
  margin: number = 40
): void {
  const contentWidth = PAGE_WIDTH - 2 * margin;

  // Ensure space for footer (~55pt)
  if (doc.y > PAGE_HEIGHT - margin - 55) {
    doc.addPage({ size: "A4", margin });
  }

  doc.moveDown(2);
  doc.moveTo(margin, doc.y).lineTo(PAGE_WIDTH - margin, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(9).font("Helvetica");
  doc.text("Created by readX™", margin, doc.y, {
    width: contentWidth,
    align: "center",
  });
  doc.moveDown(0.3);

  doc.fontSize(8).fillColor("#6b7280"); // gray-500
  doc.text(`All rights Reserved · v${packageJson.version}`, margin, doc.y, {
    width: contentWidth,
    align: "center",
  });
  doc.fillColor("#000000"); // reset
}
