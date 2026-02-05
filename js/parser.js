/**
 * Parser module for processing bookmarklet payload
 * Validates and normalizes extracted content for scoring
 */

const Parser = {
  /**
   * Validate the structure of extracted content
   * @param {Object} content - Raw content from bookmarklet
   * @returns {Object} Validation result with isValid and errors
   */
  validate(content) {
    const errors = [];

    if (!content) {
      errors.push('Content is null or undefined');
      return { isValid: false, errors };
    }

    if (!content.meta || !content.meta.url) {
      errors.push('Missing meta information or URL');
    }

    if (!content.structure) {
      errors.push('Missing structure data');
    }

    if (!content.text || typeof content.text.fullText !== 'string') {
      errors.push('Missing or invalid text content');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Normalize and enrich the extracted content
   * @param {Object} content - Raw content from bookmarklet
   * @returns {Object} Normalized content with computed metrics
   */
  normalize(content) {
    const validation = this.validate(content);
    if (!validation.isValid) {
      throw new Error(`Invalid content: ${validation.errors.join(', ')}`);
    }

    return {
      ...content,
      metrics: this.computeMetrics(content),
      normalized: true
    };
  },

  /**
   * Compute metrics from the content structure
   * @param {Object} content - Validated content
   * @returns {Object} Computed metrics for scoring
   */
  computeMetrics(content) {
    const { structure, text } = content;

    // Paragraph metrics
    const paragraphLengths = structure.paragraphs.map(p => p.wordCount);
    const paragraphThreshold = window.ScoringConfig?.categories?.['content-structure']?.criteria?.['CS-01']?.threshold || 150;
    const longParagraphs = structure.paragraphs.filter(p => p.wordCount > paragraphThreshold);
    const avgParagraphLength = paragraphLengths.length > 0
      ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
      : 0;

    // Heading metrics
    const headingLevels = structure.headings.map(h => parseInt(h.level.replace('h', '')));
    const hasH1 = headingLevels.includes(1);
    const headingHierarchyValid = this.validateHeadingHierarchy(headingLevels);

    // List metrics
    const totalListItems = structure.lists.reduce((sum, list) => sum + list.itemCount, 0);
    const listToParagraphRatio = structure.paragraphs.length > 0
      ? structure.lists.length / structure.paragraphs.length
      : 0;

    // Image metrics
    const imagesWithAlt = structure.images.filter(img => img.hasAlt).length;
    const altTextCoverage = structure.images.length > 0
      ? imagesWithAlt / structure.images.length
      : 1; // No images = full coverage
    const imageToTextRatio = text.wordCount > 0
      ? structure.images.length / (text.wordCount / 100) // images per 100 words
      : 0;

    // Content blocks (for text-over-visuals calculation)
    const totalContentBlocks =
      structure.paragraphs.length +
      structure.lists.length +
      structure.tables.length +
      structure.codeBlocks.length;
    const visualBlocks = structure.images.length + structure.tables.length;
    const visualToContentRatio = totalContentBlocks > 0
      ? visualBlocks / totalContentBlocks
      : 0;

    // Link metrics
    const internalLinks = structure.links.filter(l => l.type === 'internal').length;
    const externalLinks = structure.links.filter(l => l.type === 'external').length;
    const brokenLinks = structure.links.filter(l => l.isBroken);

    return {
      paragraphs: {
        count: structure.paragraphs.length,
        avgLength: Math.round(avgParagraphLength),
        maxLength: paragraphLengths.length > 0 ? Math.max(...paragraphLengths) : 0,
        longCount: longParagraphs.length,
        longParagraphs: longParagraphs.map(p => ({
          text: p.text.substring(0, 100) + '...',
          wordCount: p.wordCount,
          index: p.index
        }))
      },
      headings: {
        count: structure.headings.length,
        hasH1,
        hierarchyValid: headingHierarchyValid,
        levels: headingLevels,
        distribution: this.getHeadingDistribution(headingLevels)
      },
      lists: {
        count: structure.lists.length,
        totalItems: totalListItems,
        listToParagraphRatio: Math.round(listToParagraphRatio * 100) / 100
      },
      images: {
        count: structure.images.length,
        withAlt: imagesWithAlt,
        withoutAlt: structure.images.length - imagesWithAlt,
        altTextCoverage: Math.round(altTextCoverage * 100) / 100,
        imageToTextRatio: Math.round(imageToTextRatio * 100) / 100,
        missingAlt: structure.images.filter(img => !img.hasAlt).map(img => ({
          src: img.src,
          index: img.index
        }))
      },
      content: {
        totalBlocks: totalContentBlocks,
        visualBlocks,
        visualToContentRatio: Math.round(visualToContentRatio * 100) / 100,
        wordCount: text.wordCount,
        codeBlocks: structure.codeBlocks.length,
        tables: structure.tables.length
      },
      links: {
        total: structure.links.length,
        internal: internalLinks,
        external: externalLinks,
        brokenCount: brokenLinks.length,
        brokenLinks: brokenLinks.map(link => ({
          href: link.href,
          reason: link.reason,
          index: link.index
        }))
      }
    };
  },

  /**
   * Validate heading hierarchy (h1 -> h2 -> h3, no skipping levels)
   * @param {number[]} levels - Array of heading levels
   * @returns {Object} Hierarchy validation result
   */
  validateHeadingHierarchy(levels) {
    if (levels.length === 0) {
      return { valid: true, issues: [] };
    }

    const issues = [];
    let previousLevel = 0;

    for (let i = 0; i < levels.length; i++) {
      const currentLevel = levels[i];

      // Check for skipped levels (e.g., h1 -> h3)
      if (currentLevel > previousLevel + 1 && previousLevel !== 0) {
        issues.push({
          type: 'skipped',
          message: `Heading level skipped from h${previousLevel} to h${currentLevel}`,
          index: i
        });
      }

      previousLevel = currentLevel;
    }

    return {
      valid: issues.length === 0,
      issues
    };
  },

  /**
   * Get distribution of heading levels
   * @param {number[]} levels - Array of heading levels
   * @returns {Object} Count of each heading level
   */
  getHeadingDistribution(levels) {
    return levels.reduce((dist, level) => {
      const key = `h${level}`;
      dist[key] = (dist[key] || 0) + 1;
      return dist;
    }, {});
  },

  /**
   * Extract text suitable for Claude analysis
   * @param {Object} content - Normalized content
   * @returns {string} Cleaned text for analysis
   */
  getTextForAnalysis(content) {
    const sections = [];

    // Add title
    if (content.meta.title) {
      sections.push(`# ${content.meta.title}`);
    }

    // Add structured content with headings preserved
    if (content.structure.headings.length > 0) {
      let currentText = '';

      for (const heading of content.structure.headings) {
        const prefix = '#'.repeat(parseInt(heading.level.replace('h', '')));
        currentText += `\n\n${prefix} ${heading.text}`;
      }

      sections.push(currentText);
    }

    // Add paragraphs
    if (content.structure.paragraphs.length > 0) {
      sections.push('\n## Content Paragraphs:');
      content.structure.paragraphs.forEach((p, i) => {
        sections.push(`[P${i + 1}] ${p.text}`);
      });
    }

    // Add lists
    if (content.structure.lists.length > 0) {
      sections.push('\n## Lists:');
      content.structure.lists.forEach((list, i) => {
        sections.push(`[List ${i + 1} - ${list.type}]`);
        list.items.forEach((item, j) => {
          const marker = list.type === 'ol' ? `${j + 1}.` : '-';
          sections.push(`  ${marker} ${item}`);
        });
      });
    }

    return sections.join('\n').trim();
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Parser;
}
