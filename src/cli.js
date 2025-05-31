#!/usr/bin/env node

import puppeteer from "puppeteer";
import fs from "fs";
import chalk from "chalk";
import path from "path";
import { createRequire } from "module";
import { saveResultsAsPdf } from "./saveResultsAsPdf.js";
import inquirer from "inquirer";
import ora from "ora";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import he from "he";

const require = createRequire(import.meta.url);

// ---------- Parse Args ----------
const argumentsProvided = process.argv.slice(2);

if (argumentsProvided.includes("--help")) {
  // Dynamically list available languages from /locales/*.json
  const localeFiles = fs.readdirSync("./locales");
  const availableLangs = localeFiles
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.basename(file, ".json"))
    .join(", ");

  console.log(`
Usage: checkaccess [options] <url | file.txt>

Options:
  --help         Show this help message
  --ci           Run in CI mode (no prompts, auto-save PDF)
  --lang=<code>  Set language (available: ${availableLangs})

Examples:
  checkaccess https://example.com
  checkaccess urls.txt --ci --lang=fr
`);
  process.exit(0);
}

const isCI = argumentsProvided.includes("--ci");
const filteredArgs = argumentsProvided.filter((arg) => !arg.startsWith("--"));

const langArg = argumentsProvided.find((arg) => arg.startsWith("--lang="));
const languageCode = langArg ? langArg.split("=")[1] : "en";
const translateUsing = i18next.t;

await i18next.use(Backend).init({
  lng: languageCode,
  fallbackLng: "en",
  backend: {
    loadPath: "./locales/{{lng}}.json",
  },
});

if (filteredArgs.length === 0) {
  console.error(translateUsing("provideUrls"));
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
async function auditAccessibilityOf(url) {
  const formattedUrl = url.startsWith("http")
    ? new URL(url)
    : new URL(`http://${url}`);
  const hostname = formattedUrl.hostname.replace(/^www\./, "").split(".")[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suggestedFilename = `${hostname}-report-${timestamp}.pdf`;

  const loadingSpinner = ora(
    he.decode(translateUsing("auditing", { url: formattedUrl.href }))
  ).start();

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  let response;
  try {
    response = await page.goto(formattedUrl.href, {
      waitUntil: "networkidle2",
      timeout: 15000,
    });
  } catch (err) {
    loadingSpinner.fail(
      he.decode(translateUsing("failToLoad", { url, error: err.message }))
    );
    await browser.close();
    return { url, issues: [], error: err.message };
  }

  if (!response || !response.ok()) {
    loadingSpinner.fail(
      translateUsing(
        he.decode("badResponse", { url, code: response?.status() || "Unknown" })
      )
    );
    await browser.close();
    return { url, issues: [], error: `Bad response: ${response?.status()}` };
  }

  const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  await page.evaluate(axeSource);
  const auditResults = await page.evaluate(async () => await axe.run());

  await browser.close();
  loadingSpinner.succeed(he.decode(translateUsing("finishedAudit", { url })));

  const issues = auditResults.violations;
  return { url, issues, formattedUrl, suggestedFilename: suggestedFilename };
}

// ---------- Run All Audits ----------
(async () => {
  let hasFailures = false;

  for (const url of urls) {
    const {
      url: scannedUrl,
      issues,
      formattedUrl,
      suggestedFilename,
      error,
    } = await auditAccessibilityOf(url);

    if (error) {
      console.error(
        chalk.red(he.decode(translateUsing("errorFor", { url: scannedUrl, error })))
      );
      hasFailures = true;
      continue;
    }

    console.log(
      chalk.blue(
        `\n${he.decode(translateUsing("resultHeader", { url: scannedUrl }))}\n`
      )
    );
    if (issues.length === 0) {
      console.log(chalk.green(translateUsing("noViolations") + "\n"));
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

    console.log(chalk.gray(translateUsing("summary")));
    for (const [severity, count] of Object.entries(severityCount)) {
      console.log(`  ${severity}: ${count}`);
    }

    hasFailures = true;

    // ----- Handle PDF Saving -----
    if (isCI) {
      const filename = `${formattedUrl.hostname.replace(/^www\./, "")}-report.pdf`;
      saveResultsAsPdf(issues, formattedUrl.href, filename, translateUsing);
      console.log(chalk.green(translateUsing("pdfSaved", { filename }) + "\n"));
    } else {
      const { savePdf } = await inquirer.prompt([
        {
          type: "confirm",
          name: "savePdf",
          message: translateUsing("savePdf"),
          default: true,
        },
      ]);

      if (savePdf) {
        const { rawFilename } = await inquirer.prompt([
          {
            type: "input",
            name: "rawFilename",
            message: translateUsing("outputFilename"),
            default: suggestedFilename,
          },
        ]);

        const filename = rawFilename.trim().endsWith(".pdf")
          ? rawFilename.trim()
          : `${rawFilename.trim()}.pdf`;

        fs.mkdirSync(path.dirname(filename), { recursive: true });

        const pdfSpinner = ora(translateUsing("generatingPdf")).start();
        saveResultsAsPdf(issues, formattedUrl.href, filename, translateUsing);
        pdfSpinner.succeed(translateUsing("pdfSaved", { filename }));
      }
    }
  }

  if (isCI && hasFailures) {
    process.exit(1);
  }
})();
