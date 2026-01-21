/**
 * Export module for generating Markdown reports
 * Creates downloadable reports from scoring results
 */

const Export = {
  /**
   * Generate a complete Markdown report
   * @param {Object} results - Scoring results from Scorer
   * @returns {string} Markdown report
   */
  generateMarkdownReport(results) {
    const lines = [];

    // Header
    lines.push(`# AI-Friendliness Score Report`);
    lines.push('');
    lines.push(`**Page:** ${results.meta.title}`);
    lines.push(`**URL:** ${results.meta.url}`);
    lines.push(`**Scored:** ${new Date(results.meta.scoredAt).toLocaleString()}`);
    lines.push(`**Mode:** ${results.meta.mode === 'full' ? 'Full Analysis (Rules + AI)' : 'Rule-Based Only'}`);
    lines.push('');

    // Summary Score
    lines.push('---');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| **Composite Score** | ${results.compositeScore}/10 ${this.getStatusEmoji(results.status)} |`);
    lines.push(`| **Status** | ${this.getStatusLabel(results.status)} |`);
    lines.push('');
    lines.push(`> ${results.summary}`);
    lines.push('');

    // Category Breakdown
    lines.push('---');
    lines.push('');
    lines.push('## Category Breakdown');
    lines.push('');
    lines.push('| Category | Score | Weight | Status |');
    lines.push('|----------|-------|--------|--------|');

    Object.entries(results.categories)
      .sort((a, b) => (b[1].weight || 0) - (a[1].weight || 0))
      .forEach(([key, category]) => {
        const score = category.estimated ? 'N/A' : `${category.score}/10`;
        const weight = Math.round((category.weight || 0) * 100);
        const status = category.estimated ? '-' : this.getStatusEmoji(Scorer.getStatus(category.score));
        lines.push(`| ${category.name} | ${score} | ${weight}% | ${status} |`);
      });

    lines.push('');

    // Top Issues
    if (results.topIssues && results.topIssues.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## Top Issues to Fix');
      lines.push('');

      results.topIssues.forEach((issue, index) => {
        lines.push(`### ${index + 1}. ${issue.message}`);
        lines.push('');
        lines.push(`- **Category:** ${issue.category}`);
        lines.push(`- **Severity:** ${this.getSeverityLabel(issue.severity)}`);
        if (issue.location) {
          lines.push(`- **Location:** ${issue.location}`);
        }
        if (issue.details) {
          lines.push(`- **Details:** ${issue.details}`);
        }
        if (issue.fix) {
          lines.push(`- **Suggested Fix:** ${issue.fix}`);
        }
        if (issue.excerpt) {
          lines.push('- **Excerpt:**');
          lines.push(`  > ${issue.excerpt}`);
        }
        lines.push('');
      });
    }

    // Detailed Category Reports
    lines.push('---');
    lines.push('');
    lines.push('## Detailed Category Analysis');
    lines.push('');

    Object.entries(results.categories).forEach(([key, category]) => {
      lines.push(`### ${category.name}`);
      lines.push('');

      if (category.estimated) {
        lines.push(`*${category.message}*`);
        lines.push('');
        return;
      }

      lines.push(`**Score:** ${category.score}/10 ${this.getStatusEmoji(Scorer.getStatus(category.score))}`);
      lines.push('');

      // Criteria breakdown
      if (Object.keys(category.criteria).length > 0) {
        lines.push('#### Criteria Scores');
        lines.push('');
        lines.push('| Criterion | Score | Details |');
        lines.push('|-----------|-------|---------|');

        Object.entries(category.criteria).forEach(([criterionId, criterion]) => {
          const details = criterion.details
            ? criterion.details.substring(0, 60) + (criterion.details.length > 60 ? '...' : '')
            : '-';
          lines.push(`| ${criterionId} | ${criterion.score}/10 | ${details} |`);
        });

        lines.push('');
      }

      // Issues for this category
      const categoryIssues = (category.issues || []).filter(i => i.severity !== 'info');
      if (categoryIssues.length > 0) {
        lines.push('#### Issues');
        lines.push('');
        categoryIssues.forEach(issue => {
          const severity = this.getSeverityIcon(issue.severity);
          lines.push(`- ${severity} ${issue.message}`);
          if (issue.fix) {
            lines.push(`  - *Fix:* ${issue.fix}`);
          }
        });
        lines.push('');
      }
    });

    // All Issues (condensed)
    if (results.allIssues && results.allIssues.length > 5) {
      lines.push('---');
      lines.push('');
      lines.push('## All Issues');
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>Click to expand all issues</summary>');
      lines.push('');

      results.allIssues.forEach(issue => {
        const severity = this.getSeverityIcon(issue.severity);
        lines.push(`- ${severity} **[${issue.category}]** ${issue.message}`);
      });

      lines.push('');
      lines.push('</details>');
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*Generated by AI Help Doc Scoring Tool*');
    lines.push('');

    return lines.join('\n');
  },

  /**
   * Generate JSON export
   * @param {Object} results - Scoring results
   * @returns {string} JSON string
   */
  generateJsonExport(results) {
    return JSON.stringify(results, null, 2);
  },

  /**
   * Generate CSV export of category scores
   * @param {Object} results - Scoring results
   * @returns {string} CSV string
   */
  generateCsvExport(results) {
    const lines = [];
    lines.push('Category,Score,Weight,Status');

    Object.entries(results.categories).forEach(([key, category]) => {
      const score = category.estimated ? '' : category.score;
      const weight = Math.round((category.weight || 0) * 100);
      const status = category.estimated ? 'N/A' : Scorer.getStatus(category.score);
      lines.push(`"${category.name}",${score},${weight}%,${status}`);
    });

    lines.push(`"Composite Score",${results.compositeScore},100%,${results.status}`);

    return lines.join('\n');
  },

  /**
   * Download a file
   * @param {string} content - File content
   * @param {string} filename - File name
   * @param {string} mimeType - MIME type
   */
  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Download Markdown report
   * @param {Object} results - Scoring results
   */
  downloadMarkdown(results) {
    const content = this.generateMarkdownReport(results);
    const filename = this.sanitizeFilename(results.meta.title) + '_score_report.md';
    this.downloadFile(content, filename, 'text/markdown');
  },

  /**
   * Download JSON export
   * @param {Object} results - Scoring results
   */
  downloadJson(results) {
    const content = this.generateJsonExport(results);
    const filename = this.sanitizeFilename(results.meta.title) + '_score_data.json';
    this.downloadFile(content, filename, 'application/json');
  },

  /**
   * Copy report to clipboard
   * @param {Object} results - Scoring results
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(results) {
    const content = this.generateMarkdownReport(results);
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      return false;
    }
  },

  // Helper methods
  getStatusEmoji(status) {
    const emojis = { green: '(Good)', yellow: '(Warning)', red: '(Critical)' };
    return emojis[status] || '';
  },

  getStatusLabel(status) {
    const labels = { green: 'Good', yellow: 'Needs Work', red: 'Critical' };
    return labels[status] || status;
  },

  getSeverityLabel(severity) {
    const labels = { critical: 'Critical', warning: 'Warning', info: 'Info' };
    return labels[severity] || severity;
  },

  getSeverityIcon(severity) {
    const icons = { critical: '[!]', warning: '[~]', info: '[i]' };
    return icons[severity] || '[-]';
  },

  sanitizeFilename(name) {
    return (name || 'report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Export;
}
