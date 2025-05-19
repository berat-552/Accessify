# Accessibility Checker CLI 🧪♿

A lightweight, developer-friendly command-line tool that audits any public webpage for accessibility issues using **Puppeteer** and **axe-core**. Supports both **local use** and **CI/CD pipelines**, and can export clean, shareable PDF reports.

---

## 🚀 Features

- ✅ Scans one or multiple URLs for common accessibility violations
- 🔍 Detects issues like missing alt text, contrast problems, invalid HTML structure, and more
- 🎨 Outputs styled, color-coded summaries in the terminal (grouped by severity)
- 📄 Optionally generates PDF reports (auto-named, with severity indicators)
- 🗂️ Supports **batch scanning** from a `.txt` file
- 🤖 **CI mode**: exits with code `1` if issues are found, allowing it to fail builds in pipelines
- 💥 Gracefully handles unreachable URLs and invalid responses

---

## 🧪 Quick Examples

### ✅ Scan a single site
```bash
node accessibility-checker.js https://example.com
```

### 📁 Scan multiple from a list in a textfile
```bash
node accessibility-checker.js urls.txt
```

### 🤖 CI/CD Mode
```bash
node accessibility-checker.js urls.txt --ci
```
Use this flag to run automated accessibility checks inside CI/CD pipelines (e.g. GitHub Actions, GitLab CI, etc.):

✅ Designed for automation – no user prompts or manual input

📄 Automatically generates PDF reports for any violations

❌ Fails the pipeline (exit code 1) if issues are detected

🧪 Ideal for catching problems before production deployment

You can integrate this step into any `.yml` workflow file to ensure accessibility is checked on every push or pull request.


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

## 👥 Who’s This For?

Developers who want fast feedback on accessibility

Teams building accessibility into CI pipelines

Freelancers auditing personal or client sites

Example Output PDF:

![Example Accessibility Report](./Example-Accessibility-Report.png)
