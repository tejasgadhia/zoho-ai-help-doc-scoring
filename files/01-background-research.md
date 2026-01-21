# Background Research: AI-Friendly Documentation

> Reference doc for scoring help documentation. Last updated: 2026-01-21

---

## Why This Matters

Documentation now serves two audiences: humans and AI. Mintlify claims docs are "50% for humans and 50% for LLMs." Vercel reports 10% of signups come from ChatGPT. Companies that optimize for AI retrieval see measurably better outcomes in AI-assisted discovery.

---

## The llms.txt Standard

**What it is:** A markdown file at `/llms.txt` that helps LLMs navigate website content. Created by Jeremy Howard (Answer.AI/fast.ai) in September 2024.

**Adoption:** 844,000+ websites as of October 2025. Major adopters include Anthropic, Cursor, Cloudflare, Perplexity, Hugging Face, Zapier, Vercel, Stripe.

**Structure:**
```markdown
# Project Name

> Brief summary

## Core Documentation
- [Page Title](url): Description

## Optional
- [Lower Priority](url): Can be skipped for shorter context
```

**Variants:**
- `llms-full.txt` - Complete docs in single markdown file (gets more AI traffic than index)
- `.md` URL suffix - Any page as clean markdown (Stripe does this)
- `install.md` - Proposed standard for LLM-executable installation instructions

**Reality check:** No major LLM provider officially supports llms.txt, but traffic analysis confirms LLMs are actively crawling these files.

---

## What Leading Companies Do

### Stripe (Gold Standard)
- Any doc page available as markdown by appending `.md` to URL
- "Copy for LLM" buttons on pages
- MCP server at `mcp.stripe.com`
- Open-source Agent Toolkit for OpenAI/LangChain/CrewAI
- Explicit guidance: "Plain text contains fewer formatting tokens"

### Anthropic
- Partnered with Mintlify on llms-full.txt format
- Default 25,000 token limit for Claude Code
- Published guidance on writing for AI agents
- Recommends watching where agents get confused to identify doc issues

### Vercel
- llms.txt exceeds 200,000 words
- Embeds llms.txt-style instructions in HTTP error responses (401s include auth steps)

### OpenAI
- Segmented approach: separate llms.txt files for models/pricing, guides, API reference
- Combined llms-full.txt for everything

### Twilio
- Relies entirely on OpenAPI specs as machine-readable format
- No llms.txt, uses `github.com/twilio/twilio-oai`

### Notion
- MCP-focused at `mcp.notion.com`
- Tools specifically designed for AI agents (search, fetch, database queries)

---

## Documentation Platform Features

| Platform | Auto llms.txt | llms-full.txt | .md URLs | MCP Server |
|----------|--------------|---------------|----------|------------|
| Mintlify | ✅ | ✅ | ✅ | ✅ |
| GitBook | ✅ | ✅ | ✅ | ✅ |
| ReadMe | ✅ | ✅ | ✅ | ✅ |
| Docusaurus | Plugin | Plugin | Plugin | ❌ |

---

## Key Statistics Worth Citing

- Structured data (FAQPage schema) achieves **41% citation rate vs 15%** without — 2.7× higher (Relixir 2025)
- Content with concrete statistics boosts AI visibility by **up to 28%** (SurferSEO)
- AI search traffic converts at **4.4× the rate** of traditional organic (Omnius)
- 58% of consumers rely on AI for product recommendations
- Markdown reduces token consumption by **up to 90%** vs HTML (Mintlify)

---

## RAG-Specific Insights

**Chunk size:** 256-512 tokens optimal for most documentation

**Chunk overlap:** 10-20% recommended to prevent context loss at boundaries

**Deduplication:** Critical. Duplicate content causes "conflicting answers in retrieval" and "wastes valuable context window" (Shelf.io, arXiv)

**Self-contained chunks:** Each chunk should stand alone. Avoid starting with "This approach" or "It" without antecedent.

**Hybrid search:** Content should support both semantic (embedding) AND keyword (BM25) retrieval. Embeddings miss exact keyword matches.

---

## Emerging Concepts

**GEO (Generative Engine Optimization):** Distinct from SEO. Focuses on LLM citation optimization rather than search ranking.

**MCP (Model Context Protocol):** Standard for real-time AI integration. Enables dynamic querying vs static embeddings.

**install.md:** Proposed January 2026 by Mintlify for LLM-executable installation instructions.

---

## Sources for Deep Dives

- Stripe docs guidance: https://docs.stripe.com/building-with-llms
- llms.txt spec: https://llmstxt.org/
- GitBook GEO guide: https://gitbook.com/docs/guides/seo-and-llm-optimization/geo-guide-how-to-optimize-your-docs-for-ai-search-and-llm-ingestion
- AWS RAG best practices: https://docs.aws.amazon.com/prescriptive-guidance/latest/writing-best-practices-rag/best-practices.html
- Anthropic tool writing: https://www.anthropic.com/engineering/writing-tools-for-agents
