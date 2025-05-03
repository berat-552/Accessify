import PDFDocument from "pdfkit";
import fs from "fs";

export function saveResultsAsPdf(results, url, outputPath = "report.pdf") {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(outputPath));

  // Header
  doc.fontSize(16).text("Accessibility Report", { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`URL: ${url}`);
  doc.moveDown();

  if (results.length === 0) {
    doc.fillColor("green").text("✅ No accessibility violations found.");
  } else {
    doc.fillColor("red").text(`Found ${results.length} issues:`).moveDown();

    results.forEach((issue, i) => {
      const impact = issue.impact || "unknown";
      const impactColor =
        impact === "critical"
          ? "red"
          : impact === "serious"
          ? "#FFA500" // dark orange
          : impact === "moderate"
          ? "blue"
          : impact === "minor"
          ? "gray"
          : "black";

      // Title
      doc
        .fillColor("black")
        .font("Helvetica-Bold")
        .text(`${i + 1}. ${issue.description}`, {
          continued: false,
        });

      doc.fillColor(impactColor).font("Helvetica-Oblique").text(`Impact: ${impact}`);

      // Help + Tags
      doc
        .fillColor("black")
        .font("Helvetica")
        .text(`Help: ${issue.help}`)
        .moveDown(0.3)
        .text(`Tags: ${issue.tags.join(", ")}`);

      doc.moveDown(1.5);
    });
  }

  doc.end();
  console.log(`📄 PDF report saved to ${outputPath}`);
}
