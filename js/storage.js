/**
 * Storage utilities for localStorage management
 * Handles API keys, preferences, and scoring history
 */

const Storage = {
  KEYS: {
    API_KEY: 'aiDocScorer_apiKey',
    THEME: 'aiDocScorer_theme',
    HISTORY: 'aiDocScorer_history',
    SETTINGS: 'aiDocScorer_settings',
    CLAUDE_CACHE: 'aiDocScorer_claudeCache'
  },

  MAX_HISTORY_ITEMS: 50,
  MAX_CACHE_ITEMS: 50,
  CACHE_TTL_MS: 7 * 24 * 60 * 60 * 1000,

  /**
   * Save API key (encrypted with basic obfuscation)
   * Note: This is not secure encryption, just basic obfuscation
   * For true security, users should not store API keys in browser storage
   * @param {string} apiKey - The API key to save
   */
  saveApiKey(apiKey) {
    if (!apiKey) {
      localStorage.removeItem(this.KEYS.API_KEY);
      return;
    }
    // Basic obfuscation - not secure, but prevents casual inspection
    const obfuscated = btoa(apiKey.split('').reverse().join(''));
    localStorage.setItem(this.KEYS.API_KEY, obfuscated);
  },

  /**
   * Get saved API key
   * @returns {string|null} The API key or null
   */
  getApiKey() {
    const obfuscated = localStorage.getItem(this.KEYS.API_KEY);
    if (!obfuscated) return null;
    try {
      return atob(obfuscated).split('').reverse().join('');
    } catch {
      return null;
    }
  },

  /**
   * Check if API key is configured
   * @returns {boolean}
   */
  hasApiKey() {
    return !!this.getApiKey();
  },

  /**
   * Clear API key
   */
  clearApiKey() {
    localStorage.removeItem(this.KEYS.API_KEY);
  },

  /**
   * Save theme preference
   * @param {string} theme - 'light' or 'dark'
   */
  saveTheme(theme) {
    localStorage.setItem(this.KEYS.THEME, theme);
  },

  /**
   * Get theme preference
   * @returns {string} 'light' or 'dark'
   */
  getTheme() {
    const saved = localStorage.getItem(this.KEYS.THEME);
    if (saved) return saved;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },

  /**
   * Save scoring result to history
   * @param {Object} result - Scoring result to save
   */
  saveToHistory(result) {
    const history = this.getHistory();

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      url: result.url,
      title: result.title,
      compositeScore: result.compositeScore,
      timestamp: new Date().toISOString(),
      categoryScores: result.categoryScores
    };

    // Check if URL already exists, update if so
    const existingIndex = history.findIndex(h => h.url === entry.url);
    if (existingIndex >= 0) {
      history[existingIndex] = entry;
    } else {
      history.unshift(entry);
    }

    // Limit history size
    if (history.length > this.MAX_HISTORY_ITEMS) {
      history.splice(this.MAX_HISTORY_ITEMS);
    }

    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
  },

  /**
   * Get scoring history
   * @returns {Array} Array of history entries
   */
  getHistory() {
    try {
      const data = localStorage.getItem(this.KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Clear scoring history
   */
  clearHistory() {
    localStorage.removeItem(this.KEYS.HISTORY);
  },

  /**
   * Get Claude cache map
   * @returns {Object} Cache map
   */
  getClaudeCache() {
    try {
      const data = localStorage.getItem(this.KEYS.CLAUDE_CACHE);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  /**
   * Get cached Claude response by hash
   * @param {string} hash - Cache key
   * @returns {Object|null} Cached entry or null
   */
  getClaudeCacheEntry(hash) {
    const cache = this.getClaudeCache();
    const entry = cache[hash];
    if (!entry) return null;
    if (entry.savedAt && Date.now() - new Date(entry.savedAt).getTime() > this.CACHE_TTL_MS) {
      delete cache[hash];
      localStorage.setItem(this.KEYS.CLAUDE_CACHE, JSON.stringify(cache));
      return null;
    }
    return entry;
  },

  /**
   * Save Claude response to cache
   * @param {string} hash - Cache key
   * @param {Object} payload - Cached data
   */
  saveClaudeCacheEntry(hash, payload) {
    const cache = this.getClaudeCache();
    cache[hash] = {
      ...payload,
      savedAt: new Date().toISOString()
    };
    const entries = Object.entries(cache)
      .sort((a, b) => new Date(b[1].savedAt) - new Date(a[1].savedAt))
      .slice(0, this.MAX_CACHE_ITEMS);
    const pruned = Object.fromEntries(entries);
    localStorage.setItem(this.KEYS.CLAUDE_CACHE, JSON.stringify(pruned));
  },

  /**
   * Remove specific history entry
   * @param {string} id - Entry ID to remove
   */
  removeFromHistory(id) {
    const history = this.getHistory();
    const filtered = history.filter(h => h.id !== id);
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(filtered));
  },

  /**
   * Save settings
   * @param {Object} settings - Settings object
   */
  saveSettings(settings) {
    const current = this.getSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(merged));
  },

  /**
   * Get settings
   * @returns {Object} Settings object with defaults
   */
  getSettings() {
    const defaults = {
      autoScore: true,
      showDetailedIssues: true,
      exportFormat: 'markdown'
    };

    try {
      const data = localStorage.getItem(this.KEYS.SETTINGS);
      return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    } catch {
      return defaults;
    }
  },

  /**
   * Export all data as JSON
   * @returns {Object} All stored data
   */
  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      theme: this.getTheme(),
      history: this.getHistory(),
      settings: this.getSettings()
      // Note: API key intentionally not exported
    };
  },

  /**
   * Clear all stored data
   */
  clearAll() {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
