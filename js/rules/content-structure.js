/**
 * Content Structure Rule-Based Scoring
 * Evaluates paragraph length, list usage, and heading hierarchy
 */

const ContentStructureRules = {
  /**
   * Score paragraph brevity (CS-01)
   * Flag paragraphs over 150 words
   * @param {Object} metrics - Computed metrics from parser
   * @returns {Object} Score and issues
   */
  scoreParagraphBrevity(metrics) {
    const { paragraphs } = metrics;
    const issues = [];
    const threshold = window.ScoringConfig?.categories?.['content-structure']?.criteria?.['CS-01']?.threshold || 150;

    // No paragraphs = perfect score (likely all lists/tables)
    if (paragraphs.count === 0) {
      return {
        criterionId: 'CS-01',
        score: 10,
        issues: [],
        details: 'No paragraphs found (content may be structured as lists/tables)'
      };
    }

    // Calculate score based on percentage of paragraphs under threshold
    const underThreshold = paragraphs.count - paragraphs.longCount;
    const percentageGood = underThreshold / paragraphs.count;

    // Map to 0-10 scale
    // 100% under threshold = 10
    // 80% under threshold = 8
    // etc.
    let score = Math.round(percentageGood * 10);

    // Add issues for long paragraphs
    paragraphs.longParagraphs.forEach(p => {
      issues.push({
        severity: p.wordCount > 200 ? 'critical' : 'warning',
        message: `Paragraph ${p.index + 1} has ${p.wordCount} words (threshold: ${threshold})`,
        location: `Paragraph ${p.index + 1}`,
        excerpt: p.text,
        fix: 'Consider breaking this paragraph into bullet points or shorter sections'
      });
    });

    if (paragraphs.sentences && paragraphs.sentences.total > 0) {
      const longRatio = paragraphs.sentences.longCount / paragraphs.sentences.total;
      if (longRatio > 0.2) {
        score -= 1;
        issues.push({
          severity: 'warning',
          message: `${paragraphs.sentences.longCount} long sentences detected`,
          fix: 'Split long sentences into shorter, single-idea statements'
        });
      }

      if (paragraphs.sentences.complexCount > 0) {
        issues.push({
          severity: 'info',
          message: `${paragraphs.sentences.complexCount} sentences have multiple clauses`,
          fix: 'Reduce clause density for better readability'
        });
      }

      paragraphs.sentences.longSamples.forEach(sample => {
        issues.push({
          severity: 'info',
          message: `Long sentence in paragraph ${sample.paragraphIndex + 1} (${sample.wordCount} words)`,
          location: `Paragraph ${sample.paragraphIndex + 1}`,
          excerpt: sample.text,
          fix: 'Break this sentence into shorter sentences'
        });
      });
    }

    score = Math.max(0, Math.min(10, score));

    return {
      criterionId: 'CS-01',
      score,
      issues,
      details: `${paragraphs.longCount} of ${paragraphs.count} paragraphs exceed ${threshold} words. Average length: ${paragraphs.avgLength} words. Avg sentence length: ${paragraphs.sentences ? paragraphs.sentences.avgLength : 0} words.`
    };
  },

  /**
   * Score list usage (CS-02)
   * Check ratio of lists to paragraphs
   * @param {Object} metrics - Computed metrics
   * @returns {Object} Score and issues
   */
  scoreListUsage(metrics) {
    const { lists, paragraphs } = metrics;
    const issues = [];

    // Ideal ratio is ~0.3 (30% lists relative to paragraphs)
    const idealRatio = window.ScoringConfig?.categories?.['content-structure']?.criteria?.['CS-02']?.idealRatio || 0.3;
    const actualRatio = lists.listToParagraphRatio;

    // No content = neutral score
    if (paragraphs.count === 0 && lists.count === 0) {
      return {
        criterionId: 'CS-02',
        score: 5,
        issues: [{ severity: 'info', message: 'No paragraphs or lists found' }],
        details: 'Unable to assess list usage - no text content found'
      };
    }

    // Calculate score
    // Perfect score at ideal ratio, decreasing as we move away
    let score;
    if (actualRatio >= idealRatio) {
      // At or above ideal - good, max 10
      score = Math.min(10, 7 + (actualRatio - idealRatio) * 10);
    } else {
      // Below ideal - scale from 0-7 based on how close to ideal
      score = Math.round((actualRatio / idealRatio) * 7);
    }

    // Round to nearest integer
    score = Math.max(0, Math.min(10, Math.round(score)));

    // Add issues
    if (actualRatio < 0.1 && paragraphs.count > 3) {
      issues.push({
        severity: 'warning',
        message: 'Low list usage in procedural content',
        details: `List-to-paragraph ratio ${actualRatio} is below 0.1 (ideal: ${idealRatio})`,
        fix: 'Consider converting step-by-step instructions into numbered lists'
      });
    }

    if (lists.proceduralCount > 0 && lists.orderedCount === 0) {
      score -= 1;
      issues.push({
        severity: 'warning',
        message: 'Procedural lists are not ordered',
        fix: 'Use numbered lists for step-by-step instructions'
      });
    }

    if (lists.descriptiveCount > 0 && lists.proceduralCount === 0 && lists.count > 0) {
      issues.push({
        severity: 'info',
        message: 'Lists appear descriptive rather than procedural',
        fix: 'Ensure procedural steps are captured in ordered lists'
      });
    }

    score = Math.max(0, score);

    return {
      criterionId: 'CS-02',
      score,
      issues,
      details: `List-to-paragraph ratio: ${actualRatio} (ideal: ${idealRatio}). ${lists.count} lists with ${lists.totalItems} total items. Procedural lists: ${lists.proceduralCount}, descriptive lists: ${lists.descriptiveCount}.`
    };
  },

  /**
   * Score heading hierarchy (CS-04)
   * Validate proper H1->H2->H3 structure
   * @param {Object} metrics - Computed metrics
   * @returns {Object} Score and issues
   */
  scoreHeadingHierarchy(metrics) {
    const { headings } = metrics;
    const issues = [];

    // No headings
    if (headings.count === 0) {
      return {
        criterionId: 'CS-04',
        score: 3,
        issues: [{
          severity: 'critical',
          message: 'No headings found',
          fix: 'Add descriptive headings to structure the content'
        }],
        details: 'Page has no heading structure'
      };
    }

    let score = 10;

    // Check for H1
    if (!headings.hasH1) {
      score -= 2;
      issues.push({
        severity: 'warning',
        message: 'Page lacks an H1 heading',
        details: 'Expected a single H1 to establish page context',
        fix: 'Add a clear H1 heading that describes the page purpose'
      });
    }

    // Check for multiple H1s
    if (headings.h1Count > 1) {
      score -= 1;
      issues.push({
        severity: 'warning',
        message: `Multiple H1 headings found (${headings.h1Count})`,
        fix: 'Use a single H1 for the page title and demote others to H2/H3'
      });
    }

    // Check for missing hierarchy context (starts too deep)
    if (headings.firstLevel && headings.firstLevel > 1) {
      score -= 1;
      issues.push({
        severity: 'warning',
        message: `First heading starts at h${headings.firstLevel}`,
        fix: 'Start with an H1 heading to establish page context'
      });
    }

    // Check for missing H2 when deeper levels exist
    if (!headings.hasH2 && headings.levels.some(level => level >= 3)) {
      score -= 1;
      issues.push({
        severity: 'warning',
        message: 'Missing H2 headings before deeper sections',
        fix: 'Add H2 headings to group sections before using H3/H4'
      });
    }

    // Check hierarchy
    if (!headings.hierarchyValid.valid) {
      const skipCount = headings.hierarchyValid.issues.length;
      score -= Math.min(5, skipCount * 2);

      headings.hierarchyValid.issues.forEach(issue => {
        issues.push({
          severity: 'warning',
          message: issue.message,
          location: `Heading ${issue.index + 1}`,
          details: 'Detected a skipped heading level in the hierarchy',
          fix: 'Maintain proper heading hierarchy without skipping levels'
        });
      });
    }

    // Check heading count relative to content
    const headingsPerContentBlock = headings.count / Math.max(1, metrics.content.totalBlocks);
    if (headingsPerContentBlock < 0.05 && metrics.content.totalBlocks > 10) {
      score -= 1;
      issues.push({
        severity: 'info',
        message: 'Content could benefit from more section headings',
        details: `Headings per block ${headingsPerContentBlock.toFixed(2)} is below 0.05`,
        fix: 'Add subheadings to break up long sections'
      });
    }

    return {
      criterionId: 'CS-04',
      score: Math.max(0, score),
      issues,
      details: `${headings.count} headings found. Distribution: ${JSON.stringify(headings.distribution)}`
    };
  },

  /**
   * Score link integrity (CS-07)
   * Flag broken internal anchors
   * @param {Object} metrics - Computed metrics
   * @returns {Object} Score and issues
   */
  scoreLinkIntegrity(metrics) {
    const { links } = metrics;
    const issues = [];

    if (!links || links.total === 0) {
      return {
        criterionId: 'CS-07',
        score: 10,
        issues: [],
        details: 'No links found'
      };
    }

    const brokenRatio = links.total > 0 ? links.brokenCount / links.total : 0;
    let score = Math.round((1 - brokenRatio) * 10);

    if (links.brokenCount > 0) {
      issues.push({
        severity: brokenRatio > 0.2 ? 'warning' : 'info',
        message: `${links.brokenCount} broken internal anchors detected`,
        details: `Broken link ratio: ${(brokenRatio * 100).toFixed(0)}%`,
        fix: 'Update or remove broken anchors and ensure targets exist'
      });

      links.brokenLinks.slice(0, 5).forEach(link => {
        issues.push({
          severity: 'info',
          message: 'Broken anchor link',
          location: link.href,
          details: link.reason || 'Missing anchor target',
          fix: 'Add the anchor target or update the link'
        });
      });
    }

    return {
      criterionId: 'CS-07',
      score: Math.max(0, Math.min(10, score)),
      issues,
      details: `${links.brokenCount} broken anchors out of ${links.total} total links.`
    };
  },

  /**
   * Run all content structure rules
   * @param {Object} metrics - Computed metrics
   * @returns {Object} Combined results
   */
  scoreAll(metrics) {
    const results = {
      categoryId: 'CAT-01',
      categoryName: 'Content Structure',
      criteria: {}
    };

    // Run each rule
    results.criteria['CS-01'] = this.scoreParagraphBrevity(metrics);
    results.criteria['CS-02'] = this.scoreListUsage(metrics);
    results.criteria['CS-04'] = this.scoreHeadingHierarchy(metrics);
    results.criteria['CS-07'] = this.scoreLinkIntegrity(metrics);

    // Calculate category score (weighted average)
    const configWeights = window.ScoringConfig?.categories?.['content-structure']?.criteria || {};
    const weights = {
      'CS-01': configWeights['CS-01']?.weight || 0.35,
      'CS-02': configWeights['CS-02']?.weight || 0.30,
      'CS-04': configWeights['CS-04']?.weight || 0.35,
      'CS-07': configWeights['CS-07']?.weight || 0.10
    };
    let totalWeight = 0;
    let weightedSum = 0;

    Object.entries(results.criteria).forEach(([id, result]) => {
      const weight = weights[id] || 0.33;
      weightedSum += result.score * weight;
      totalWeight += weight;
    });

    results.categoryScore = Math.round((weightedSum / totalWeight) * 10) / 10;

    // Collect all issues
    results.allIssues = Object.values(results.criteria)
      .flatMap(c => c.issues)
      .sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    return results;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentStructureRules;
}
