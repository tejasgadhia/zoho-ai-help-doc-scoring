# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**AI Help Doc Scoring Tool** - Browser-based web app that scores Zoho documentation for AI-friendliness using a bookmarklet + BYOK (Bring Your Own Key) architecture.

**Current Status:** v0.2.0 - Landing page redesign complete, deployed to GitHub Pages

**Live URL:** https://tejasgadhia.github.io/zoho-ai-help-doc-scoring/

**Tech Stack:**
- Runtime: 100% client-side JavaScript (no build step)
- UI: Vanilla JS with Chart.js for visualizations
- Styling: Custom CSS with design tokens (Zoho brand colors)
- Fonts: Playfair Display (headlines) + DM Sans (body)
- API: Claude API (BYOK) for semantic analysis

## Design System

**Colors (Zoho Brand):**
- Primary: #E42527 (Zoho Red)
- Accent: #226DB4 (Zoho Blue)
- Success: #1CB75E
- Warning: #FFA23A
- Error: #FF0000
- Backgrounds: #FAFAFA (light), #1a1a1a (dark)

**Typography:**
- Headlines: Playfair Display (serif)
- Body: DM Sans (sans-serif)

**Layout:**
- Two-column landing page (hero left, instructions right)
- Full-width context box below grid
- Trust signals footer

## Architecture

### How It Works

1. **Bookmarklet** extracts content from help.zoho.com pages
2. **postMessage** sends extracted content to the app
3. **Rule-based scoring** runs immediately (paragraph length, headings, etc.)
4. **Claude-assisted scoring** (if API key configured) analyzes semantic criteria
5. **Results** displayed with charts, category breakdown, and actionable fixes

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Main entry point, all views (landing, scoring, results) |
| `js/app.js` | Main orchestration, UI state, event handling |
| `js/bookmarklet.js` | Content extraction source (minified in app.js) |
| `js/parser.js` | Validates and normalizes extracted content |
| `js/scorer.js` | Orchestrates rule + Claude scoring |
| `js/claude-client.js` | BYOK API integration |
| `js/rules/*.js` | Rule-based scoring modules |
| `js/storage.js` | localStorage utilities |
| `js/export.js` | Markdown report generation |
| `js/charts.js` | Chart.js visualizations |
| `css/styles.css` | Full stylesheet with theme system |
| `config/scoring-criteria.json` | Weights and thresholds |

### Scoring Categories

| Category | Weight | Type |
|----------|--------|------|
| Content Structure | 30% | Hybrid (rules + Claude) |
| Outcomes & Reversibility | 25% | Claude only |
| Consistent Terminology | 15% | Hybrid |
| Permissions & Plans | 15% | Claude only |
| Text Over Visuals | 10% | Rules only |
| Self-Contained Context | 5% | Claude only |

### Rule-Based Criteria

Located in `js/rules/`:
- **content-structure.js**: Paragraph length (>150 words), list usage ratio, heading hierarchy
- **terminology.js**: Term consistency detection, confusable term pairs
- **text-over-visuals.js**: Image ratio, alt text coverage

### Claude-Assisted Criteria

Single API call per page analyzing:
- CS-03: Step atomicity (multi-action steps)
- CS-05: Workflow separation
- OR-01-04: Outcome clarity, affected data, reversibility, destruction warnings
- GAP-03-04: Dangling references, self-sufficient sections
- PP-01-04: Scope, plan requirements, permissions, preconditions
- AV-02: Term conflation (semantic check)

## Development

### Local Testing

1. Open `index.html` in a browser
2. Use browser DevTools to test:
   ```javascript
   // Simulate bookmarklet content
   const testContent = {
     meta: { url: 'https://test.com', title: 'Test Page', extractedAt: new Date().toISOString() },
     structure: { headings: [], paragraphs: [{text: 'Test paragraph with some content.', wordCount: 5}], lists: [], images: [], tables: [], codeBlocks: [], links: [] },
     text: { fullText: 'Test paragraph with some content.', wordCount: 5 }
   };
   App.processContent(testContent);
   ```

### Deploying

1. Commit and push to GitHub
2. GitHub Pages auto-deploys from main branch
3. Live at: https://tejasgadhia.github.io/zoho-ai-help-doc-scoring/

### Code Conventions

- All modules are plain objects with methods (no classes)
- Each scoring module returns: `{criterionId, score, issues[], details}`
- Issues format: `{severity: 'critical'|'warning'|'info', message, fix, location?, excerpt?}`
- Scores are 0-10, traffic light: green >=7, yellow >=4, red <4
- CSS uses custom properties (design tokens) for theming

### Adding New Rules

1. Create new file in `js/rules/` or add to existing
2. Implement `scoreX(metrics, content)` method returning standard format
3. Add to `scoreAll()` method with appropriate weight
4. Update `scorer.js` to call the new rule

### Adding New Claude Criteria

1. Add criterion to prompt in `js/claude-client.js` `scoreSemanticCriteria()`
2. Update `scorer.js` `addClaudeScores()` to extract and categorize
3. Update `config/scoring-criteria.json` if needed

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1.0 | 2026-01-21 | Initial MVP release |
| v0.2.0 | 2026-01-21 | Landing page redesign with Zoho branding |

## File Reference (Planning Docs)

| File | Purpose |
|------|---------|
| `files/project-scope.md` | Original project scope and requirements |
| `files/scoring-criteria.json` | Original Zia team criteria (8 categories) |
| `files/01-background-research.md` | Industry research on AI-friendly docs |
| `files/02-zoho-team-recommendations.md` | Validation of Zia criteria |
| `files/03-additional-recommendations.md` | Additional best practices |

## Phase 2 Considerations (Future)

- Browser extension version (no bookmarklet)
- Bulk scoring (multiple pages at once)
- Comparison view (side-by-side pages)
- Trend tracking over time
- Export formats (JSON, CSV, PDF)
- Section rollup reports

## Known Limitations

1. **Single page only** - No bulk/batch scoring yet
2. **help.zoho.com only** - Bookmarklet optimized for Zoho help portal
3. **No cross-page deduplication** - Can't detect duplicate content across pages
4. **Rate limits** - Claude API has rate limits; heavy use may hit them
5. **localStorage limits** - History limited to 50 entries
