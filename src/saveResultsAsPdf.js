import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export function saveResultsAsPdf(
  results,
  url,
  outputPath = "report.pdf",
  translateUsing = (k, v) => k
) {
  // Ensure reports folder exists
  const finalPath = path.join("reports", outputPath);
  fs.mkdirSync("reports", { recursive: true });

  const doc = new PDFDocument({ margin: 50 });

  // ✅ Register Unicode-capable fonts
  doc.registerFont("default", "fonts/DejaVuSans.ttf");
  doc.registerFont("bold", "fonts/DejaVuSans-Bold.ttf");
  doc.registerFont("italic", "fonts/DejaVuSans-Oblique.ttf");

  doc.pipe(fs.createWriteStream(finalPath));

  const now = new Date();
  const timestamp = now.toLocaleString();

  // Title
  doc
    .font("bold")
    .fontSize(20)
    .fillColor("black")
    .text(translateUsing("pdfTitle"), { align: "left" });

  doc
    .font("default")
    .fontSize(10)
    .fillColor("gray")
    .text(`${translateUsing("pdfGenerated")}: ${timestamp}`, { align: "left" })
    .text(`${translateUsing("pdfUrl")}: ${url}`)
    .moveDown(1.5);

  if (results.length === 0) {
    doc
      .font("bold")
      .fontSize(14)
      .fillColor("green")
      .text(translateUsing("pdfNoIssues"));
  } else {
    doc
      .font("bold")
      .fontSize(14)
      .fillColor("red")
      .text(translateUsing("pdfFoundIssues", { count: results.length }));
    doc.moveDown();

    results.forEach((issue, i) => {
      const impact = issue.impact || "unknown";

      const color =
        impact === "critical"
          ? "red"
          : impact === "serious"
          ? "#FFA500"
          : impact === "moderate"
          ? "#1E90FF"
          : impact === "minor"
          ? "gray"
          : "black";

      doc
        .font("bold")
        .fontSize(12)
        .fillColor("black")
        .text(`${i + 1}. ${issue.description}`);

      doc
        .font("italic")
        .fontSize(11)
        .fillColor(color)
        .text(`${translateUsing("pdfImpact")}: ${impact}`);

      doc
        .font("default")
        .fontSize(10)
        .fillColor("black")
        .text(`${translateUsing("pdfHelp")}: ${issue.help}`)
        .text(`${translateUsing("pdfTags")}: ${issue.tags.join(", ")}`);

      doc.moveDown(1.2);
    });
  }

  // Footer
  doc
    .moveDown()
    .font("italic")
    .fontSize(9)
    .fillColor("gray")
    .text(translateUsing("pdfFooterNote"), { align: "center" });

  doc.end();
  console.log(`📄 ${translateUsing("pdfSaved", { filename: finalPath })}`);
}
