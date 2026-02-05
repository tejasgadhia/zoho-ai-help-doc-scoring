/**
 * Scorer - Orchestrates rule-based and Claude-assisted scoring
 * Combines results from all scoring modules into a unified report
 */

const Scorer = {
  // Category weights (must sum to 1.0)
  CATEGORY_WEIGHTS: {
    'content-structure': 0.30,
    'outcomes-reversibility': 0.25,
    'terminology': 0.15,
    'text-over-visuals': 0.10,
    'self-contained': 0.05,
    'permissions-plans': 0.15
  },

  // Traffic light thresholds
  THRESHOLDS: {
    green: 7,
    yellow: 4
  },

  /**
   * Run all scoring modules and compute final results
   * @param {Object} content - Normalized content from parser
   * @param {Object} metrics - Computed metrics from parser
   * @param {string} apiKey - Claude API key (optional for rule-only mode)
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Complete scoring results
   */
  async scoreAll(content, metrics, apiKey = null, onProgress = () => {}) {
    const results = {
      meta: {
        url: content.meta.url,
        title: content.meta.title,
        scoredAt: new Date().toISOString(),
        mode: apiKey ? 'full' : 'rule-only'
      },
      categories: {},
      compositeScore: 0,
      allIssues: [],
      topIssues: [],
      summary: ''
    };

    // Step 1: Rule-based scoring
    onProgress({ step: 'rules', message: 'Running rule-based analysis...', percent: 10 });

    onProgress({ step: 'rules', message: 'Analyzing terminology...', percent: 25 });
    onProgress({ step: 'rules', message: 'Checking text vs visuals...', percent: 40 });

    const [contentStructureResults, terminologyResults, textVisualsResults] = await Promise.all([
      Promise.resolve(ContentStructureRules.scoreAll(metrics)),
      Promise.resolve(TerminologyRules.scoreAll(content)),
      Promise.resolve(TextOverVisualsRules.scoreAll(metrics, content))
    ]);

    results.categories['content-structure'] = {
      id: 'CAT-01',
      name: 'Content Structure',
      score: contentStructureResults.categoryScore,
      weight: this.CATEGORY_WEIGHTS['content-structure'],
      criteria: contentStructureResults.criteria,
      issues: contentStructureResults.allIssues
    };

    results.categories['terminology'] = {
      id: 'CAT-02',
      name: 'Consistent Terminology',
      score: terminologyResults.categoryScore,
      weight: this.CATEGORY_WEIGHTS['terminology'],
      criteria: terminologyResults.criteria,
      issues: terminologyResults.allIssues
    };

    results.categories['text-over-visuals'] = {
      id: 'CAT-08',
      name: 'Text Over Visuals',
      score: textVisualsResults.categoryScore,
      weight: this.CATEGORY_WEIGHTS['text-over-visuals'],
      criteria: textVisualsResults.criteria,
      issues: textVisualsResults.allIssues
    };

    // Step 2: Claude-assisted scoring (if API key provided)
    if (apiKey) {
      onProgress({ step: 'claude', message: 'Running AI semantic analysis...', percent: 55 });

      try {
        const textForAnalysis = Parser.getTextForAnalysis(content);
        const cacheKey = this.hashText(textForAnalysis);
        const cached = Storage.getClaudeCacheEntry(cacheKey);
        let claudeResults;
        let transformedScores;

        if (cached) {
          claudeResults = cached.raw;
          transformedScores = cached.transformed;
          results.meta.claudeCache = { status: 'hit', key: cacheKey, savedAt: cached.savedAt };
        } else {
          claudeResults = await ClaudeClient.scoreSemanticCriteria(apiKey, content, textForAnalysis);
          transformedScores = ClaudeClient.transformScores(claudeResults);
          Storage.saveClaudeCacheEntry(cacheKey, { raw: claudeResults, transformed: transformedScores });
          results.meta.claudeCache = { status: 'miss', key: cacheKey };
        }

        onProgress({ step: 'claude', message: 'Processing AI results...', percent: 80 });

        // Add Claude-scored categories
        this.addClaudeScores(results, transformedScores, claudeResults);

      } catch (error) {
        console.error('Claude scoring failed:', error);
        // Fall back to estimated scores for Claude categories
        this.addEstimatedScores(results, content, metrics);
        results.meta.claudeError = error.message;
      }
    } else {
      // No API key - add estimated scores
      this.addEstimatedScores(results, content, metrics);
    }

    // Step 3: Add section-level scoring (if available)
    this.addSectionScores(results, content);

    // Step 4: Calculate composite score
    onProgress({ step: 'compute', message: 'Calculating final scores...', percent: 90 });

    results.compositeScore = this.calculateCompositeScore(results.categories);
    results.status = this.getStatus(results.compositeScore);

    // Step 5: Collect and prioritize issues
    results.allIssues = this.collectAllIssues(results.categories);
    results.topIssues = this.getTopIssues(results.allIssues, 5);
    results.summary = this.generateSummary(results);

    onProgress({ step: 'complete', message: 'Scoring complete', percent: 100 });

    return results;
  },

  hashText(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  },

  /**
   * Add Claude-scored categories to results
   * @param {Object} results - Results object to modify
   * @param {Object} transformedScores - Transformed Claude scores
   * @param {Object} rawClaudeResults - Raw Claude response
   */
  addClaudeScores(results, transformedScores, rawClaudeResults) {
    const scores = transformedScores.scores;

    // Outcomes & Reversibility
    const orScores = ['OR-01', 'OR-02', 'OR-03', 'OR-04'];
    const orCriteria = {};
    let orIssues = [];
    orScores.forEach(id => {
      if (scores[id]) {
        orCriteria[id] = scores[id];
        orIssues = orIssues.concat(scores[id].issues || []);
      }
    });
    const orAvg = this.averageScores(orCriteria);
    results.categories['outcomes-reversibility'] = {
      id: 'CAT-03',
      name: 'Outcomes & Reversibility',
      score: orAvg,
      weight: this.CATEGORY_WEIGHTS['outcomes-reversibility'],
      criteria: orCriteria,
      issues: orIssues
    };

    // Self-Contained Context
    const scScores = ['GAP-03', 'GAP-04'];
    const scCriteria = {};
    let scIssues = [];
    scScores.forEach(id => {
      if (scores[id]) {
        scCriteria[id] = scores[id];
        scIssues = scIssues.concat(scores[id].issues || []);
      }
    });
    const scAvg = this.averageScores(scCriteria);
    results.categories['self-contained'] = {
      id: 'CAT-09',
      name: 'Self-Contained Context',
      score: scAvg,
      weight: this.CATEGORY_WEIGHTS['self-contained'],
      criteria: scCriteria,
      issues: scIssues
    };

    // Permissions & Plans
    const ppScores = ['PP-01', 'PP-02', 'PP-03', 'PP-04'];
    const ppCriteria = {};
    let ppIssues = [];
    ppScores.forEach(id => {
      if (scores[id]) {
        ppCriteria[id] = scores[id];
        ppIssues = ppIssues.concat(scores[id].issues || []);
      }
    });
    const ppAvg = this.averageScores(ppCriteria);
    results.categories['permissions-plans'] = {
      id: 'CAT-04',
      name: 'Permissions & Plans',
      score: ppAvg,
      weight: this.CATEGORY_WEIGHTS['permissions-plans'],
      criteria: ppCriteria,
      issues: ppIssues
    };

    // Add Claude criteria to existing categories
    if (scores['CS-03']) {
      results.categories['content-structure'].criteria['CS-03'] = scores['CS-03'];
      results.categories['content-structure'].issues.push(...(scores['CS-03'].issues || []));
    }
    if (scores['CS-05']) {
      results.categories['content-structure'].criteria['CS-05'] = scores['CS-05'];
      results.categories['content-structure'].issues.push(...(scores['CS-05'].issues || []));
    }
    if (scores['AV-02']) {
      // Merge with rule-based AV-02 or add new
      const existing = results.categories['terminology'].criteria['AV-02'];
      if (existing) {
        // Average the scores if both rule and Claude produced one
        existing.score = Math.round((existing.score + scores['AV-02'].score) / 2);
        existing.issues = existing.issues.concat(scores['AV-02'].issues || []);
      }
    }

    // Recalculate content-structure score with new criteria
    results.categories['content-structure'].score = this.averageScores(
      results.categories['content-structure'].criteria
    );

    // Store Claude summary
    results.claudeSummary = rawClaudeResults.summary;
    results.claudeTopIssues = rawClaudeResults.topIssues;
  },

  /**
   * Add estimated scores for Claude categories when API not available
   * @param {Object} results - Results object to modify
   */
  addEstimatedScores(results, content, metrics) {
    const text = (content.text.fullText || '').toLowerCase();
    const issuesFor = () => [];
    const hasAny = terms => terms.some(term => text.includes(term));

    // Outcomes & Reversibility (estimated)
    let outcomeScore = 6;
    const outcomeIssues = issuesFor();
    const destructiveTerms = ['delete', 'remove', 'erase', 'discard', 'wipe', 'purge'];
    const warningTerms = ['cannot be undone', 'irreversible', 'permanent', 'warning', 'caution'];
    const outcomeTerms = ['will', 'results in', 'creates', 'updates', 'changes', 'affects'];

    if (hasAny(destructiveTerms) && !hasAny(warningTerms)) {
      outcomeScore -= 2;
      outcomeIssues.push({
        severity: 'warning',
        message: 'Destructive actions detected without reversibility warning',
        fix: 'Add a warning if actions are irreversible or destructive'
      });
    }
    if (hasAny(outcomeTerms)) {
      outcomeScore += 1;
    }
    outcomeScore = Math.max(0, Math.min(10, outcomeScore));

    results.categories['outcomes-reversibility'] = {
      id: 'CAT-03',
      name: 'Outcomes & Reversibility',
      score: outcomeScore,
      weight: this.CATEGORY_WEIGHTS['outcomes-reversibility'],
      criteria: {
        'EST-OR': {
          score: outcomeScore,
          issues: outcomeIssues,
          details: 'Estimated from keyword heuristics (no Claude)'
        }
      },
      issues: outcomeIssues,
      estimated: true,
      message: 'Estimated using heuristic checks (no Claude)'
    };

    // Permissions & Plans (estimated)
    let permissionsScore = 6;
    const permissionsIssues = issuesFor();
    const permissionTerms = ['admin', 'permission', 'role', 'access', 'privilege'];
    const planTerms = ['plan', 'edition', 'subscription', 'upgrade'];

    if (hasAny(permissionTerms)) permissionsScore += 1;
    if (hasAny(planTerms)) permissionsScore += 1;
    if (!hasAny(permissionTerms) && !hasAny(planTerms)) {
      permissionsScore -= 1;
      permissionsIssues.push({
        severity: 'info',
        message: 'No explicit permissions or plan requirements detected',
        fix: 'Call out required roles, permissions, or plan editions if applicable'
      });
    }
    permissionsScore = Math.max(0, Math.min(10, permissionsScore));

    results.categories['permissions-plans'] = {
      id: 'CAT-04',
      name: 'Permissions & Plans',
      score: permissionsScore,
      weight: this.CATEGORY_WEIGHTS['permissions-plans'],
      criteria: {
        'EST-PP': {
          score: permissionsScore,
          issues: permissionsIssues,
          details: 'Estimated from keyword heuristics (no Claude)'
        }
      },
      issues: permissionsIssues,
      estimated: true,
      message: 'Estimated using heuristic checks (no Claude)'
    };

    // Self-Contained Context (estimated)
    let contextScore = 6;
    const contextIssues = issuesFor();
    if (metrics && metrics.links && metrics.links.external > metrics.links.internal) {
      contextScore -= 1;
      contextIssues.push({
        severity: 'info',
        message: 'Relies heavily on external links for context',
        fix: 'Ensure critical context is included in the page'
      });
    }
    if (metrics && metrics.content && metrics.content.wordCount < 200) {
      contextScore -= 1;
      contextIssues.push({
        severity: 'info',
        message: 'Low word count may indicate insufficient context',
        fix: 'Add more context so the page can stand alone'
      });
    }
    if (metrics && metrics.headings && metrics.headings.count === 0) {
      contextScore -= 1;
      contextIssues.push({
        severity: 'warning',
        message: 'No headings detected to anchor context',
        fix: 'Add headings to clarify context and structure'
      });
    }
    contextScore = Math.max(0, Math.min(10, contextScore));

    results.categories['self-contained'] = {
      id: 'CAT-09',
      name: 'Self-Contained Context',
      score: contextScore,
      weight: this.CATEGORY_WEIGHTS['self-contained'],
      criteria: {
        'EST-SC': {
          score: contextScore,
          issues: contextIssues,
          details: 'Estimated from page structure heuristics (no Claude)'
        }
      },
      issues: contextIssues,
      estimated: true,
      message: 'Estimated using heuristic checks (no Claude)'
    };
  },

  addSectionScores(results, content) {
    if (!content.sections || content.sections.length === 0) {
      return;
    }

    const buildSectionMetrics = section => {
      const paragraphLengths = section.paragraphs.map(p => p.wordCount);
      const longParagraphs = section.paragraphs.filter(p => p.wordCount > 150);
      const avgParagraphLength = paragraphLengths.length > 0
        ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
        : 0;
      const totalListItems = section.lists.reduce((sum, list) => sum + list.itemCount, 0);
      const listToParagraphRatio = section.paragraphs.length > 0
        ? section.lists.length / section.paragraphs.length
        : 0;
      const imagesWithAlt = section.images.filter(img => img.hasAlt).length;
      const altTextCoverage = section.images.length > 0
        ? imagesWithAlt / section.images.length
        : 1;
      const totalContentBlocks = section.paragraphs.length +
        section.lists.length +
        section.tables.length +
        section.codeBlocks.length;
      const visualBlocks = section.images.length + section.tables.length;
      const visualToContentRatio = totalContentBlocks > 0
        ? visualBlocks / totalContentBlocks
        : 0;

      return {
        paragraphs: {
          count: section.paragraphs.length,
          avgLength: Math.round(avgParagraphLength),
          maxLength: paragraphLengths.length > 0 ? Math.max(...paragraphLengths) : 0,
          longCount: longParagraphs.length,
          longParagraphs: longParagraphs.map((p, index) => ({
            text: p.text.substring(0, 100) + '...',
            wordCount: p.wordCount,
            index
          })),
          sentences: {
            total: 0,
            avgLength: 0,
            longCount: 0,
            complexCount: 0,
            longSamples: []
          }
        },
        headings: {
          count: section.title ? 1 : 0,
          hasH1: section.level === 1,
          hierarchyValid: { valid: true, issues: [] },
          levels: section.level ? [section.level] : [],
          distribution: section.level ? { [`h${section.level}`]: 1 } : {}
        },
        lists: {
          count: section.lists.length,
          totalItems: totalListItems,
          listToParagraphRatio: Math.round(listToParagraphRatio * 100) / 100
        },
        images: {
          count: section.images.length,
          withAlt: imagesWithAlt,
          withoutAlt: section.images.length - imagesWithAlt,
          altTextCoverage: Math.round(altTextCoverage * 100) / 100,
          imageToTextRatio: section.wordCount > 0
            ? Math.round((section.images.length / (section.wordCount / 100)) * 100) / 100
            : 0,
          missingAlt: []
        },
        content: {
          totalBlocks: totalContentBlocks,
          visualBlocks,
          visualToContentRatio: Math.round(visualToContentRatio * 100) / 100,
          wordCount: section.wordCount,
          codeBlocks: section.codeBlocks.length,
          tables: section.tables.length
        },
        links: {
          total: 0,
          internal: 0,
          external: 0
        }
      };
    };

    const sectionScores = content.sections.map(section => {
      const sectionMetrics = buildSectionMetrics(section);
      const brevity = ContentStructureRules.scoreParagraphBrevity(sectionMetrics);
      const listUsage = ContentStructureRules.scoreListUsage(sectionMetrics);
      const sectionScore = Math.round(((brevity.score + listUsage.score) / 2) * 10) / 10;

      return {
        title: section.title,
        level: section.level,
        score: sectionScore,
        criteria: {
          'CS-01': brevity,
          'CS-02': listUsage
        },
        issues: [...brevity.issues, ...listUsage.issues],
        wordCount: section.wordCount
      };
    });

    const rollupScore = sectionScores.length > 0
      ? Math.round((sectionScores.reduce((sum, section) => sum + section.score, 0) / sectionScores.length) * 10) / 10
      : null;

    if (rollupScore !== null) {
      results.categories['content-structure'].sectionScores = sectionScores;
      results.categories['content-structure'].sectionRollup = rollupScore;
      results.categories['content-structure'].score = Math.round(((results.categories['content-structure'].score + rollupScore) / 2) * 10) / 10;
    }

    results.sections = sectionScores;
  },

  /**
   * Calculate average score from criteria object
   * @param {Object} criteria - Criteria with scores
   * @returns {number} Average score
   */
  averageScores(criteria) {
    const scores = Object.values(criteria)
      .map(c => c.score)
      .filter(s => typeof s === 'number');

    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  },

  /**
   * Calculate composite score from all categories
   * @param {Object} categories - All category results
   * @returns {number} Composite score 0-10
   */
  calculateCompositeScore(categories) {
    let totalWeight = 0;
    let weightedSum = 0;

    Object.entries(categories).forEach(([key, category]) => {
      if (category.score !== null && !category.estimated) {
        const weight = category.weight || this.CATEGORY_WEIGHTS[key] || 0;
        weightedSum += category.score * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return 0;

    // Normalize if we're missing some categories
    const normalizedScore = weightedSum / totalWeight;
    return Math.round(normalizedScore * 10) / 10;
  },

  /**
   * Get status based on score
   * @param {number} score - Score 0-10
   * @returns {string} 'green', 'yellow', or 'red'
   */
  getStatus(score) {
    if (score >= this.THRESHOLDS.green) return 'green';
    if (score >= this.THRESHOLDS.yellow) return 'yellow';
    return 'red';
  },

  /**
   * Collect all issues from all categories
   * @param {Object} categories - All category results
   * @returns {Array} All issues sorted by severity
   */
  collectAllIssues(categories) {
    const severityOrder = { critical: 0, warning: 1, info: 2 };

    return Object.entries(categories)
      .flatMap(([categoryKey, category]) =>
        (category.issues || []).map(issue => ({
          ...issue,
          category: category.name,
          categoryKey
        }))
      )
      .sort((a, b) => {
        const aSev = severityOrder[a.severity] ?? 3;
        const bSev = severityOrder[b.severity] ?? 3;
        return aSev - bSev;
      });
  },

  /**
   * Get top N issues by importance
   * @param {Array} issues - All issues
   * @param {number} n - Number to return
   * @returns {Array} Top N issues
   */
  getTopIssues(issues, n = 5) {
    return issues.slice(0, n);
  },

  /**
   * Generate summary text
   * @param {Object} results - Complete results
   * @returns {string} Summary text
   */
  generateSummary(results) {
    const score = results.compositeScore;
    const status = results.status;

    let summary = '';

    if (status === 'green') {
      summary = `This documentation scores well for AI-friendliness (${score}/10). `;
    } else if (status === 'yellow') {
      summary = `This documentation needs improvement for AI-friendliness (${score}/10). `;
    } else {
      summary = `This documentation has significant AI-friendliness issues (${score}/10). `;
    }

    // Add category highlights
    const sortedCategories = Object.entries(results.categories)
      .filter(([, c]) => c.score !== null)
      .sort((a, b) => a[1].score - b[1].score);

    if (sortedCategories.length > 0) {
      const weakest = sortedCategories[0];
      const strongest = sortedCategories[sortedCategories.length - 1];

      if (weakest[1].score < 6) {
        summary += `Weakest area: ${weakest[1].name} (${weakest[1].score}/10). `;
      }
      if (strongest[1].score >= 7) {
        summary += `Strongest area: ${strongest[1].name} (${strongest[1].score}/10).`;
      }
    }

    return summary.trim();
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scorer;
}
