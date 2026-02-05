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
    const longParagraphs = structure.paragraphs.filter(p => p.wordCount > 150);
    const avgParagraphLength = paragraphLengths.length > 0
      ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
      : 0;

    // Heading metrics
    const headingLevels = structure.headings.map(h => parseInt(h.level.replace('h', '')));
    const h1Count = headingLevels.filter(level => level === 1).length;
    const h2Count = headingLevels.filter(level => level === 2).length;
    const hasH1 = h1Count > 0;
    const hasH2 = h2Count > 0;
    const firstHeadingLevel = headingLevels.length > 0 ? headingLevels[0] : null;
    const headingHierarchyValid = this.validateHeadingHierarchy(headingLevels);

    // List metrics
    const totalListItems = structure.lists.reduce((sum, list) => sum + list.itemCount, 0);
    const proceduralVerbPattern = /^(click|select|choose|open|go to|enter|type|add|remove|delete|enable|disable|run|install|configure|create|update|save|set|navigate|verify|copy|paste|upload|download|edit|apply|start|stop|restart|connect|sign in|log in|sign out|logout)\b/i;
    const isProceduralItem = text =>
      proceduralVerbPattern.test(text.trim()) || /^step\s+\d+/i.test(text.trim());
    const listAnalysis = structure.lists.map(list => {
      const proceduralItems = list.items.filter(item => isProceduralItem(item)).length;
      const procedural = list.type === 'ol' || proceduralItems >= Math.max(1, Math.ceil(list.items.length * 0.3));
      return {
        type: list.type,
        procedural
      };
    });
    const orderedCount = listAnalysis.filter(list => list.type === 'ol').length;
    const proceduralCount = listAnalysis.filter(list => list.procedural).length;
    const descriptiveCount = listAnalysis.length - proceduralCount;
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
      structure.codeBlocks.length +
      structure.callouts.length;
    const visualBlocks = structure.images.length + structure.tables.length;
    const visualToContentRatio = totalContentBlocks > 0
      ? visualBlocks / totalContentBlocks
      : 0;

    // Link metrics
    const internalLinks = structure.links.filter(l => l.type === 'internal').length;
    const externalLinks = structure.links.filter(l => l.type === 'external').length;

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
        hasH2,
        h1Count,
        h2Count,
        firstLevel: firstHeadingLevel,
        hierarchyValid: headingHierarchyValid,
        levels: headingLevels,
        distribution: this.getHeadingDistribution(headingLevels)
      },
      lists: {
        count: structure.lists.length,
        totalItems: totalListItems,
        listToParagraphRatio: Math.round(listToParagraphRatio * 100) / 100,
        orderedCount,
        proceduralCount,
        descriptiveCount
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
        tables: structure.tables.length,
        callouts: structure.callouts.length
      },
      links: {
        total: structure.links.length,
        internal: internalLinks,
        external: externalLinks
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

    // Add callouts/notes
    if (content.structure.callouts && content.structure.callouts.length > 0) {
      sections.push('\n## Callouts:');
      content.structure.callouts.forEach((callout, i) => {
        sections.push(`[Callout ${i + 1} - ${callout.type}] ${callout.text}`);
      });
    }

    // Add tables (limited rows for brevity)
    if (content.structure.tables.length > 0) {
      const maxTables = 3;
      const maxRows = 3;
      const normalizeCell = value => value.replace(/\s+/g, ' ').trim();
      const formatRow = row => `| ${row.map(normalizeCell).join(' | ')} |`;

      content.structure.tables.slice(0, maxTables).forEach((table, i) => {
        const title = table.caption ? ` - ${table.caption}` : '';
        sections.push(`\n## Table ${i + 1}${title}`);
        if (table.headers && table.headers.length > 0) {
          sections.push(formatRow(table.headers));
          sections.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
        }
        if (table.rows && table.rows.length > 0) {
          table.rows.slice(0, maxRows).forEach(row => {
            if (row.length > 0) {
              sections.push(formatRow(row));
            }
          });
        }
      });
    }

    // Add code blocks (block-level only, limited)
    if (content.structure.codeBlocks.length > 0) {
      const blockCode = content.structure.codeBlocks.filter(block => block.type !== 'inline');
      if (blockCode.length > 0) {
        const maxCodeBlocks = 3;
        sections.push('\n## Code Blocks:');
        blockCode.slice(0, maxCodeBlocks).forEach((block, i) => {
          const language = block.language && block.language !== 'unknown' ? block.language : '';
          const trimmed = block.content.length > 500 ? `${block.content.slice(0, 500)}...` : block.content;
          sections.push(`[Code ${i + 1}]`);
          sections.push(`\`\`\`${language}`);
          sections.push(trimmed);
          sections.push('```');
        });
      }
    }

    return sections.join('\n').trim();
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Parser;
}
