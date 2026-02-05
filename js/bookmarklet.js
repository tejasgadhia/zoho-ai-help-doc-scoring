/**
 * Bookmarklet for extracting documentation content from help.zoho.com
 * This file contains the source code - the minified bookmarklet is generated from this.
 *
 * Usage: Drag the generated bookmarklet link to your bookmarks bar
 */

(function() {
  'use strict';

  // Configuration
  const APP_URL = 'https://YOUR_GITHUB_USERNAME.github.io/ai-help-doc-scoring/';
  const SUPPORTED_DOMAINS = ['help.zoho.com'];

  // Check if we're on a supported domain
  const currentDomain = window.location.hostname;
  const isSupported = SUPPORTED_DOMAINS.some(d => currentDomain.includes(d));

  if (!isSupported) {
    alert('AI Doc Scorer works on help.zoho.com pages.\n\nPlease navigate to a Zoho help documentation page and try again.');
    return;
  }

  // Extract page content
  function extractContent() {
    const content = {
      meta: {
        url: window.location.href,
        title: document.title,
        extractedAt: new Date().toISOString(),
        domain: currentDomain
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

    // Find the main content container (Zoho help portal specific selectors)
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
      mainContent = document.querySelector(selector);
      if (mainContent) break;
    }

    // Fallback to body if no specific container found
    if (!mainContent) {
      mainContent = document.body;
    }

    // Extract headings
    const headings = mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((h, index) => {
      content.structure.headings.push({
        level: h.tagName.toLowerCase(),
        text: h.textContent.trim(),
        index: index
      });
    });

    // Extract paragraphs
    const paragraphs = mainContent.querySelectorAll('p');
    paragraphs.forEach((p, index) => {
      const text = p.textContent.trim();
      if (text.length > 0) {
        content.structure.paragraphs.push({
          text: text,
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
          index: index
        });
      }
    });

    // Extract lists
    const lists = mainContent.querySelectorAll('ul, ol');
    lists.forEach((list, index) => {
      const items = Array.from(list.querySelectorAll(':scope > li')).map(li => li.textContent.trim());
      if (items.length > 0) {
        content.structure.lists.push({
          type: list.tagName.toLowerCase(),
          items: items,
          itemCount: items.length,
          index: index
        });
      }
    });

    // Extract images
    const images = mainContent.querySelectorAll('img');
    images.forEach((img, index) => {
      content.structure.images.push({
        src: img.src,
        alt: img.alt || null,
        hasAlt: !!img.alt && img.alt.trim().length > 0,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        index: index
      });
    });

    // Extract tables
    const tables = mainContent.querySelectorAll('table');
    tables.forEach((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
      ).filter(row => row.length > 0);

      content.structure.tables.push({
        headers: headers,
        rows: rows,
        rowCount: rows.length,
        columnCount: headers.length || (rows[0] ? rows[0].length : 0),
        index: index
      });
    });

    // Extract code blocks
    const codeBlocks = mainContent.querySelectorAll('pre, code');
    const processedCode = new Set();
    codeBlocks.forEach((code, index) => {
      const text = code.textContent.trim();
      // Avoid duplicates (code inside pre)
      if (text.length > 0 && !processedCode.has(text)) {
        processedCode.add(text);
        content.structure.codeBlocks.push({
          content: text,
          language: code.className.replace('language-', '') || 'unknown',
          index: index
        });
      }
    });

    // Extract links
    const links = mainContent.querySelectorAll('a[href]');
    links.forEach((link, index) => {
      const href = link.href;
      let isBroken = false;
      let reason = null;
      if (href.startsWith('#')) {
        const targetId = href.slice(1);
        const target = document.getElementById(targetId) || document.querySelector(`[name="${targetId}"]`);
        if (!target) {
          isBroken = true;
          reason = 'Missing anchor target';
        }
      } else if (href.includes('#')) {
        const [baseUrl, hash] = href.split('#');
        if (baseUrl === window.location.href.split('#')[0] && hash) {
          const target = document.getElementById(hash) || document.querySelector(`[name="${hash}"]`);
          if (!target) {
            isBroken = true;
            reason = 'Missing anchor target';
          }
        }
      }
      const isInternal = href.includes(currentDomain) || href.startsWith('/') || href.startsWith('#');
      content.structure.links.push({
        href: href,
        text: link.textContent.trim(),
        type: isInternal ? 'internal' : 'external',
        index: index,
        isBroken,
        reason
      });
    });

    // Get full text content
    content.text.fullText = mainContent.textContent
      .replace(/\s+/g, ' ')
      .trim();
    content.text.wordCount = content.text.fullText
      .split(/\s+/)
      .filter(w => w.length > 0).length;

    // Try to extract last updated date
    const dateSelectors = [
      '.last-updated',
      '.modified-date',
      '.article-date',
      'time[datetime]',
      '.date'
    ];
    for (const selector of dateSelectors) {
      const dateEl = document.querySelector(selector);
      if (dateEl) {
        content.meta.lastUpdated = dateEl.getAttribute('datetime') || dateEl.textContent.trim();
        break;
      }
    }

    // Extract breadcrumbs for context
    const breadcrumbSelectors = [
      '.breadcrumb',
      '.breadcrumbs',
      'nav[aria-label="breadcrumb"]',
      '.kb-breadcrumb'
    ];
    for (const selector of breadcrumbSelectors) {
      const breadcrumb = document.querySelector(selector);
      if (breadcrumb) {
        content.meta.breadcrumbs = Array.from(breadcrumb.querySelectorAll('a, span'))
          .map(el => el.textContent.trim())
          .filter(t => t.length > 0);
        break;
      }
    }

    return content;
  }

  // Extract the content
  const extractedContent = extractContent();

  // Encode and send to the app
  const encodedContent = encodeURIComponent(JSON.stringify(extractedContent));

  // Open the scoring app with the content
  // Using a smaller payload via postMessage if possible
  const appWindow = window.open(APP_URL, '_blank');

  // Wait for the app to load, then send the content
  if (appWindow) {
    // Store in sessionStorage as backup
    try {
      sessionStorage.setItem('aiDocScorerContent', JSON.stringify(extractedContent));
    } catch (e) {
      console.warn('Could not store content in sessionStorage');
    }

    // Try postMessage approach
    const checkInterval = setInterval(() => {
      try {
        appWindow.postMessage({
          type: 'AI_DOC_SCORER_CONTENT',
          payload: extractedContent
        }, '*');
      } catch (e) {
        // Window not ready yet
      }
    }, 500);

    // Stop trying after 10 seconds
    setTimeout(() => clearInterval(checkInterval), 10000);
  } else {
    alert('Could not open the scoring app. Please check your popup blocker settings.');
  }
})();
