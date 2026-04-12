/**
 * @file AgentTaskChain_Analyze.gs
 * @version 2.0.0
 * @updated 2026-02-10
 * @author AISheeter Team
 * 
 * ============================================
 * AGENT TASK CHAIN - Analyze Step Execution
 * ============================================
 * 
 * Handles the "analyze" action type which returns AI-generated
 * insights to the chat sidebar (not written to cells):
 * - Execute analyze steps with data context
 * - Heuristic fast-path for known question patterns
 * - AI-powered analysis via direct API calls
 * - Fallback data summary when AI unavailable
 * 
 * Part of the AgentTaskChain module suite:
 * - AgentTaskChain_Parse.gs    (parsing & suggestions)
 * - AgentTaskChain_Execute.gs  (execution flow)
 * - AgentTaskChain_Plan.gs     (plan building)
 * - AgentTaskChain_State.gs    (state management)
 * - AgentTaskChain_Analyze.gs  (this file)
 * 
 * Depends on:
 * - Agent.gs (getAgentModel, getUserApiKey)
 * - Config.gs (Config.getDefaultModel)
 */

// ============================================
// ANALYZE STEP EXECUTION (CHAT OUTPUT)
// ============================================

/**
 * Execute an analyze step that returns results to chat (not cells)
 * 
 * @param {Object} step - Step configuration
 * @param {Object} plan - Execution plan
 * @param {Object} chainState - Chain state
 * @return {Object} { response: string }
 */
function _executeAnalyzeStep(step, plan, chainState) {
  Logger.log('[TaskChain] _executeAnalyzeStep called');
  Logger.log('[TaskChain] Step fields: question=' + (step.question || 'N/A').substring(0, 80) + 
    ', description=' + (step.description || 'N/A').substring(0, 80) + 
    ', prompt=' + (step.prompt || 'N/A').substring(0, 80));
  
  var sheet = SpreadsheetApp.getActiveSheet();
  
  try {
    // IMPORTANT: Get the full data range including headers from row 1
    var fullDataRange = sheet.getDataRange();
    var allData = fullDataRange.getValues();
    
    // Row 0 is headers, rest is data
    var headers = allData[0] || [];
    var dataRows = allData.slice(1);
    var rowCount = dataRows.length;
    
    Logger.log('[TaskChain] Analyze: Got ' + headers.length + ' headers, ' + rowCount + ' data rows');
    Logger.log('[TaskChain] Headers: ' + headers.slice(0, 5).join(', '));
    
    // Build the question/prompt
    var question = step.question || step.prompt || step.description || 'Analyze this data';
    
    // If the question seems generic but the original prompt has more detail, use the prompt
    var questionLower = question.toLowerCase();
    var specificKeywords = ['top', 'total', 'best', 'compare', 'summary', 'who', 'which', 
                            'highest', 'lowest', 'average', 'most', 'least', 'how many', 
                            'what is', 'tell me', 'industry', 'category', 'revenue', 'popular'];
    var hasSpecificKeyword = specificKeywords.some(function(kw) { return questionLower.indexOf(kw) !== -1; });
    var isGenericQuestion = !hasSpecificKeyword || 
                            questionLower === 'analyze this data' || 
                            questionLower === 'analyze data' ||
                            questionLower === 'analyze data patterns';
    
    if (isGenericQuestion && step.prompt && step.prompt.length > question.length) {
      Logger.log('[TaskChain] Question seems generic ("' + question.substring(0, 50) + '"), using original prompt instead');
      question = step.prompt;
    }
    
    Logger.log('[TaskChain] Final question for analysis: ' + question.substring(0, 150));
    
    // Pre-compute statistics for all numeric columns
    var columnStats = _computeColumnStatistics(headers, dataRows);
    
    // Fetch user analysis preferences (learned from feedback)
    var userPrefs = {};
    try {
      userPrefs = getUserAnalysisPreferences();
    } catch (prefErr) {
      Logger.log('[TaskChain] Could not load user preferences: ' + prefErr.message);
    }
    
    // Generate analysis response
    var response = _generateAnalysisSummary(headers, dataRows, rowCount, question, chainState, columnStats, userPrefs);
    
    Logger.log('[TaskChain] Analysis response generated: ' + response.substring(0, 200));
    
    return { response: response };
    
  } catch (e) {
    Logger.log('[TaskChain] Error in _executeAnalyzeStep: ' + e.message);
    return { response: 'Could not analyze data: ' + e.message };
  }
}

/**
 * Pre-compute statistics for all columns
 * Ensures accuracy (LLMs miscount) and reduces token waste
 */
function _computeColumnStatistics(headers, dataRows) {
  var stats = {};
  
  for (var colIdx = 0; colIdx < headers.length; colIdx++) {
    var header = headers[colIdx];
    if (!header) continue;
    
    var values = [];
    var numericValues = [];
    var emptyCount = 0;
    var uniqueSet = {};
    
    for (var r = 0; r < dataRows.length; r++) {
      var val = dataRows[r][colIdx];
      var strVal = (val !== null && val !== undefined) ? String(val).trim() : '';
      
      if (strVal === '') {
        emptyCount++;
        continue;
      }
      
      values.push(strVal);
      if (uniqueSet[strVal] === undefined) uniqueSet[strVal] = 0;
      uniqueSet[strVal]++;
      
      // Try to parse as number (strip currency/percent symbols)
      var numVal = parseFloat(strVal.replace(/[$%,]/g, ''));
      if (!isNaN(numVal)) {
        numericValues.push(numVal);
      }
    }
    
    var uniqueKeys = Object.keys(uniqueSet);
    var isNumeric = numericValues.length > values.length * 0.5;
    
    var colStat = {
      header: header,
      type: isNumeric ? 'numeric' : 'text',
      totalCount: dataRows.length,
      nonEmptyCount: values.length,
      emptyCount: emptyCount,
      missingPct: dataRows.length > 0 ? Math.round((emptyCount / dataRows.length) * 1000) / 10 : 0,
      uniqueCount: uniqueKeys.length
    };
    
    if (isNumeric && numericValues.length > 0) {
      numericValues.sort(function(a, b) { return a - b; });
      var sum = 0;
      for (var i = 0; i < numericValues.length; i++) sum += numericValues[i];
      var mean = sum / numericValues.length;
      
      // Median
      var mid = Math.floor(numericValues.length / 2);
      var median = numericValues.length % 2 !== 0 ? numericValues[mid] : (numericValues[mid - 1] + numericValues[mid]) / 2;
      
      // Standard deviation
      var sqDiffSum = 0;
      for (var i = 0; i < numericValues.length; i++) {
        sqDiffSum += Math.pow(numericValues[i] - mean, 2);
      }
      var stdDev = Math.sqrt(sqDiffSum / numericValues.length);
      
      // IQR for outlier detection
      var q1Idx = Math.floor(numericValues.length * 0.25);
      var q3Idx = Math.floor(numericValues.length * 0.75);
      var q1 = numericValues[q1Idx];
      var q3 = numericValues[q3Idx];
      var iqr = q3 - q1;
      
      colStat.min = numericValues[0];
      colStat.max = numericValues[numericValues.length - 1];
      colStat.sum = Math.round(sum * 100) / 100;
      colStat.mean = Math.round(mean * 100) / 100;
      colStat.median = Math.round(median * 100) / 100;
      colStat.stdDev = Math.round(stdDev * 100) / 100;
      colStat.q1 = q1;
      colStat.q3 = q3;
      colStat.iqr = iqr;
      colStat.numericValues = numericValues;
    } else if (!isNumeric) {
      // Top 5 most common values for text columns
      var sorted = uniqueKeys.sort(function(a, b) { return uniqueSet[b] - uniqueSet[a]; });
      colStat.topValues = sorted.slice(0, 5).map(function(k) { return { value: k, count: uniqueSet[k] }; });
    }
    
    stats[header] = colStat;
  }
  
  return stats;
}

/**
 * Generate analysis response using AI with pre-computed statistics.
 * All analysis questions go through the AI — no hardcoded heuristics.
 * Pre-computed stats ensure accuracy (LLMs miscount) and reduce token waste.
 */
function _generateAnalysisSummary(headers, dataRows, rowCount, question, chainState, columnStats, userPrefs) {
  Logger.log('[TaskChain] _generateAnalysisSummary called');
  Logger.log('[TaskChain] Question: ' + question);
  
  try {
    var modelSelection = (chainState && chainState.model) ? chainState.model : getAgentModel();
    var parsed = parseModelSelection(modelSelection);
    var provider = parsed.provider;
    var apiKey = getUserApiKey(provider);
    
    if (!apiKey) {
      Logger.log('[TaskChain] No API key for ' + provider + ', falling back to data summary');
      return _buildStructuredFallback(headers, dataRows, rowCount, columnStats);
    }
    
    // Build data context with pre-computed statistics
    var dataContext = 'SPREADSHEET DATA:\n\n';
    dataContext += 'Columns: ' + headers.filter(Boolean).join(', ') + '\n';
    dataContext += 'Total rows: ' + rowCount + '\n\n';
    
    // Include pre-computed column statistics
    dataContext += 'COLUMN STATISTICS (pre-computed, use these instead of counting manually):\n';
    for (var h in columnStats) {
      var cs = columnStats[h];
      if (cs.type === 'numeric') {
        dataContext += '- ' + h + ' [numeric]: min=' + cs.min + ', max=' + cs.max + 
          ', mean=' + cs.mean + ', median=' + cs.median + ', sum=' + cs.sum + 
          ', stdDev=' + cs.stdDev + ', missing=' + cs.missingPct + '%\n';
      } else {
        dataContext += '- ' + h + ' [text]: ' + cs.uniqueCount + ' unique values, missing=' + cs.missingPct + '%';
        if (cs.topValues && cs.topValues.length > 0) {
          dataContext += ', top: ' + cs.topValues.slice(0, 3).map(function(tv) { return tv.value + '(' + tv.count + ')'; }).join(', ');
        }
        dataContext += '\n';
      }
    }
    
    // Include sample data — up to 50 rows for better context, or all if small
    var sampleSize = Math.min(rowCount, 50);
    dataContext += '\nData (' + (rowCount <= 50 ? 'all' : 'first ' + sampleSize) + ' rows):\n';
    for (var i = 0; i < sampleSize; i++) {
      var row = dataRows[i];
      var rowParts = [];
      for (var j = 0; j < headers.length; j++) {
        if (headers[j]) {
          var val = (row[j] !== null && row[j] !== undefined) ? String(row[j]).substring(0, 60) : '';
          rowParts.push(headers[j] + ': ' + val);
        }
      }
      dataContext += (i + 1) + '. ' + rowParts.join(' | ') + '\n';
    }
    
    // For large datasets, also include last 5 rows for tail context
    if (rowCount > 50) {
      dataContext += '\n... (rows ' + (sampleSize + 1) + '-' + (rowCount - 5) + ' omitted) ...\n\n';
      dataContext += 'Last 5 rows:\n';
      for (var i = rowCount - 5; i < rowCount; i++) {
        var row = dataRows[i];
        var rowParts = [];
        for (var j = 0; j < headers.length; j++) {
          if (headers[j]) {
            var val = (row[j] !== null && row[j] !== undefined) ? String(row[j]).substring(0, 60) : '';
            rowParts.push(headers[j] + ': ' + val);
          }
        }
        dataContext += (i + 1) + '. ' + rowParts.join(' | ') + '\n';
      }
    }
    
    var analysisPrompt = 'You are a data analyst. Answer the user\'s question about this spreadsheet data.\n\n' +
      dataContext + '\n\n' +
      'USER QUESTION: ' + question + '\n\n' +
      'INSTRUCTIONS:\n' +
      '- Structure your response with clear sections using ## headers\n' +
      '- Start with ## Overview (2-3 sentences about the data)\n' +
      '- Include ## Key Findings with specific numbers from COLUMN STATISTICS above\n' +
      '- If relevant, include ## Trends & Patterns\n' +
      '- Note any ## Outliers & Anomalies\n' +
      '- End with ## Recommendations (2-3 actionable items)\n' +
      '- Use a markdown table to present key statistics when appropriate\n' +
      '- Format currency as $X,XXX, percentages as X.X%\n' +
      '- Do NOT format years or IDs as numbers (keep "2024" not "2,024")\n' +
      '- Use **bold** for key metrics\n' +
      '- Reference specific data points (row names, values) in your findings\n' +
      '- Use the pre-computed statistics — do NOT manually count or compute averages';
    
    // Append user preference-based instructions
    if (userPrefs && Object.keys(userPrefs).length > 0) {
      analysisPrompt += '\n\nUSER PREFERENCES (learned from past feedback — follow these):';
      if (userPrefs['prefers_charts']) {
        analysisPrompt += '\n- This user prefers charts with analysis. Mention that a chart would help visualize the data and suggest a specific chart type.';
      }
      if (userPrefs['detail_level'] === 'detailed') {
        analysisPrompt += '\n- This user prefers detailed analysis. Be thorough, include more specific numbers and deeper breakdowns.';
      }
      if (userPrefs['detail_level'] === 'concise') {
        analysisPrompt += '\n- This user prefers concise analysis. Keep it focused — fewer sections, sharper conclusions.';
      }
      if (userPrefs['prefers_formatting']) {
        analysisPrompt += '\n- This user values good formatting. Use markdown tables, bold key metrics, and clear section headers.';
      }
      if (userPrefs['prefers_actionable']) {
        analysisPrompt += '\n- This user values actionable recommendations. Make the Recommendations section prominent with specific, implementable actions.';
      }
      Logger.log('[TaskChain] Injected ' + Object.keys(userPrefs).length + ' preference(s) into analysis prompt');
    }
    
    var aiResponse = _callAIForAnalysisChat(analysisPrompt, provider, apiKey, parsed.specificModel);
    
    if (aiResponse && aiResponse.trim().length > 0) {
      Logger.log('[TaskChain] AI analysis response received (' + aiResponse.length + ' chars)');
      return aiResponse;
    }
    
    Logger.log('[TaskChain] AI returned empty response, falling back to data summary');
    return _buildStructuredFallback(headers, dataRows, rowCount, columnStats);
    
  } catch (aiError) {
    Logger.log('[TaskChain] AI analysis call failed: ' + aiError.message);
    return _buildStructuredFallback(headers, dataRows, rowCount, columnStats);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Build a structured fallback when AI is not available
 */
function _buildStructuredFallback(headers, dataRows, rowCount, columnStats) {
  var response = '## Data Summary\n\n';
  response += '**' + rowCount + ' rows** across **' + headers.filter(Boolean).length + ' columns**\n\n';
  
  // Column statistics table
  response += '| Column | Type | Min | Max | Mean | Unique |\n';
  response += '| :--- | :--- | ---: | ---: | ---: | ---: |\n';
  
  for (var h in columnStats) {
    var cs = columnStats[h];
    if (cs.type === 'numeric') {
      response += '| ' + h + ' | numeric | ' + _formatNum(cs.min) + ' | ' + _formatNum(cs.max) + ' | ' + _formatNum(cs.mean) + ' | ' + cs.uniqueCount + ' |\n';
    } else {
      response += '| ' + h + ' | text | — | — | — | ' + cs.uniqueCount + ' |\n';
    }
  }
  
  response += '\nTo get specific insights, try asking about "top performers", "distribution of [column]", "compare [A] vs [B]", or "data quality".';
  return response;
}

/**
 * Format a number for display (with commas)
 */
function _formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  // Round to 2 decimal places
  n = Math.round(n * 100) / 100;
  var parts = n.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

/**
 * Call AI API to generate analysis chat response
 * Supports: GEMINI, CHATGPT, CLAUDE, GROQ
 * 
 * @param {string} prompt - Analysis prompt with data context
 * @param {string} provider - AI provider (GEMINI, CHATGPT, etc.)
 * @param {string} apiKey - User's API key
 * @param {string} [specificModel] - Optional specific model ID override
 * @return {string|null} AI response text or null
 */
function _callAIForAnalysisChat(prompt, provider, apiKey, specificModel) {
  var url, payload, options;
  var modelId = specificModel || Config.getDefaultModel(provider);
  
  Logger.log('[TaskChain] Calling ' + provider + ' (' + modelId + ') for analysis chat');
  
  switch (provider) {
    case 'GEMINI':
      url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey;
      payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3
        }
      };
      break;
      
    case 'CHATGPT':
      url = 'https://api.openai.com/v1/chat/completions';
      payload = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      };
      break;
      
    case 'CLAUDE':
      url = 'https://api.anthropic.com/v1/messages';
      payload = {
        model: modelId,
        max_tokens: 16384,
        messages: [{ role: 'user', content: prompt }]
      };
      break;
      
    case 'GROQ':
      url = 'https://api.groq.com/openai/v1/chat/completions';
      payload = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      };
      break;
      
    default:
      Logger.log('[TaskChain] Unknown provider for analysis: ' + provider);
      return null;
  }
  
  // Build request options
  options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  // Add auth headers for non-Gemini providers
  if (provider === 'CHATGPT' || provider === 'GROQ') {
    options.headers = { 'Authorization': 'Bearer ' + apiKey };
  } else if (provider === 'CLAUDE') {
    options.headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
  }
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log('[TaskChain] ' + provider + ' API error: ' + responseCode + ' - ' + response.getContentText().substring(0, 200));
      return null;
    }
    
    var result = JSON.parse(response.getContentText());
    
    // Log finish reason to help debug truncation issues
    if (provider === 'CHATGPT' || provider === 'GROQ') {
      var finishReason = result.choices && result.choices[0] ? result.choices[0].finish_reason : 'unknown';
      Logger.log('[TaskChain] ' + provider + ' finish_reason: ' + finishReason);
      if (finishReason === 'length') {
        Logger.log('[TaskChain] ⚠️ Response was truncated by token limit!');
      }
    }
    
    // Extract text from different provider response formats
    var extractedText = null;
    switch (provider) {
      case 'GEMINI':
        extractedText = result.candidates && result.candidates[0] && result.candidates[0].content && 
               result.candidates[0].content.parts && result.candidates[0].content.parts[0] ?
               result.candidates[0].content.parts[0].text : null;
        break;
      case 'CHATGPT':
      case 'GROQ':
        extractedText = result.choices && result.choices[0] && result.choices[0].message ? 
               result.choices[0].message.content : null;
        break;
      case 'CLAUDE':
        extractedText = result.content && result.content[0] ? result.content[0].text : null;
        break;
    }
    
    Logger.log('[TaskChain] Extracted response length: ' + (extractedText ? extractedText.length : 0) + ' chars');
    return extractedText;
    
  } catch (e) {
    Logger.log('[TaskChain] API call error for analysis: ' + e.message);
    return null;
  }
}

// ============================================
// PUBLIC WRAPPER FOR SIDEBAR CALLS
// ============================================

/**
 * Execute analysis directly from the sidebar chat.
 * Called when the backend returns a chat-only response but without
 * substantial analysis text (e.g., the AI called the analyze tool
 * but its text output was empty/generic). This ensures the real
 * analysis path runs: reads sheet data, calls AI, returns detailed response.
 * 
 * @param {string} question - The user's analysis question
 * @param {string} model - Model selection string
 * @return {Object} { success, response } or { success: false, error }
 */
function executeAnalysisChat(question, model) {
  Logger.log('[AnalysisChat] Direct analysis request: ' + (question || '').substring(0, 100));
  
  try {
    var step = {
      question: question,
      prompt: question,
      description: question
    };
    
    var chainState = {
      model: model || getAgentModel()
    };
    
    var result = _executeAnalyzeStep(step, null, chainState);
    
    return {
      success: true,
      response: result.response || 'Analysis complete.'
    };
  } catch (e) {
    Logger.log('[AnalysisChat] Error: ' + e.message);
    return {
      success: false,
      error: e.message
    };
  }
}

// ============================================
// MODULE LOADED
// ============================================

Logger.log('📦 AgentTaskChain_Analyze module loaded');
