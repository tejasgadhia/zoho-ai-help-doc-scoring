# Zoho Zia Team Recommendations (Validated)

> From internal Zoho Connect post by Zia Search team. Validated against industry research.
> Source: AI Friendly Help Documentation post, January 2026

---

## High-Impact Factors (Top Priority)

These 5 items have the highest impact on AI response quality per Zia team:

| ID | Factor | Validation | Evidence Strength |
|----|--------|------------|-------------------|
| HIF-01 | One clear source of truth | ✅ Strongly supported | Shelf.io, arXiv, Google dedup research |
| HIF-02 | Clear document boundaries | ✅ Strongly supported | Regal.ai, Weaviate, GitBook |
| HIF-03 | Explicit outcomes | ✅ Supported | Strapi, ANSI Z535.4 |
| HIF-04 | Consistent naming | ✅ Supported | Strapi, embedding vector research |
| HIF-05 | Structural optimization | ✅ Strongly supported | Relixir (2.7× citation rate), RWS |

---

## Detailed Criteria

### CAT-01: Content Structure

| ID | Criterion | How to Score | Validation |
|----|-----------|--------------|------------|
| CS-01 | Bullet points over long paragraphs | Check paragraph length, list presence | ✅ Supported |
| CS-02 | Atomic steps (one action per step) | Count actions per instruction | ✅ Strong (ANSI/ISO standards) |
| CS-03 | No compound actions in single instruction | Parse for "and/then" patterns | ✅ Supported |
| CS-04 | Headings reflect user intent | Evaluate heading clarity | ✅ Supported |
| CS-05 | Separate workflows (install/usage/uninstall) | Check for workflow mixing | ✅ Supported |
| CS-06 | No duplicate/conflicting instructions | Cross-reference content | ✅ Strong |

**Scoring approach:** Section length analysis, action counting, heading evaluation

---

### CAT-02: Consistent Action Vocabulary

| ID | Criterion | How to Score | Validation |
|----|-----------|--------------|------------|
| AV-01 | Standardized action terms | Build term dictionary, flag inconsistencies | ✅ Supported |
| AV-02 | No interchangeable terms (Deactivate ≠ Disconnect ≠ Delete) | Check term conflation | ✅ Supported |

**Scoring approach:** Extract action verbs, build vocabulary map, check consistency across doc set

---

### CAT-03: Outcomes and Reversibility

| ID | Criterion | How to Score | Validation |
|----|-----------|--------------|------------|
| OR-01 | Describe what changes | Check for outcome statements | ✅ Supported |
| OR-02 | State affected data/settings | Look for affected-data callouts | ✅ Supported |
| OR-03 | Indicate reversibility | Check for reversibility statements | ✅ Supported |
| OR-04 | Disclaimers for destructive actions | Flag destructive actions without warnings | ✅ Strong (Google style guide, ANSI Z535.4) |

**Scoring approach:** Pattern match for outcome language, destructive action keywords

**Good example from Zia team:**
> "Note: When you uninstall the Sync app from your computer, the files already synced to your computer will not be deleted automatically."

---

### CAT-04: Permission and Plan-Based Clarity

| ID | Criterion | How to Score | Validation |
|----|-----------|--------------|------------|
| PP-01 | Define scope/eligibility | Check for scope statements | ✅ Supported |
| PP-02 | Mention supported plans/editions | Check for plan callouts | ✅ Supported |
| PP-03 | State required roles/permissions | Check for permission requirements | ✅ Supported |
| PP-04 | Call out preconditions | Check for precondition statements | ✅ Supported |

**Good examples from Zia team:**
- "Only Workspace admins can perform this action"
- "Feature is available only for IN / EU region users"
- "In Free plan, only 2000 requests are allowed per day per user"
- "In Standard plan, API support is not available for this feature"

**Scoring approach:** Pattern match for role/plan/region language

---

### CAT-05: Pricing Page Structure

| ID | Criterion | How to Score | Validation |
|----|-----------|--------------|------------|
| PR-01 | Clear pricing/features/limits for all plans | Check completeness | ✅ Supported |
| PR-02 | Region-wise standardization | Compare regional pages | ✅ Supported |
| PR-03 | Label free vs paid vs trial | Check distinctions | ✅ Supported |
| PR-04 | Text labels not icons in comparison tables | Check for icon-only cells | ⚠️ Limited evidence |

**Scoring approach:** Table structure analysis, text extraction from comparison grids

---

### CAT-06: Intent-Driven FAQs

| ID | Criterion | How to Score | Validation |
|----|-----------|--------------|------------|
| FAQ-01 | User goals over feature names | Analyze FAQ phrasing | ✅ Supported |

**Bad (feature-centric):**
- "How to disable integration"
- "How to enable a connection"

**Good (intent-driven):**
- "I want to stop syncing data"
- "I need to sync contacts between two apps"

**Scoring approach:** NLP analysis of FAQ structure - does it start with user intent or feature name?

---

### CAT-07: Community Content Consolidation

| ID | Criterion | How to Score | Validation |
|----|-----------|--------------|------------|
| CC-01 | Migrate valid community info to official docs | Check for info gaps | ✅ Supported |

**Context:** Public LLMs answer questions from community pages that Zia Help Assistant can't because community content is excluded to avoid misinformation.

**Scoring approach:** This is more of an audit task than per-page scoring. Compare community answers vs official doc coverage.

---

### CAT-08: Text Over Visual Content

| ID | Criterion | How to Score | Validation |
|----|-----------|--------------|------------|
| TB-01 | Text descriptions, not just images/screenshots | Flag image-heavy pages | ✅ Supported with nuance |
| TB-02 | Visuals as supporting, not primary | Check text-to-image ratio | ✅ Supported |
| TB-03 | Critical info written out, not just in images | Check text coverage | ✅ Supported |

**Nuance:** Multimodal capabilities are improving, but text fallback is still essential.

**Scoring approach:** Image count, alt text presence, text-to-image ratio, check if steps exist only in screenshots

---

## Scoring Weight Recommendations

Based on evidence strength, suggested weights for composite score:

| Category | Weight | Rationale |
|----------|--------|-----------|
| Content Structure | 25% | Strong evidence, foundational |
| Outcomes/Reversibility | 20% | Strong evidence for destructive actions |
| Single Source of Truth | 15% | Critical for RAG accuracy |
| Consistent Terminology | 15% | Affects retrieval precision |
| Permission/Plan Clarity | 10% | Important for accuracy |
| Text Over Visuals | 10% | Moderate evidence |
| Intent-Driven FAQs | 5% | Narrower scope |

---

## Products Currently Using Zia Help Assistants

Per the original post: CRM, Bigin, Site24x7, ZohoPos, Zoho Analytics, Zoho Meeting, Zoho Webinar, Zoho Assist, Zoho Sign

These would be good candidates for scoring since they already have AI assistants consuming the docs.
