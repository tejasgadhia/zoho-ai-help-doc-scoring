# Project Scope: AI Help Doc Scoring Tool

> Owner: Tejas Gadhia
> Created: 2026-01-21
> Status: Phase 1 MVP Planning

---

## Project Goal

Build a tool that scores Zoho product documentation for AI-friendliness, identifying issues and suggesting fixes. Demonstrates what's possible to showcase internally.

---

## Phase 1: MVP (Current)

### Scope Constraints

| Aspect | MVP Scope | Rationale |
|--------|-----------|-----------|
| Products | Single product section (~15-20 pages) | Resource intensive, prove concept first |
| Scoring output | Composite + category breakdown | Covers most use cases without over-engineering |
| Audience | Single detailed report | Writers can use detail, others can skim summary |
| Score types | AI-focused only | Matches Zia team's original intent |
| Fixes | Top 5 issues with fixes, rest are flags | Manageable output |
| Frequency | One-time audit | Phase 2 can add monitoring |

### Target Documentation

**Primary:** Zoho Forms > Field Types section
- URL pattern: `https://help.zoho.com/portal/en/kb/forms/field-types/`
- Estimated pages: 15-20
- Good test case: mix of procedural and reference content

**Single page test:** `https://help.zoho.com/portal/en/kb/forms/field-types/form-fields/grid/articles/grid`

### Technical Approach

**Content Access: Headless Browser Scraping**

The help portal is JavaScript-rendered. Options considered:

| Method | Pros | Cons | Decision |
|--------|------|------|----------|
| Zoho Desk API | Structured data, official | Requires OAuth setup, API credits | Future phase |
| Manual paste | Simple | Tedious, doesn't scale | Fallback only |
| Headless scraping | Automated, works now | More complex, may break | **Selected** |

**Implementation:**
- Playwright or Puppeteer for JS rendering
- Extract: title, headings, body content, images (count + alt text), tables, code blocks
- Store as structured JSON for scoring

**Scraping script requirements:**
```
Input: Base URL or URL list
Output: JSON per page with:
  - url
  - title
  - headings (h1, h2, h3 with hierarchy)
  - body_text (cleaned)
  - paragraphs (with lengths)
  - lists (bullet/numbered)
  - images (count, alt text presence)
  - tables (structure)
  - code_blocks (count, language)
  - links (internal/external)
  - last_updated (if visible)
```

### Scoring Methodology

**Categories and Weights (MVP):**

| Category | Weight | Key Checks |
|----------|--------|------------|
| Content Structure | 30% | Paragraph length, heading clarity, list usage, atomic steps |
| Outcomes & Reversibility | 25% | Outcome statements, reversibility, destructive warnings |
| Single Source / Deduplication | 15% | Cross-page similarity (if scoring multiple) |
| Consistent Terminology | 15% | Action verb consistency |
| Text Over Visuals | 10% | Image-to-text ratio, alt text |
| Self-Contained Context | 5% | Dangling references, opening clarity |

**Scoring Scale:**
- Per-criterion: 0-10
- Category score: Weighted average of criteria
- Composite: Weighted average of categories
- Traffic light: Green (≥7), Yellow (4-6.9), Red (<4)

### Output Format

**Per-page report:**
```markdown
# Score Report: [Page Title]
URL: [url]
Scored: [date]

## Summary
- Composite Score: X/10 (Green/Yellow/Red)
- Top Issues: 3 bullets

## Category Breakdown
| Category | Score | Status |
|----------|-------|--------|
| Content Structure | 7.2 | 🟢 |
| Outcomes | 4.5 | 🟡 |
| ... | ... | ... |

## Top 5 Issues with Fixes
1. **Issue:** [description]
   - Location: [section/heading]
   - Fix: [specific suggestion]

2. ...

## All Flags (condensed)
- [Category]: [issue] @ [location]
- ...
```

**Section rollup (if scoring multiple pages):**
```markdown
# Section Score: Zoho Forms > Field Types

## Overview
- Pages scored: 18
- Average score: 6.4/10
- Lowest: Grid (4.2) | Highest: Basic Fields (8.1)

## Heatmap
[Table showing each page × category scores]

## Priority Issues
[Top 10 issues across all pages, sorted by impact]
```

---

## Phase 2: Future Ambitions

> Document these for later, not MVP scope.

### Expanded Scoring

- **Human readability score** (separate from AI)
  - Readability metrics (Flesch-Kincaid, etc.)
  - Navigation clarity
  - Visual design assessment
  
- **Blended score with configurable weights**
  - Slider: AI vs Human priority
  - Presets: "AI-first," "Balanced," "Human-first"

- **All output types:**
  - Composite score
  - Category breakdown
  - Per-criterion detail
  - Traffic light dashboard
  - Weighted custom views

### Expanded Audience Views

- **Tech writers:** Full detail + inline fixes
- **Product managers:** Section summaries + priority issues
- **Leadership:** Cross-product comparison dashboard

### Automation

- **Continuous monitoring:** Scheduled re-scoring on content changes
- **Pre-publish scoring:** Hook into content workflow
- **Alerts:** Notify when scores drop below threshold

### Scale

- **All Zoho products:** 50+ product doc sets
- **API integration:** Zoho Desk API for direct KB access
- **llms.txt generation:** Auto-generate from scored content

### Integration Points

- **Zia Search team:** Feed scoring data to assistant analytics
- **Zoho Learn:** Include internal docs (per community request)
- **Content workflow:** Quality gate before publish

---

## Technical Notes

### Help Portal Structure

URL pattern: `https://help.zoho.com/portal/en/kb/{product}/{category}/{subcategory}/articles/{article}`

Example hierarchy for Forms:
```
/kb/forms/
  /field-types/
    /form-fields/
      /grid/
        /articles/grid
```

### Known Challenges

1. **JS rendering:** Portal requires JavaScript. Static fetch returns empty content.
2. **Rate limiting:** Unknown limits on scraping. Go slow, cache aggressively.
3. **Structure variation:** Different products may have different doc structures.
4. **No sitemap access:** Need to crawl navigation or maintain URL lists manually.

### Dependencies

- Playwright/Puppeteer for scraping
- Node.js or Python runtime
- Storage for scraped content cache
- Scoring logic (can be Claude-assisted or rule-based)

---

## Open Questions

1. **Cross-product terminology:** How to handle terms that differ between products intentionally?
2. **Version-specific docs:** Score all versions or just latest?
3. **Localization:** Score English only or include translations?
4. **Baseline:** What's a "good" score? Need to calibrate against known-good docs.

---

## Success Criteria (MVP)

- [ ] Successfully scrape 15-20 pages from Forms Field Types section
- [ ] Generate per-page score reports with category breakdown
- [ ] Identify top 5 issues per page with actionable fixes
- [ ] Create section rollup showing comparative scores
- [ ] Document process for replicating on other products

---

## Files in This Project

| File | Purpose |
|------|---------|
| `01-background-research.md` | Industry context, llms.txt, what others do |
| `02-zoho-team-recommendations.md` | Zia team criteria with validation |
| `03-additional-recommendations.md` | Gaps and additions from research |
| `project-scope.md` | This file - scope, technical approach, future plans |
| `scoring-criteria.json` | Structured criteria for scoring logic (from earlier) |
