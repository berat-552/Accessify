#!/usr/bin/env node

import puppeteer from "puppeteer";
import fs from "fs";
import chalk from "chalk";
import path from "path";
import { createRequire } from "module";
import { saveResultsAsPdf } from "./saveResultsAsPdf.js";
import inquirer from "inquirer";
import ora from "ora";

const require = createRequire(import.meta.url);

// ---------- Parse Args ----------
const args = process.argv.slice(2);
const isCI = args.includes("--ci");
const filteredArgs = args.filter((arg) => arg !== "--ci");

if (filteredArgs.length === 0) {
  console.error("❌ Please provide one or more URLs or a .txt file.");
  process.exit(1);
}

let urls = [];
if (filteredArgs.length === 1 && fs.existsSync(filteredArgs[0])) {
  // Read URLs from file
  urls = fs
    .readFileSync(filteredArgs[0], "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
} else {
  urls = filteredArgs;
}

// ---------- Audit Logic ----------
async function runAudit(url) {
  const formattedUrl = url.startsWith("http")
    ? new URL(url)
    : new URL(`http://${url}`);
  const hostname = formattedUrl.hostname.replace(/^www\./, "").split(".")[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const defaultFilename = `${hostname}-report-${timestamp}.pdf`;

  const spinner = ora(`🔄 Auditing ${formattedUrl.href}`).start();

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  let response;
  try {
    response = await page.goto(formattedUrl.href, {
      waitUntil: "networkidle2",
      timeout: 15000,
    });
  } catch (err) {
    spinner.fail(`❌ Failed to load ${url}: ${err.message}`);
    await browser.close();
    return { url, issues: [], error: err.message };
  }

  if (!response || !response.ok()) {
    spinner.fail(`❌ ${url} returned status: ${response?.status() || "Unknown"}`);
    await browser.close();
    return { url, issues: [], error: `Bad response: ${response?.status()}` };
  }

  const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => await axe.run());

  await browser.close();
  spinner.succeed(`✅ Finished audit for ${url}`);

  const issues = results.violations;
  return { url, issues, formattedUrl, defaultFilename };
}

// ---------- Run All Audits ----------
(async () => {
  let hasFailures = false;

  for (const url of urls) {
    const {
      url: scannedUrl,
      issues,
      formattedUrl,
      defaultFilename,
      error,
    } = await runAudit(url);

    if (error) {
      console.error(chalk.red(`⚠ Error for ${scannedUrl}: ${error}`));
      hasFailures = true;
      continue;
    }

    console.log(chalk.blue(`\n🔎 Results for ${scannedUrl}:\n`));
    if (issues.length === 0) {
      console.log(chalk.green("✅ No accessibility violations found!\n"));
      continue;
    }

    const severityCount = issues.reduce((acc, i) => {
      const impact = i.impact || "unknown";
      acc[impact] = (acc[impact] || 0) + 1;
      return acc;
    }, {});

    issues.forEach((violation, i) => {
      const impactColor =
        violation.impact === "critical"
          ? chalk.red
          : violation.impact === "serious"
          ? chalk.yellow
          : violation.impact === "moderate"
          ? chalk.blue
          : chalk.gray;

      console.log(chalk.cyan(`[${i + 1}] ${violation.description}`));
      console.log(impactColor(`  Impact: ${violation.impact || "unknown"}`));
      console.log(`  Help: ${violation.help}`);
      console.log(`  Tags: ${violation.tags.join(", ")}`);
      console.log("");
    });

    console.log(chalk.gray("📊 Summary by severity:"));
    for (const [severity, count] of Object.entries(severityCount)) {
      console.log(`  ${severity}: ${count}`);
    }

    hasFailures = true;

    // ----- Handle PDF Saving -----
    if (isCI) {
      const filename = `${formattedUrl.hostname.replace(/^www\./, "")}-report.pdf`;
      saveResultsAsPdf(issues, formattedUrl.href, filename);
      console.log(chalk.green(`📄 PDF saved to: ${filename}\n`));
    } else {
      const { savePdf } = await inquirer.prompt([
        {
          type: "confirm",
          name: "savePdf",
          message: "Save PDF report?",
          default: true,
        },
      ]);

      if (savePdf) {
        const { rawFilename } = await inquirer.prompt([
          {
            type: "input",
            name: "rawFilename",
            message: "Enter output filename:",
            default: defaultFilename,
          },
        ]);

        const filename = rawFilename.trim().endsWith(".pdf")
          ? rawFilename.trim()
          : `${rawFilename.trim()}.pdf`;

        fs.mkdirSync(path.dirname(filename), { recursive: true });

        const pdfSpinner = ora("📄 Generating PDF...").start();
        saveResultsAsPdf(issues, formattedUrl.href, filename);
        pdfSpinner.succeed(`✅ PDF saved to: ${filename}`);
      }
    }
  }

  if (isCI && hasFailures) {
    process.exit(1);
  }
})();
