/**
 * Terminology Consistency Rule-Based Scoring
 * Detects inconsistent action terms and potentially confusable vocabulary
 */

const TerminologyRules = {
  // Confusable term groups (terms that are often incorrectly used interchangeably)
  CONFUSABLE_TERMS: {
    'deactivate': ['disable', 'turn off', 'switch off', 'inactivate'],
    'delete': ['remove', 'erase', 'clear', 'discard', 'trash'],
    'enable': ['activate', 'turn on', 'switch on'],
    'create': ['add', 'make', 'new', 'generate'],
    'edit': ['modify', 'change', 'update', 'alter'],
    'save': ['store', 'keep', 'preserve'],
    'cancel': ['abort', 'stop', 'terminate', 'end'],
    'connect': ['link', 'attach', 'join', 'integrate'],
    'disconnect': ['unlink', 'detach', 'separate', 'remove connection'],
    'configure': ['set up', 'setup', 'customize', 'adjust'],
    'install': ['set up', 'add', 'deploy'],
    'uninstall': ['remove', 'delete', 'uninstall']
  },

  // Common action verbs in documentation
  ACTION_VERBS: [
    'click', 'select', 'choose', 'enter', 'type', 'drag', 'drop',
    'scroll', 'hover', 'press', 'tap', 'swipe', 'navigate', 'go to',
    'open', 'close', 'expand', 'collapse', 'toggle', 'check', 'uncheck'
  ],

  STOP_WORDS: new Set([
    'the', 'and', 'that', 'this', 'with', 'from', 'your', 'you', 'for', 'are', 'was', 'were',
    'will', 'have', 'has', 'had', 'then', 'than', 'into', 'onto', 'over', 'under', 'after',
    'before', 'when', 'where', 'what', 'which', 'who', 'whom', 'why', 'how', 'can', 'cannot',
    'could', 'should', 'would', 'not', 'yes', 'no', 'use', 'using', 'used', 'via', 'per', 'each'
  ]),

  normalizeTerm(term) {
    return term
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/(ing|ed|es|s)$/i, '');
  },

  extractTerminologyClusters(content) {
    const text = content.text.fullText.toLowerCase();
    const tokens = text.split(/[^a-z0-9-]+/).filter(Boolean);
    const clusters = {};

    tokens.forEach(token => {
      if (token.length < 4 || this.STOP_WORDS.has(token)) return;
      const root = this.normalizeTerm(token);
      if (!root || root.length < 3) return;
      if (!clusters[root]) {
        clusters[root] = { variants: {}, total: 0 };
      }
      clusters[root].variants[token] = (clusters[root].variants[token] || 0) + 1;
      clusters[root].total += 1;
    });

    return clusters;
  },

  /**
   * Extract all action terms from the content
   * @param {Object} content - Normalized content
   * @returns {Object} Map of terms and their occurrences
   */
  extractActionTerms(content) {
    const text = content.text.fullText.toLowerCase();
    const terms = {};

    // Check each confusable term group
    Object.entries(this.CONFUSABLE_TERMS).forEach(([primary, variants]) => {
      const allTerms = [primary, ...variants];

      allTerms.forEach(term => {
        // Use word boundary regex to find exact matches
        const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        const matches = text.match(regex);

        if (matches && matches.length > 0) {
          if (!terms[primary]) {
            terms[primary] = { variants: {}, total: 0 };
          }
          terms[primary].variants[term] = matches.length;
          terms[primary].total += matches.length;
        }
      });
    });

    return terms;
  },

  /**
   * Score term consistency (AV-01)
   * Check if same terms are used consistently
   * @param {Object} content - Normalized content
   * @returns {Object} Score and issues
   */
  scoreTermConsistency(content) {
    const terms = this.extractActionTerms(content);
    const clusters = this.extractTerminologyClusters(content);
    const issues = [];
    let inconsistentGroups = 0;
    let totalGroups = 0;
    let clusterInconsistencies = 0;

    Object.entries(terms).forEach(([primary, data]) => {
      const variantsUsed = Object.keys(data.variants);

      if (variantsUsed.length > 1) {
        totalGroups++;

        // Check if multiple variants are used (inconsistency)
        const variantCounts = Object.entries(data.variants);
        const mostUsed = variantCounts.sort((a, b) => b[1] - a[1])[0];
        const otherVariants = variantCounts.filter(([term]) => term !== mostUsed[0]);

        if (otherVariants.length > 0) {
          inconsistentGroups++;

          // Only flag if there's meaningful inconsistency (not just 1 occurrence)
          const significantVariants = otherVariants.filter(([, count]) => count > 1);

          if (significantVariants.length > 0 || otherVariants.reduce((sum, [, c]) => sum + c, 0) > 2) {
            issues.push({
              severity: 'warning',
              message: `Inconsistent terminology: "${primary}" concept uses multiple terms`,
              details: `Found: ${variantCounts.map(([t, c]) => `"${t}" (${c}x)`).join(', ')}`,
              fix: `Standardize on "${mostUsed[0]}" throughout the documentation`
            });
          }
        }
      }
    });

    Object.entries(clusters).forEach(([root, data]) => {
      const variantsUsed = Object.keys(data.variants);
      const significantVariants = variantsUsed.filter(term => data.variants[term] >= 2);
      if (significantVariants.length < 2 || data.total < 4) return;

      const pluralOnly = significantVariants.every(term => term === root || term === `${root}s`);
      if (pluralOnly) return;

      clusterInconsistencies += 1;
      issues.push({
        severity: 'info',
        message: `Potential terminology variants for "${root}"`,
        details: `Found: ${significantVariants.map(term => `"${term}" (${data.variants[term]}x)`).join(', ')}`,
        fix: `Standardize on a single term for "${root}" where possible`
      });
    });

    // Calculate score
    let score = 10;
    if (totalGroups > 0) {
      const consistencyRate = 1 - (inconsistentGroups / totalGroups);
      score = Math.round(consistencyRate * 10);
    }

    // Adjust for severity
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    score = Math.max(0, score - criticalIssues * 2 - Math.min(3, clusterInconsistencies));

    return {
      criterionId: 'AV-01',
      score,
      issues,
      details: `Analyzed ${totalGroups} term groups. ${inconsistentGroups} have inconsistent usage. ${clusterInconsistencies} potential synonym clusters detected.`,
      termAnalysis: terms
    };
  },

  /**
   * Detect confusable terms that might cause ambiguity (AV-02)
   * @param {Object} content - Normalized content
   * @returns {Object} Score and issues
   */
  detectConfusableTerms(content) {
    const text = content.text.fullText.toLowerCase();
    const issues = [];

    // High-risk confusable pairs (these really matter for AI understanding)
    const highRiskPairs = [
      { terms: ['delete', 'remove'], context: 'data operations' },
      { terms: ['deactivate', 'disable'], context: 'state changes' },
      { terms: ['uninstall', 'remove'], context: 'application management' }
    ];

    highRiskPairs.forEach(({ terms, context }) => {
      const counts = terms.map(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const matches = text.match(regex);
        return { term, count: matches ? matches.length : 0 };
      }).filter(t => t.count > 0);

      // Both terms present = potential confusion
      if (counts.length > 1) {
        issues.push({
          severity: 'warning',
          message: `Potentially confusable terms in ${context}: ${counts.map(c => `"${c.term}"`).join(' and ')}`,
          details: counts.map(c => `"${c.term}" used ${c.count}x`).join(', '),
          fix: `Ensure "${terms[0]}" and "${terms[1]}" have clearly distinct meanings or standardize on one term`
        });
      }
    });

    // Calculate score
    const score = Math.max(0, 10 - issues.length * 2);

    return {
      criterionId: 'AV-02',
      score,
      issues,
      details: `Checked ${highRiskPairs.length} high-risk term pairs`
    };
  },

  /**
   * Run all terminology rules
   * @param {Object} content - Normalized content
   * @returns {Object} Combined results
   */
  scoreAll(content) {
    const results = {
      categoryId: 'CAT-02',
      categoryName: 'Consistent Terminology',
      criteria: {}
    };

    results.criteria['AV-01'] = this.scoreTermConsistency(content);
    results.criteria['AV-02'] = this.detectConfusableTerms(content);

    // Calculate category score
    const configWeights = window.ScoringConfig?.categories?.['terminology']?.criteria || {};
    const weights = {
      'AV-01': configWeights['AV-01']?.weight || 0.6,
      'AV-02': configWeights['AV-02']?.weight || 0.4
    };
    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(results.criteria).forEach(([id, result]) => {
      const weight = weights[id] || 0.5;
      weightedSum += result.score * weight;
      totalWeight += weight;
    });

    results.categoryScore = Math.round((weightedSum / totalWeight) * 10) / 10;

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
  module.exports = TerminologyRules;
}
