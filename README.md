# Accessibility Checker CLI 🧪♿

A lightweight, developer-friendly command-line tool that audits any webpage for accessibility issues using Puppeteer and axe-core. Generates a styled terminal report and optionally exports a PDF summary with severity-based color coding.

---

## 🚀 Features

- Scans any public URL for WCAG violations
- Detects issues like missing alt text, low contrast, invalid landmarks, etc.
- Displays results directly in the terminal, color-coded by severity
- Provides a summary breakdown by impact (`critical`, `serious`, etc.)
- Optionally exports the report as a clean PDF (color-coded as well)
- Auto-generates default report filenames
- Handles broken URLs, unreachable domains, and bad status codes gracefully

---

## 📦 Installation (Local Dev)

1. **Clone the repository**

```bash
git clone https://github.com/your-username/accessibility-checker-cli.git
cd accessibility-checker-cli
```

2. **Install dependecies**

```bash
npm install
```

3. **Link the CLI globally (for local testing)**

```bash
npm link
```

4. **Now you can run the CLI from anywhere on your machine:**

```bash
accessibility-checker https://example.com
```

Examples:

```bash
accessibility-checker https://www.wikipedia.org
accessibility-checker www.github.com
```

Example Output PDF:

![Example Accessibility Report](./Example-Accessibility-Report.png)
