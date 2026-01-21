/**
 * Charts module for score visualizations
 * Uses Chart.js for rendering
 */

const Charts = {
  // Color scheme matching the design
  colors: {
    light: {
      green: '#059669',
      yellow: '#d97706',
      red: '#dc2626',
      background: '#f8fafc',
      text: '#1e293b',
      border: '#e2e8f0',
      primary: '#d97706',
      secondary: '#64748b'
    },
    dark: {
      green: '#34d399',
      yellow: '#fbbf24',
      red: '#f87171',
      background: '#1e293b',
      text: '#f1f5f9',
      border: '#334155',
      primary: '#fbbf24',
      secondary: '#94a3b8'
    }
  },

  // Chart instances for cleanup
  instances: {},

  /**
   * Get colors based on current theme
   * @returns {Object} Color palette
   */
  getColors() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    return this.colors[theme] || this.colors.light;
  },

  /**
   * Get status color
   * @param {number} score - Score 0-10
   * @returns {string} Color hex
   */
  getStatusColor(score) {
    const colors = this.getColors();
    if (score >= 7) return colors.green;
    if (score >= 4) return colors.yellow;
    return colors.red;
  },

  /**
   * Destroy existing chart instance
   * @param {string} id - Chart ID
   */
  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  /**
   * Create composite score gauge
   * @param {string} canvasId - Canvas element ID
   * @param {number} score - Composite score 0-10
   */
  createScoreGauge(canvasId, score) {
    this.destroy(canvasId);

    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getColors();
    const statusColor = this.getStatusColor(score);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [score, 10 - score],
          backgroundColor: [statusColor, colors.border],
          borderWidth: 0,
          circumference: 270,
          rotation: 225
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '75%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      },
      plugins: [{
        id: 'centerText',
        beforeDraw: (chart) => {
          const { width, height, ctx } = chart;
          ctx.restore();

          // Score number
          ctx.font = `bold ${height * 0.25}px "DM Sans", sans-serif`;
          ctx.fillStyle = colors.text;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(score.toFixed(1), width / 2, height / 2 - 10);

          // "out of 10" label
          ctx.font = `${height * 0.08}px "DM Sans", sans-serif`;
          ctx.fillStyle = colors.secondary;
          ctx.fillText('out of 10', width / 2, height / 2 + 25);

          ctx.save();
        }
      }]
    });
  },

  /**
   * Create category breakdown bar chart
   * @param {string} canvasId - Canvas element ID
   * @param {Object} categories - Category scores
   */
  createCategoryChart(canvasId, categories) {
    this.destroy(canvasId);

    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getColors();

    // Prepare data
    const sortedCategories = Object.entries(categories)
      .filter(([, c]) => c.score !== null && !c.estimated)
      .sort((a, b) => (b[1].weight || 0) - (a[1].weight || 0));

    const labels = sortedCategories.map(([, c]) => c.name);
    const scores = sortedCategories.map(([, c]) => c.score);
    const backgroundColors = scores.map(s => this.getStatusColor(s));

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: scores,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          borderRadius: 4,
          barThickness: 24
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: 0,
            max: 10,
            grid: {
              color: colors.border,
              drawBorder: false
            },
            ticks: {
              color: colors.secondary,
              font: { family: '"DM Sans", sans-serif' }
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: colors.text,
              font: {
                family: '"DM Sans", sans-serif',
                weight: 500
              }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.background,
            titleColor: colors.text,
            bodyColor: colors.text,
            borderColor: colors.border,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            callbacks: {
              label: (ctx) => `Score: ${ctx.raw}/10`
            }
          }
        }
      }
    });
  },

  /**
   * Create radar chart for category comparison
   * @param {string} canvasId - Canvas element ID
   * @param {Object} categories - Category scores
   */
  createRadarChart(canvasId, categories) {
    this.destroy(canvasId);

    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getColors();

    const sortedCategories = Object.entries(categories)
      .filter(([, c]) => c.score !== null && !c.estimated);

    const labels = sortedCategories.map(([, c]) => c.name);
    const scores = sortedCategories.map(([, c]) => c.score);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          data: scores,
          backgroundColor: `${colors.primary}33`,
          borderColor: colors.primary,
          borderWidth: 2,
          pointBackgroundColor: colors.primary,
          pointBorderColor: colors.background,
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 2,
              color: colors.secondary,
              backdropColor: 'transparent',
              font: { family: '"DM Sans", sans-serif' }
            },
            grid: { color: colors.border },
            angleLines: { color: colors.border },
            pointLabels: {
              color: colors.text,
              font: {
                family: '"DM Sans", sans-serif',
                size: 11,
                weight: 500
              }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.background,
            titleColor: colors.text,
            bodyColor: colors.text,
            borderColor: colors.border,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12
          }
        }
      }
    });
  },

  /**
   * Create issue severity breakdown
   * @param {string} canvasId - Canvas element ID
   * @param {Array} issues - All issues
   */
  createIssueSeverityChart(canvasId, issues) {
    this.destroy(canvasId);

    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getColors();

    // Count by severity
    const counts = { critical: 0, warning: 0, info: 0 };
    issues.forEach(issue => {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    });

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'Warning', 'Info'],
        datasets: [{
          data: [counts.critical, counts.warning, counts.info],
          backgroundColor: [colors.red, colors.yellow, colors.secondary],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.text,
              font: { family: '"DM Sans", sans-serif' },
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: colors.background,
            titleColor: colors.text,
            bodyColor: colors.text,
            borderColor: colors.border,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12
          }
        }
      }
    });
  },

  /**
   * Update all charts for theme change
   * @param {Object} currentResults - Current scoring results
   */
  updateTheme(currentResults) {
    if (!currentResults) return;

    // Re-render all charts with new colors
    if (document.getElementById('scoreGauge')) {
      this.createScoreGauge('scoreGauge', currentResults.compositeScore);
    }
    if (document.getElementById('categoryChart')) {
      this.createCategoryChart('categoryChart', currentResults.categories);
    }
    if (document.getElementById('radarChart')) {
      this.createRadarChart('radarChart', currentResults.categories);
    }
    if (document.getElementById('severityChart')) {
      this.createIssueSeverityChart('severityChart', currentResults.allIssues);
    }
  },

  /**
   * Destroy all chart instances
   */
  destroyAll() {
    Object.keys(this.instances).forEach(id => this.destroy(id));
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Charts;
}
