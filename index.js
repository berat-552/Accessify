#!/usr/bin/env node

import puppeteer from "puppeteer";
import fs from "fs";
import chalk from "chalk";
import path from "path";
import { createRequire } from "module";
import { saveResultsAsPdf } from "./generatePdf.js";
import inquirer from "inquirer";
import ora from "ora";

const require = createRequire(import.meta.url);

(async () => {
  const input = process.argv[2];

  if (!input) {
    console.error("❌ Please provide a URL to check.");
    process.exit(1);
  }

  // Normalize input: add http:// if missing
  let formattedUrl;
  try {
    formattedUrl = input.startsWith("http")
      ? new URL(input)
      : new URL(`http://${input}`);
  } catch {
    console.error(
      "❌ Invalid URL. Please enter a valid URL like 'example.com' or 'https://example.com'"
    );
    process.exit(1);
  }

  const hostname = formattedUrl.hostname.replace(/^www\./, "").split(".")[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); // includes seconds
  const defaultFilename = `${hostname}-report-${timestamp}.pdf`;

  const spinner = ora("🔄 Loading page and checking accessibility...").start();

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  let response;
  try {
    response = await page.goto(formattedUrl.href, {
      waitUntil: "networkidle2",
      timeout: 15000,
    });
  } catch (err) {
    spinner.fail(`❌ Failed to load the page: ${err.message}`);
    await browser.close();
    process.exit(1);
  }

  if (!response || !response.ok()) {
    spinner.fail(`❌ Page returned bad status: ${response?.status() || "Unknown"}`);
    await browser.close();
    process.exit(1);
  }

  spinner.text = "🔍 Running accessibility audit...";

  const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => await axe.run());

  await browser.close();
  spinner.succeed("✅ Accessibility audit completed.");

  const issues = results.violations;

  if (issues.length === 0) {
    console.log(chalk.green("✅ No accessibility violations found!"));
    return;
  }

  // Group by severity
  const severityCount = issues.reduce((acc, issue) => {
    const impact = issue.impact || "unknown";
    acc[impact] = (acc[impact] || 0) + 1;
    return acc;
  }, {});

  console.log(chalk.red(`❗ Found ${issues.length} accessibility issues:\n`));

  issues.forEach((violation, i) => {
    const impact = violation.impact || "unknown";
    const impactColor =
      impact === "critical"
        ? chalk.red
        : impact === "serious"
        ? chalk.yellow
        : impact === "moderate"
        ? chalk.blue
        : chalk.gray;

    console.log(chalk.cyan(`[${i + 1}] ${violation.description}`));
    console.log(impactColor(`  Impact: ${impact}`));
    console.log(`  Help: ${violation.help}`);
    console.log(`  Tags: ${violation.tags.join(", ")}`);
    console.log("");
  });

  // Print summary by severity
  console.log(chalk.blue("🧾 Summary by Severity:"));
  Object.entries(severityCount).forEach(([impact, count]) => {
    const color =
      impact === "critical"
        ? chalk.red
        : impact === "serious"
        ? chalk.yellow
        : impact === "moderate"
        ? chalk.blue
        : chalk.gray;
    console.log(color(`  ${impact}: ${count}`));
  });
  console.log("");

  // Ask if user wants to save a PDF
  const { savePdf } = await inquirer.prompt([
    {
      type: "confirm",
      name: "savePdf",
      message: "Would you like to save the report as a PDF?",
      default: true,
    },
  ]);

  if (!savePdf) return;

  const { rawFilename } = await inquirer.prompt([
    {
      type: "input",
      name: "rawFilename",
      message: "Enter the output PDF filename:",
      default: defaultFilename,
    },
  ]);

  // Ensure filename ends with .pdf
  const filename = rawFilename.trim().toLowerCase().endsWith(".pdf")
    ? rawFilename.trim()
    : `${rawFilename.trim()}.pdf`;

  const outputDir = path.dirname(filename);
  const isNewFolder = !fs.existsSync(outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  if (isNewFolder && outputDir !== ".") {
    console.log(chalk.gray(`📁 Created folder: ${outputDir}`));
  }

  const pdfSpinner = ora("📝 Generating PDF report...").start();
  saveResultsAsPdf(issues, formattedUrl.href, filename);
  pdfSpinner.succeed(`📄 PDF report saved to ${filename}`);
})();
