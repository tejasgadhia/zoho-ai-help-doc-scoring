/**
 * Text Over Visuals Rule-Based Scoring
 * Evaluates whether instructions are text-based rather than image-dependent
 */

const TextOverVisualsRules = {
  /**
   * Score text-first instructions (TB-01)
   * Flag pages that rely too heavily on images for instructions
   * @param {Object} metrics - Computed metrics
   * @param {Object} content - Full content for context
   * @returns {Object} Score and issues
   */
  scoreTextFirst(metrics, content) {
    const { images, content: contentMetrics, paragraphs } = metrics;
    const issues = [];

    // No images = perfect score for text-first
    if (images.count === 0) {
      return {
        criterionId: 'TB-01',
        score: 10,
        issues: [],
        details: 'No images found - content is fully text-based'
      };
    }

    // Calculate image density (images per 100 words)
    const imageDensity = images.imageToTextRatio;

    // Check for image-heavy content
    // Ideal: < 1 image per 100 words for procedural content
    let score = 10;

    if (imageDensity > 2) {
      // Very image-heavy
      score = 4;
      issues.push({
        severity: 'critical',
        message: 'Content is heavily image-dependent',
        details: `${images.count} images for ${contentMetrics.wordCount} words (${imageDensity} images per 100 words)`,
        fix: 'Add text descriptions for key steps shown in images. AI assistants cannot interpret screenshots.'
      });
    } else if (imageDensity > 1) {
      // Moderately image-heavy
      score = 6;
      issues.push({
        severity: 'warning',
        message: 'Content relies significantly on images',
        details: `${images.count} images for ${contentMetrics.wordCount} words`,
        fix: 'Ensure each image has accompanying text that describes the action or concept'
      });
    } else if (imageDensity > 0.5) {
      // Acceptable but could improve
      score = 8;
      issues.push({
        severity: 'info',
        message: 'Good text-to-image balance, minor improvements possible',
        fix: 'Consider adding brief text summaries for complex diagrams'
      });
    }

    // Additional check: look for instruction-heavy pages with many images
    const hasProceduralContent = content.structure.lists.some(list =>
      list.type === 'ol' || list.items.some(item =>
        /^(step|click|select|go to|navigate|open)/i.test(item)
      )
    );

    if (hasProceduralContent && images.count > 5) {
      score = Math.min(score, 7);
      issues.push({
        severity: 'warning',
        message: 'Procedural content with many screenshots',
        details: `${images.count} images with procedural lists detected`,
        fix: 'Ensure step text is complete without needing to reference images'
      });
    }

    return {
      criterionId: 'TB-01',
      score,
      issues,
      details: `Image density: ${imageDensity} images per 100 words. ${images.count} images total.`
    };
  },

  /**
   * Score image ratio (TB-02)
   * Check visual to content block ratio
   * @param {Object} metrics - Computed metrics
   * @returns {Object} Score and issues
   */
  scoreImageRatio(metrics) {
    const { content: contentMetrics, images } = metrics;
    const issues = [];

    const ratio = contentMetrics.visualToContentRatio;
    const idealMax = 0.33; // Visuals should be max 33% of content blocks

    // No content blocks (unlikely but handle it)
    if (contentMetrics.totalBlocks === 0) {
      return {
        criterionId: 'TB-02',
        score: 5,
        issues: [{ severity: 'info', message: 'Unable to assess - no content blocks found' }],
        details: 'No content blocks to analyze'
      };
    }

    let score;
    if (ratio <= idealMax) {
      // Good ratio - scale 8-10
      score = 8 + Math.round((1 - ratio / idealMax) * 2);
    } else if (ratio <= 0.5) {
      // Acceptable - scale 5-7
      score = 5 + Math.round((0.5 - ratio) / 0.17 * 2);
    } else {
      // Too visual-heavy - scale 0-4
      score = Math.max(0, Math.round((1 - ratio) * 8));
    }

    if (ratio > idealMax) {
      const severity = ratio > 0.5 ? 'critical' : 'warning';
      issues.push({
        severity,
        message: `Visual content ratio (${Math.round(ratio * 100)}%) exceeds ideal (${Math.round(idealMax * 100)}%)`,
        details: `${contentMetrics.visualBlocks} visual blocks out of ${contentMetrics.totalBlocks} total`,
        fix: 'Add more text-based explanations to balance the visual content'
      });
    }

    return {
      criterionId: 'TB-02',
      score,
      issues,
      details: `Visual-to-content ratio: ${Math.round(ratio * 100)}% (ideal max: ${Math.round(idealMax * 100)}%)`
    };
  },

  /**
   * Score alt text coverage (TB-03)
   * Check that all images have descriptive alt text
   * @param {Object} metrics - Computed metrics
   * @returns {Object} Score and issues
   */
  scoreAltTextCoverage(metrics) {
    const { images } = metrics;
    const issues = [];

    // No images = perfect score (nothing to check)
    if (images.count === 0) {
      return {
        criterionId: 'TB-03',
        score: 10,
        issues: [],
        details: 'No images to check for alt text'
      };
    }

    // Calculate coverage score
    const coverage = images.altTextCoverage;
    const score = Math.round(coverage * 10);

    // Add issues for missing alt text
    if (images.withoutAlt > 0) {
      const severity = coverage < 0.5 ? 'critical' : coverage < 0.8 ? 'warning' : 'info';

      issues.push({
        severity,
        message: `${images.withoutAlt} of ${images.count} images missing alt text`,
        details: 'Images without alt text are invisible to AI assistants',
        fix: 'Add descriptive alt text to all images explaining what they show'
      });

      // Add specific image locations if not too many
      if (images.missingAlt.length <= 5) {
        images.missingAlt.forEach(img => {
          issues.push({
            severity: 'info',
            message: `Image ${img.index + 1} missing alt text`,
            location: img.src.split('/').pop().substring(0, 50),
            fix: 'Add alt attribute describing the image content'
          });
        });
      }
    }

    return {
      criterionId: 'TB-03',
      score,
      issues,
      details: `Alt text coverage: ${Math.round(coverage * 100)}% (${images.withAlt}/${images.count} images)`
    };
  },

  /**
   * Run all text-over-visuals rules
   * @param {Object} metrics - Computed metrics
   * @param {Object} content - Full content
   * @returns {Object} Combined results
   */
  scoreAll(metrics, content) {
    const results = {
      categoryId: 'CAT-08',
      categoryName: 'Text Over Visuals',
      criteria: {}
    };

    results.criteria['TB-01'] = this.scoreTextFirst(metrics, content);
    results.criteria['TB-02'] = this.scoreImageRatio(metrics);
    results.criteria['TB-03'] = this.scoreAltTextCoverage(metrics);

    // Calculate category score
    const configWeights = window.ScoringConfig?.categories?.['text-over-visuals']?.criteria || {};
    const weights = {
      'TB-01': configWeights['TB-01']?.weight || 0.35,
      'TB-02': configWeights['TB-02']?.weight || 0.35,
      'TB-03': configWeights['TB-03']?.weight || 0.30
    };
    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(results.criteria).forEach(([id, result]) => {
      const weight = weights[id] || 0.33;
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
  module.exports = TextOverVisualsRules;
}
