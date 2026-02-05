# Issue Plan - zoho-ai-help-doc-scoring

**Updated**: 2026-02-05
**Open**: 0 issues | **Closed this session**: 20

---

## Phase 4: Advanced Capabilities & Scale (5 issues, ~12-14 hours) ← CURRENT

| #   | Title                                  | Effort | Status  |
|-----|----------------------------------------|--------|---------|
| 3   | Add batch scoring for multiple URLs    | hard   | ✓ done |
| 4   | Detect cross-page duplicate content    | hard   | ✓ done |
| 14  | Incremental re-score of changed sections | hard   | ✓ done |
| 16  | Support hot-reloading scoring config   | medium | ✓ done |
| 19  | Add link integrity checks              | medium | ✓ done |

## Archive (Completed)

### Phase 1: Extraction & Structure Reliability
- ✓ #1 - Harden bookmarklet selectors and fallbacks
- ✓ #2 - Improve extraction for tables, code, and callouts
- ✓ #6 - Expand heading hierarchy validation
- ✓ #7 - Differentiate procedural vs descriptive lists
- ✓ #18 - Improve boilerplate and nav stripping

### Phase 2: Scoring Depth & Explainability
- ✓ #5 - Add section-level scoring and rollups
- ✓ #8 - Add sentence complexity heuristics
- ✓ #9 - Add terminology clustering for synonym inconsistencies
- ✓ #12 - Estimate semantic criteria without Claude
- ✓ #15 - Add explainability for rule triggers

### Phase 3: Claude & Runtime Performance
- ✓ #10 - Cache Claude results by content hash
- ✓ #11 - Add retry/backoff for Claude rate limits
- ✓ #13 - Parallelize rule module scoring
- ✓ #17 - Surface parsing/scoring errors in UI
- ✓ #20 - Add performance profiling per phase

### Phase 4: Advanced Capabilities & Scale
- ✓ #3 - Add batch scoring for multiple URLs
- ✓ #4 - Detect cross-page duplicate content
- ✓ #14 - Incremental re-score of changed sections
- ✓ #16 - Support hot-reloading scoring config
- ✓ #19 - Add link integrity checks
