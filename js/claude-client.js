/**
 * Claude API Client for BYOK (Bring Your Own Key) semantic analysis
 * Uses direct API calls from browser with user-provided API key
 */

const ClaudeClient = {
  API_URL: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 4096,

  /**
   * Make a request to Claude API
   * @param {string} apiKey - User's Anthropic API key
   * @param {string} prompt - The prompt to send
   * @param {string} systemPrompt - System context
   * @returns {Promise<Object>} API response
   */
  async request(apiKey, prompt, systemPrompt = '') {
    if (!apiKey) {
      throw new Error('API key is required. Please add your Claude API key in settings.');
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };

    const body = {
      model: this.MODEL,
      max_tokens: this.MAX_TOKENS,
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your Claude API key.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait and try again.');
        } else if (response.status === 400) {
          throw new Error(`Bad request: ${errorData.error?.message || 'Unknown error'}`);
        }
        throw new Error(`API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  },

  /**
   * Score semantic criteria using Claude
   * @param {string} apiKey - User's API key
   * @param {Object} content - Normalized content
   * @param {string} textForAnalysis - Cleaned text from parser
   * @returns {Promise<Object>} Scoring results for semantic criteria
   */
  async scoreSemanticCriteria(apiKey, content, textForAnalysis) {
    const systemPrompt = `You are an expert technical documentation analyst specializing in AI-friendly documentation.
Your task is to score documentation based on specific criteria that affect how well AI assistants can understand and use the content.

Score each criterion on a 0-10 scale:
- 10: Excellent, no issues
- 7-9: Good, minor improvements possible
- 4-6: Needs work, several issues
- 1-3: Poor, major issues
- 0: Completely fails the criterion

For each criterion, provide:
1. A numeric score (0-10)
2. A brief explanation
3. Specific issues found (if any)
4. Concrete fix suggestions

Respond in valid JSON format only.`;

    const prompt = `Analyze this documentation page for AI-friendliness.

## Page Information
URL: ${content.meta.url}
Title: ${content.meta.title}

## Content
${textForAnalysis}

## Criteria to Evaluate

### CS-03: Step Atomicity
Does each procedural step contain only ONE action? Look for compound actions like "Click X and then select Y" which should be separate steps.

### CS-05: Workflow Separation
Is the content focused on ONE primary workflow? Or does it mix multiple workflows (e.g., install AND usage AND troubleshooting)?

### OR-01: Outcome Clarity
After describing actions, does the doc clearly state what changes/happens as a result?

### OR-02: Affected Data
Does the doc explicitly state what data or settings are affected by actions?

### OR-03: Reversibility
For actions that change state, does the doc indicate whether they can be undone?

### OR-04: Destructive Warnings
Are destructive actions (delete, remove, uninstall) clearly marked with warnings about consequences?

### GAP-03: No Dangling References
Do sections start with clear context, or do they begin with "This", "It", "These" without clear antecedents?

### GAP-04: Self-Sufficient Sections
Can each section be understood independently, or does it rely on "as mentioned above" without restating key info?

### PP-01: Scope Defined
Is it clear who can perform the actions and under what conditions?

### PP-02: Plan Requirements
Are pricing plan or edition requirements mentioned where relevant?

### PP-03: Permission Requirements
Are required roles or permissions clearly stated?

### PP-04: Preconditions
Are prerequisites or preconditions called out before procedures?

### AV-02: Term Conflation
Are there terms used interchangeably that should have distinct meanings (e.g., delete vs remove)?

Respond with this exact JSON structure:
{
  "scores": {
    "CS-03": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "CS-05": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "OR-01": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "OR-02": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "OR-03": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "OR-04": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "GAP-03": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "GAP-04": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "PP-01": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "PP-02": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "PP-03": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "PP-04": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] },
    "AV-02": { "score": N, "explanation": "...", "issues": ["..."], "fixes": ["..."] }
  },
  "summary": "Brief overall assessment",
  "topIssues": ["Top 3 most important issues to fix"]
}`;

    const response = await this.request(apiKey, prompt, systemPrompt);

    // Extract text content from response
    const textContent = response.content?.find(c => c.type === 'text')?.text;
    if (!textContent) {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('Failed to parse Claude response:', textContent);
      throw new Error('Failed to parse Claude response as JSON');
    }
  },

  /**
   * Test API key validity
   * @param {string} apiKey - API key to test
   * @returns {Promise<boolean>} Whether the key is valid
   */
  async testApiKey(apiKey) {
    try {
      await this.request(apiKey, 'Say "API key verified" and nothing else.');
      return true;
    } catch (error) {
      if (error.message.includes('Invalid API key')) {
        return false;
      }
      throw error;
    }
  },

  /**
   * Transform Claude scores to standard format
   * @param {Object} claudeScores - Raw scores from Claude
   * @returns {Object} Transformed scores matching rule-based format
   */
  transformScores(claudeScores) {
    const transformed = {};

    Object.entries(claudeScores.scores || {}).forEach(([criterionId, data]) => {
      transformed[criterionId] = {
        criterionId,
        score: data.score,
        issues: (data.issues || []).map((issue, i) => ({
          severity: data.score < 4 ? 'critical' : data.score < 7 ? 'warning' : 'info',
          message: issue,
          fix: data.fixes?.[i] || 'Review and improve this area'
        })),
        details: data.explanation
      };
    });

    return {
      scores: transformed,
      summary: claudeScores.summary,
      topIssues: claudeScores.topIssues || []
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClaudeClient;
}
