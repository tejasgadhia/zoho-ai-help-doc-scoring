# AI Help Doc Scoring Tool

Score Zoho documentation for AI-friendliness. Get a composite score with actionable fixes.

**Live Demo**: https://tejasgadhia.github.io/zoho-ai-help-doc-scoring/

## Quick Start

1. **Install**: Drag the "Score This Page" bookmarklet to your bookmarks bar
2. **Visit**: Go to any help.zoho.com page
3. **Score**: Click the bookmarklet

## Features

- Instant scoring (0-10) across 6 categories
- Actionable fixes prioritized by impact
- Export detailed Markdown reports
- 100% client-side (privacy-first)

## Optional: Claude API

For deeper semantic analysis, add your API key in Settings. Get one at [console.anthropic.com](https://console.anthropic.com/).

Without an API key, you still get rule-based scoring for paragraph length, heading structure, list usage, image ratios, and terminology consistency.

## Score Guide

| Score | Status | Meaning |
|-------|--------|---------|
| 7-10 | Green | AI-friendly |
| 4-6.9 | Yellow | Needs work |
| 0-3.9 | Red | Critical issues |

## Privacy

All processing happens in your browser. Claude API analysis (if enabled) sends content to Anthropic only.


## License

This project is licensed under the [O'Saasy License Agreement](https://osaasy.dev/).

**TL;DR**: You can use, modify, and distribute this project freely. You can self-host it for personal or commercial use. However, you cannot offer it as a competing hosted/managed SaaS product.

See [LICENSE.md](LICENSE.md) for full details.
