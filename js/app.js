/**
 * Main App - Orchestrates the AI Help Doc Scoring Tool
 * Handles UI state, events, and coordinates all modules
 */

const App = {
  // Current state
  state: {
    view: 'landing', // 'landing', 'scoring', 'results'
    content: null,
    results: null,
    isScoring: false,
    error: null
  },

  /**
   * Initialize the application
   */
  async init() {
    // Set up theme
    this.initTheme();

    // Load scoring config
    await this.loadScoringConfig();

    // Set up event listeners
    this.setupEventListeners();

    // Listen for bookmarklet messages
    window.addEventListener('message', this.handleMessage.bind(this));

    // Check for content in URL or sessionStorage
    this.checkForContent();

    // Update UI based on initial state
    this.updateUI();

    console.log('AI Help Doc Scoring Tool initialized');
  },

  /**
   * Initialize theme from storage or system preference
   */
  initTheme() {
    const theme = Storage.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeToggle(theme);
  },

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // API key form
    const apiKeyForm = document.getElementById('apiKeyForm');
    if (apiKeyForm) {
      apiKeyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveApiKey();
      });
    }

    // Clear API key
    const clearApiKeyBtn = document.getElementById('clearApiKey');
    if (clearApiKeyBtn) {
      clearApiKeyBtn.addEventListener('click', () => this.clearApiKey());
    }

    // Test API key
    const testApiKeyBtn = document.getElementById('testApiKey');
    if (testApiKeyBtn) {
      testApiKeyBtn.addEventListener('click', () => this.testApiKey());
    }

    // Manual URL input
    const manualScoreBtn = document.getElementById('manualScoreBtn');
    if (manualScoreBtn) {
      manualScoreBtn.addEventListener('click', () => this.showManualInput());
    }

    // Batch scoring
    const batchScoreBtn = document.getElementById('batchScoreBtn');
    if (batchScoreBtn) {
      batchScoreBtn.addEventListener('click', () => this.handleBatchScore());
    }

    // Export buttons
    document.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const format = e.currentTarget.dataset.export;
        this.exportResults(format);
      });
    });

    // Back to landing
    const backBtn = document.getElementById('backToLanding');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.goToLanding());
    }

    // Score again button
    const scoreAgainBtn = document.getElementById('scoreAgain');
    if (scoreAgainBtn) {
      scoreAgainBtn.addEventListener('click', () => this.scoreAgain());
    }

    // History items
    this.setupHistoryListeners();

    // Bookmarklet copy
    const copyBookmarkletBtn = document.getElementById('copyBookmarklet');
    if (copyBookmarkletBtn) {
      copyBookmarkletBtn.addEventListener('click', () => this.copyBookmarklet());
    }

    // Settings panel
    const settingsToggle = document.getElementById('settingsToggle');
    if (settingsToggle) {
      settingsToggle.addEventListener('click', () => this.toggleSettings());
    }
  },

  /**
   * Set up history panel listeners
   */
  setupHistoryListeners() {
    const historyList = document.getElementById('historyList');
    if (historyList) {
      historyList.addEventListener('click', (e) => {
        const item = e.target.closest('[data-history-id]');
        if (item) {
          const id = item.dataset.historyId;
          // For now, just show it was clicked
          console.log('History item clicked:', id);
        }
      });
    }
  },

  /**
   * Handle incoming postMessage from bookmarklet
   * @param {MessageEvent} event
   */
  handleMessage(event) {
    if (event.data && event.data.type === 'AI_DOC_SCORER_CONTENT') {
      console.log('Received content from bookmarklet');
      this.processContent(event.data.payload);
    }
  },

  /**
   * Check for content in sessionStorage (bookmarklet fallback)
   */
  checkForContent() {
    const stored = sessionStorage.getItem('aiDocScorerContent');
    if (stored) {
      try {
        const content = JSON.parse(stored);
        sessionStorage.removeItem('aiDocScorerContent');
        this.processContent(content);
      } catch (e) {
        console.error('Failed to parse stored content:', e);
      }
    }
  },

  /**
   * Process content from bookmarklet and start scoring
   * @param {Object} rawContent - Raw content from bookmarklet
   */
  async processContent(rawContent) {
    try {
      await this.loadScoringConfig(true);

      // Validate and normalize content
      const content = Parser.normalize(rawContent);
      this.state.content = content;

      // Switch to scoring view
      this.state.view = 'scoring';
      this.updateUI();

      // Start scoring
      await this.runScoring();

    } catch (error) {
      console.error('Failed to process content:', error);
      this.showError('Failed to process page content: ' + error.message);
    }
  },

  /**
   * Load scoring config and apply overrides
   * @param {boolean} forceReload - Bypass cache if true
   */
  async loadScoringConfig(forceReload = false) {
    try {
      const cacheBust = forceReload ? `?t=${Date.now()}` : '';
      const response = await fetch(`config/scoring-criteria.json${cacheBust}`, { cache: 'no-store' });
      if (!response.ok) return;
      const config = await response.json();
      this.state.scoringConfig = config;
      window.ScoringConfig = config;
      Scorer.applyConfig(config);
    } catch (error) {
      console.warn('Failed to load scoring config:', error);
    }
  },

  /**
   * Run the scoring process
   */
  async runScoring() {
    if (!this.state.content) {
      this.showError('No content to score');
      return;
    }

    this.state.isScoring = true;
    this.state.error = null;
    this.updateUI();

    try {
      const apiKey = Storage.getApiKey();
      const metrics = this.state.content.metrics;
      const cacheKey = `${this.hashText(this.state.content.text.fullText)}:${apiKey ? 'full' : 'rule'}`;
      const cached = Storage.getResultCacheEntry(cacheKey);
      if (cached && cached.results) {
        this.state.results = cached.results;
        this.state.view = 'results';
        this.state.isScoring = false;
        this.updateUI();
        this.renderResults();
        this.showToast('Reused cached results for unchanged content', 'info');
        return;
      }

      const results = await Scorer.scoreAll(
        this.state.content,
        metrics,
        apiKey,
        (progress) => this.updateProgress(progress)
      );

      Storage.saveResultCacheEntry(cacheKey, results);
      this.state.results = results;

      // Save to history
      Storage.saveToHistory({
        url: results.meta.url,
        title: results.meta.title,
        compositeScore: results.compositeScore,
        categoryScores: Object.fromEntries(
          Object.entries(results.categories).map(([k, v]) => [k, v.score])
        )
      });

      // Switch to results view
      this.state.view = 'results';
      this.state.isScoring = false;
      this.updateUI();
      this.renderResults();

    } catch (error) {
      console.error('Scoring failed:', error);
      this.state.isScoring = false;
      this.showError('Scoring failed: ' + error.message);
    }
  },

  /**
   * Update progress indicator
   * @param {Object} progress - Progress info
   */
  updateProgress(progress) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (progressBar) {
      progressBar.style.width = `${progress.percent}%`;
    }
    if (progressText) {
      progressText.textContent = progress.message;
    }
  },

  /**
   * Render scoring results
   */
  renderResults() {
    const results = this.state.results;
    if (!results) return;

    // Update page title
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
      titleEl.textContent = results.meta.title;
    }

    // Update URL
    const urlEl = document.getElementById('pageUrl');
    if (urlEl) {
      urlEl.textContent = results.meta.url;
      urlEl.href = results.meta.url;
    }

    // Update composite score
    const scoreEl = document.getElementById('compositeScore');
    if (scoreEl) {
      scoreEl.textContent = results.compositeScore.toFixed(1);
      scoreEl.className = `score-value score-${results.status}`;
    }

    // Update status badge
    const statusEl = document.getElementById('statusBadge');
    if (statusEl) {
      statusEl.textContent = results.status === 'green' ? 'Good' :
                             results.status === 'yellow' ? 'Needs Work' : 'Critical';
      statusEl.className = `status-badge status-${results.status}`;
    }

    // Update summary
    const summaryEl = document.getElementById('summaryText');
    if (summaryEl) {
      summaryEl.textContent = results.summary;
    }

    // Render batch summary if present
    this.renderBatchSummary();

    // Render charts
    Charts.createScoreGauge('scoreGauge', results.compositeScore);
    Charts.createCategoryChart('categoryChart', results.categories);

    // Render category cards
    this.renderCategoryCards(results.categories);

    // Render top issues
    this.renderTopIssues(results.topIssues);

    // Render all issues
    this.renderAllIssues(results.allIssues);

    // Update history sidebar
    this.renderHistory();
  },

  /**
   * Render batch summary list
   */
  renderBatchSummary() {
    const container = document.getElementById('batchSummary');
    if (!container) return;
    const batchResults = this.state.batchResults || [];

    if (batchResults.length <= 1) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    const listItems = batchResults.map((entry, index) => {
      if (entry.error) {
        return `<li class="batch-error">${entry.url} - ${entry.error}</li>`;
      }
      return `<li><button class="link-button" data-batch-index="${index}">${entry.meta.title || entry.meta.url}</button> — ${entry.compositeScore.toFixed(1)}/10</li>`;
    });
    const duplicates = this.state.batchDuplicates || [];
    const duplicateMarkup = duplicates.length
      ? `<p><strong>Potential duplicates:</strong></p><ul>${duplicates.map(pair => `<li>${pair.a} ↔ ${pair.b} (${pair.similarity}%)</li>`).join('')}</ul>`
      : '';

    container.classList.remove('hidden');
    container.innerHTML = `
      <strong>Batch Results (${batchResults.length})</strong>
      <ul>${listItems.join('')}</ul>
      ${duplicateMarkup}
    `;

    container.querySelectorAll('[data-batch-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.batchIndex, 10);
        const entry = batchResults[idx];
        if (entry && !entry.error) {
          this.state.results = entry;
          this.renderResults();
        }
      });
    });
  },

  /**
   * Handle batch scoring submission
   */
  async handleBatchScore() {
    const input = document.getElementById('batchUrls');
    if (!input) return;

    const urls = input.value.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (urls.length === 0) {
      this.showToast('Add at least one URL to batch score', 'error');
      return;
    }

    await this.runBatchScoring(urls);
  },

  /**
   * Run batch scoring for a list of URLs
   * @param {string[]} urls - URLs to score
   */
  async runBatchScoring(urls) {
    this.state.view = 'scoring';
    this.state.isScoring = true;
    this.state.results = null;
    this.state.batchResults = [];
    this.updateUI();

    const apiKey = Storage.getApiKey();
    const batchResults = [];
    const tokenSets = [];

    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      this.updateProgress({
        step: 'batch',
        message: `Scoring ${i + 1} of ${urls.length}...`,
        percent: Math.round(((i + 1) / urls.length) * 90)
      });

      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Fetch failed (${response.status})`);
        }
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const rawContent = this.extractContentFromDocument(doc, url);
        const content = Parser.normalize(rawContent);
        const metrics = content.metrics;

        const result = await Scorer.scoreAll(
          content,
          metrics,
          apiKey,
          progress => this.updateProgress(progress)
        );

        result.meta.extractionWarnings = content.meta.extractionWarnings || [];
        const tokens = content.text.fullText.toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(token => token.length > 3);
        tokenSets.push(new Set(tokens));
        batchResults.push(result);

        Storage.saveToHistory({
          url: result.meta.url,
          title: result.meta.title,
          compositeScore: result.compositeScore,
          categoryScores: Object.fromEntries(
            Object.entries(result.categories).map(([k, v]) => [k, v.score])
          )
        });
      } catch (error) {
        batchResults.push({ url, error: error.message });
      }
    }

    const firstResult = batchResults.find(entry => !entry.error);
    if (firstResult) {
      this.state.results = firstResult;
    }
    this.state.batchResults = batchResults;
    this.state.batchDuplicates = this.findDuplicatePages(batchResults, tokenSets);
    this.state.view = 'results';
    this.state.isScoring = false;
    this.updateUI();
    if (this.state.results) {
      this.renderResults();
    } else {
      this.showError('Batch scoring failed for all URLs.');
    }
  },

  /**
   * Find duplicate or near-duplicate pages in batch results
   * @param {Array} resultsList - Results list
   * @param {Array<Set<string>>} tokenSets - Token sets for each result
   * @returns {Array} Duplicate pairs
   */
  findDuplicatePages(resultsList, tokenSets) {
    const duplicates = [];
    const similarity = (a, b) => {
      if (!a || !b) return 0;
      let intersection = 0;
      a.forEach(token => {
        if (b.has(token)) intersection += 1;
      });
      const union = a.size + b.size - intersection;
      return union === 0 ? 0 : intersection / union;
    };

    for (let i = 0; i < resultsList.length; i += 1) {
      if (resultsList[i].error) continue;
      for (let j = i + 1; j < resultsList.length; j += 1) {
        if (resultsList[j].error) continue;
        const score = similarity(tokenSets[i], tokenSets[j]);
        if (score >= 0.85) {
          duplicates.push({
            a: resultsList[i].meta.url,
            b: resultsList[j].meta.url,
            similarity: Math.round(score * 100)
          });
        }
      }
    }

    return duplicates;
  },

  /**
   * Extract content from a parsed HTML document
   * @param {Document} doc - Parsed document
   * @param {string} url - Source URL
   * @returns {Object} Raw content payload
   */
  extractContentFromDocument(doc, url) {
    const content = {
      meta: {
        url,
        title: doc.title || url,
        extractedAt: new Date().toISOString(),
        domain: new URL(url).hostname,
        extractionWarnings: []
      },
      structure: {
        headings: [],
        paragraphs: [],
        lists: [],
        images: [],
        tables: [],
        codeBlocks: [],
        links: []
      },
      text: {
        fullText: '',
        wordCount: 0
      }
    };

    const contentSelectors = [
      '.kb-article-content',
      '.article-content',
      '.help-content',
      'article',
      'main',
      '.main-content',
      '#main-content'
    ];
    let mainContent = null;
    for (const selector of contentSelectors) {
      mainContent = doc.querySelector(selector);
      if (mainContent) break;
    }
    if (!mainContent) {
      mainContent = doc.body;
      content.meta.extractionWarnings.push('No content container matched; fell back to document.body');
    }

    mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h, index) => {
      content.structure.headings.push({
        level: h.tagName.toLowerCase(),
        text: h.textContent.trim(),
        index
      });
    });

    mainContent.querySelectorAll('p').forEach((p, index) => {
      const text = p.textContent.trim();
      if (text.length > 0) {
        content.structure.paragraphs.push({
          text,
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
          index
        });
      }
    });

    mainContent.querySelectorAll('ul, ol').forEach((list, index) => {
      const items = Array.from(list.querySelectorAll(':scope > li')).map(li => li.textContent.trim());
      if (items.length > 0) {
        content.structure.lists.push({
          type: list.tagName.toLowerCase(),
          items,
          itemCount: items.length,
          index
        });
      }
    });

    mainContent.querySelectorAll('img').forEach((img, index) => {
      content.structure.images.push({
        src: img.src,
        alt: img.alt || null,
        hasAlt: !!img.alt && img.alt.trim().length > 0,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        index
      });
    });

    mainContent.querySelectorAll('table').forEach((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
      ).filter(row => row.length > 0);
      content.structure.tables.push({
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length || (rows[0] ? rows[0].length : 0),
        index
      });
    });

    const processedCode = new Set();
    mainContent.querySelectorAll('pre, code').forEach((code, index) => {
      const text = code.textContent.trim();
      if (text.length > 0 && !processedCode.has(text)) {
        processedCode.add(text);
        content.structure.codeBlocks.push({
          content: text,
          language: code.className.replace('language-', '') || 'unknown',
          index
        });
      }
    });

    mainContent.querySelectorAll('a[href]').forEach((link, index) => {
      const href = link.href;
      const isInternal = href.includes(content.meta.domain) || href.startsWith('/') || href.startsWith('#');
      content.structure.links.push({
        href,
        text: link.textContent.trim(),
        type: isInternal ? 'internal' : 'external',
        index
      });
    });

    content.text.fullText = mainContent.textContent.replace(/\s+/g, ' ').trim();
    content.text.wordCount = content.text.fullText.split(/\s+/).filter(w => w.length > 0).length;

    return content;
  },

  /**
   * Render category score cards
   * @param {Object} categories - Category results
   */
  renderCategoryCards(categories) {
    const container = document.getElementById('categoryCards');
    if (!container) return;

    container.innerHTML = Object.entries(categories)
      .sort((a, b) => (b[1].weight || 0) - (a[1].weight || 0))
      .map(([key, category]) => {
        const status = category.estimated ? 'estimated' :
                       category.score >= 7 ? 'green' :
                       category.score >= 4 ? 'yellow' : 'red';

        const scoreDisplay = category.estimated ? 'N/A' : category.score.toFixed(1);
        const weightPercent = Math.round((category.weight || 0) * 100);

        return `
          <div class="category-card category-${status}" data-category="${key}">
            <div class="category-header">
              <h3 class="category-name">${category.name}</h3>
              <span class="category-weight">${weightPercent}%</span>
            </div>
            <div class="category-score">
              <span class="score-number">${scoreDisplay}</span>
              <span class="score-max">/10</span>
            </div>
            ${category.estimated ?
              `<p class="category-note">${category.message}</p>` :
              `<p class="category-issues">${category.issues?.length || 0} issues</p>`
            }
          </div>
        `;
      }).join('');
  },

  /**
   * Render top issues section
   * @param {Array} issues - Top issues
   */
  renderTopIssues(issues) {
    const container = document.getElementById('topIssues');
    if (!container) return;

    if (!issues || issues.length === 0) {
      container.innerHTML = '<p class="no-issues">No critical issues found.</p>';
      return;
    }

    container.innerHTML = issues.map((issue, index) => `
      <div class="issue-card issue-${issue.severity}">
        <div class="issue-header">
          <span class="issue-number">${index + 1}</span>
          <span class="issue-severity severity-${issue.severity}">${issue.severity}</span>
          <span class="issue-category">${issue.category}</span>
        </div>
        <p class="issue-message">${issue.message}</p>
        ${issue.details ? `<p class="issue-details">${issue.details}</p>` : ''}
        ${issue.fix ? `<p class="issue-fix"><strong>Fix:</strong> ${issue.fix}</p>` : ''}
        ${issue.excerpt ? `<blockquote class="issue-excerpt">${issue.excerpt}</blockquote>` : ''}
      </div>
    `).join('');
  },

  /**
   * Render all issues in collapsible section
   * @param {Array} issues - All issues
   */
  renderAllIssues(issues) {
    const container = document.getElementById('allIssues');
    if (!container) return;

    const issueCount = document.getElementById('issueCount');
    if (issueCount) {
      issueCount.textContent = issues.length;
    }

    container.innerHTML = issues.map(issue => `
      <div class="issue-row issue-${issue.severity}">
        <span class="issue-severity-dot severity-${issue.severity}"></span>
        <span class="issue-cat">${issue.category}</span>
        <span class="issue-msg">${issue.message}</span>
      </div>
    `).join('');
  },

  /**
   * Render history sidebar
   */
  renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    const history = Storage.getHistory();

    if (history.length === 0) {
      container.innerHTML = '<p class="no-history">No pages scored yet</p>';
      return;
    }

    container.innerHTML = history.slice(0, 10).map(entry => {
      const status = entry.compositeScore >= 7 ? 'green' :
                     entry.compositeScore >= 4 ? 'yellow' : 'red';
      const date = new Date(entry.timestamp).toLocaleDateString();

      return `
        <div class="history-item" data-history-id="${entry.id}">
          <div class="history-score score-${status}">${entry.compositeScore.toFixed(1)}</div>
          <div class="history-info">
            <p class="history-title">${entry.title}</p>
            <p class="history-date">${date}</p>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Update UI based on current state
   */
  updateUI() {
    // Show/hide views
    const landing = document.getElementById('landingView');
    const scoring = document.getElementById('scoringView');
    const results = document.getElementById('resultsView');

    if (landing) landing.classList.toggle('hidden', this.state.view !== 'landing');
    if (scoring) scoring.classList.toggle('hidden', this.state.view !== 'scoring');
    if (results) results.classList.toggle('hidden', this.state.view !== 'results');

    // Update API key status
    this.updateApiKeyStatus();

    // Update bookmarklet
    this.updateBookmarklet();
  },

  /**
   * Update API key status indicators
   */
  updateApiKeyStatus() {
    const hasKey = Storage.hasApiKey();
    const statusEl = document.getElementById('apiKeyStatus');
    const inputEl = document.getElementById('apiKeyInput');
    const clearBtn = document.getElementById('clearApiKey');
    const indicator = document.getElementById('apiKeyIndicator');

    if (statusEl) {
      statusEl.textContent = hasKey ? 'API key configured' : 'No API key set';
      statusEl.className = `api-status ${hasKey ? 'status-ok' : 'status-missing'}`;
    }

    if (inputEl && hasKey) {
      inputEl.placeholder = '****' + Storage.getApiKey().slice(-4);
    }

    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !hasKey);
    }

    // Update header indicator dot
    if (indicator) {
      indicator.classList.toggle('configured', hasKey);
    }
  },

  /**
   * Update bookmarklet link
   */
  updateBookmarklet() {
    const bookmarkletLink = document.getElementById('bookmarkletLink');
    if (!bookmarkletLink) return;

    // Get the current page URL for the bookmarklet to redirect to
    const appUrl = window.location.href.split('?')[0];

    // Minified bookmarklet code
    const bookmarkletCode = `javascript:(function(){var s=['help.zoho.com'];var d=window.location.hostname;var ok=s.some(function(x){return d.includes(x)});if(!ok){alert('AI Doc Scorer works on help.zoho.com pages.');return}var c={meta:{url:window.location.href,title:document.title,extractedAt:new Date().toISOString()},structure:{headings:[],paragraphs:[],lists:[],images:[],tables:[],codeBlocks:[],links:[]},text:{fullText:'',wordCount:0}};var sel=['.kb-article-content','.article-content','.help-content','article','main'];var m=null;for(var i=0;i<sel.length;i++){m=document.querySelector(sel[i]);if(m)break}if(!m)m=document.body;m.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h,i){c.structure.headings.push({level:h.tagName.toLowerCase(),text:h.textContent.trim(),index:i})});m.querySelectorAll('p').forEach(function(p,i){var t=p.textContent.trim();if(t.length>0)c.structure.paragraphs.push({text:t,wordCount:t.split(/\\s+/).filter(function(w){return w.length>0}).length,index:i})});m.querySelectorAll('ul,ol').forEach(function(l,i){var items=Array.from(l.querySelectorAll(':scope>li')).map(function(li){return li.textContent.trim()});if(items.length>0)c.structure.lists.push({type:l.tagName.toLowerCase(),items:items,itemCount:items.length,index:i})});m.querySelectorAll('img').forEach(function(img,i){c.structure.images.push({src:img.src,alt:img.alt||null,hasAlt:!!img.alt&&img.alt.trim().length>0,index:i})});m.querySelectorAll('table').forEach(function(t,i){var headers=Array.from(t.querySelectorAll('th')).map(function(th){return th.textContent.trim()});var rows=Array.from(t.querySelectorAll('tr')).map(function(tr){return Array.from(tr.querySelectorAll('td')).map(function(td){return td.textContent.trim()})}).filter(function(r){return r.length>0});c.structure.tables.push({headers:headers,rows:rows,rowCount:rows.length,columnCount:headers.length||(rows[0]?rows[0].length:0),index:i})});m.querySelectorAll('pre,code').forEach(function(code,i){var txt=code.textContent.trim();if(txt.length>0)c.structure.codeBlocks.push({content:txt,language:code.className.replace('language-','')||'unknown',index:i})});m.querySelectorAll('a[href]').forEach(function(a,i){var href=a.href;var broken=false;var reason=null;if(href.startsWith('#')){var id=href.slice(1);var target=document.getElementById(id)||document.querySelector('[name=\"'+id+'\"]');if(!target){broken=true;reason='Missing anchor target'}}else if(href.indexOf('#')>-1){var parts=href.split('#');if(parts[0]===window.location.href.split('#')[0]&&parts[1]){var target2=document.getElementById(parts[1])||document.querySelector('[name=\"'+parts[1]+'\"]');if(!target2){broken=true;reason='Missing anchor target'}}}var internal=href.includes(d)||href.startsWith('/')||href.startsWith('#');c.structure.links.push({href:href,text:a.textContent.trim(),type:internal?'internal':'external',index:i,isBroken:broken,reason:reason})});c.text.fullText=m.textContent.replace(/\\s+/g,' ').trim();c.text.wordCount=c.text.fullText.split(/\\s+/).filter(function(w){return w.length>0}).length;var w=window.open('${appUrl}','_blank');if(w){var iv=setInterval(function(){try{w.postMessage({type:'AI_DOC_SCORER_CONTENT',payload:c},'*')}catch(e){}},500);setTimeout(function(){clearInterval(iv)},10000)}else{alert('Could not open app. Check popup blocker.')}})();`;

    bookmarkletLink.href = bookmarkletCode;
  },

  /**
   * Toggle theme between light and dark
   */
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    Storage.saveTheme(newTheme);
    this.updateThemeToggle(newTheme);

    // Update charts if results are showing
    if (this.state.results) {
      Charts.updateTheme(this.state.results);
    }
  },

  /**
   * Update theme toggle button state
   * @param {string} theme - Current theme
   */
  updateThemeToggle(theme) {
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
      toggle.innerHTML = theme === 'dark' ?
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>' :
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  },

  /**
   * Save API key from form
   */
  saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    if (!input) return;

    const key = input.value.trim();
    if (key) {
      Storage.saveApiKey(key);
      input.value = '';
      this.updateApiKeyStatus();
      this.showToast('API key saved');
    }
  },

  /**
   * Clear saved API key
   */
  clearApiKey() {
    Storage.clearApiKey();
    this.updateApiKeyStatus();
    this.showToast('API key cleared');
  },

  /**
   * Test API key validity
   */
  async testApiKey() {
    const key = Storage.getApiKey();
    if (!key) {
      this.showToast('No API key configured', 'error');
      return;
    }

    const btn = document.getElementById('testApiKey');
    if (btn) btn.disabled = true;

    try {
      const valid = await ClaudeClient.testApiKey(key);
      this.showToast(valid ? 'API key is valid' : 'API key is invalid', valid ? 'success' : 'error');
    } catch (error) {
      this.showToast('Error testing API key: ' + error.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Export results in specified format
   * @param {string} format - 'markdown', 'json', or 'clipboard'
   */
  async exportResults(format) {
    if (!this.state.results) return;
    const batchResults = this.state.batchResults || [];
    const duplicates = this.state.batchDuplicates || [];
    if (batchResults.length > 1) {
      switch (format) {
        case 'markdown':
          Export.downloadBatchMarkdown(batchResults, duplicates);
          this.showToast('Batch report downloaded');
          return;
        case 'json':
          Export.downloadBatchJson(batchResults);
          this.showToast('Batch JSON downloaded');
          return;
        case 'clipboard':
          const copied = await Export.copyBatchToClipboard(batchResults, duplicates);
          this.showToast(copied ? 'Batch report copied' : 'Failed to copy', copied ? 'success' : 'error');
          return;
      }
    }

    switch (format) {
      case 'markdown':
        Export.downloadMarkdown(this.state.results);
        this.showToast('Markdown report downloaded');
        break;
      case 'json':
        Export.downloadJson(this.state.results);
        this.showToast('JSON data downloaded');
        break;
      case 'clipboard':
        const success = await Export.copyToClipboard(this.state.results);
        this.showToast(success ? 'Report copied to clipboard' : 'Failed to copy', success ? 'success' : 'error');
        break;
    }
  },

  /**
   * Copy bookmarklet code to clipboard
   */
  async copyBookmarklet() {
    const link = document.getElementById('bookmarkletLink');
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link.href);
      this.showToast('Bookmarklet copied to clipboard');
    } catch {
      this.showToast('Failed to copy', 'error');
    }
  },

  /**
   * Go back to landing page
   */
  goToLanding() {
    this.state.view = 'landing';
    this.state.content = null;
    this.state.results = null;
    this.updateUI();
  },

  /**
   * Score the same page again
   */
  async scoreAgain() {
    if (this.state.content) {
      this.state.view = 'scoring';
      this.updateUI();
      await this.runScoring();
    }
  },

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.state.error = message;
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
    this.showToast(message, 'error');
  },

  /**
   * Hash a string for caching
   * @param {string} text - Text to hash
   * @returns {string} Hash
   */
  hashText(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  },

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - 'success', 'error', or 'info'
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Toggle settings panel
   */
  toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  },

  /**
   * Show manual URL input modal
   */
  showManualInput() {
    // For now, show a simple prompt
    const url = prompt('Enter the URL of a help.zoho.com page to score:');
    if (url && url.includes('help.zoho.com')) {
      this.showToast('Please use the bookmarklet to score pages. It extracts content directly from the page.', 'info');
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
