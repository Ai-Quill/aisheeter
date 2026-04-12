/**
 * @file AgentAnalyzer.gs
 * @version 3.0.0
 * @updated 2026-04-03
 * @author AISheeter Team
 * 
 * ============================================
 * AGENT ANALYZER - AI-Powered Data Analysis
 * ============================================
 * 
 * Analyzes spreadsheet data using AI to provide intelligent suggestions.
 * All analysis logic delegated to AI — no hardcoded pattern matching.
 * 
 * CHANGELOG:
 * - 3.0.0 (2026-04-03): Removed all hardcoded pattern detection.
 *   Removed: generateProactiveSuggestions, analyzeColumnPatterns,
 *   analyzeNumericPattern, analyzeTextLength, analyzeEmailPattern,
 *   analyzeURLPattern, analyzeHeaderSemantics, createSuggestionFromPattern,
 *   getPrebuiltFormulaSuggestions, checkForFormulaSolution, matchFormulaTask,
 *   parseThresholdsFromCommand, parseKeywordsFromCommand, buildIFSFormula,
 *   buildKeywordIFSFormula, detectColumnType, getFormulaSuggestion.
 *   All suggestions now go through AI.
 * - 2.0.0 (2026-01-16): AI-powered analysis
 * - 1.0.0 (2026-01-15): Initial implementation
 */

// ============================================
// ANALYSIS CONSTANTS
// ============================================

var ANALYSIS_SAMPLE_SIZE = 10;
var MAX_SUGGESTIONS = 3;

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Analyze data and generate suggestions using AI.
 * Called from Sidebar_Agent_Suggestions.html.
 * 
 * @param {Object} context - Unified context from AgentContext
 * @return {Object} { suggestions: Array, analysis: Object }
 */
function analyzeDataForSuggestions(context) {
  if (!context || !context.selectionInfo) {
    Logger.log('[Analyzer] No context provided');
    return { suggestions: [], analysis: {} };
  }
  
  try {
    var startTime = Date.now();
    
    var sampleData = getSampleDataForAI(context);
    if (!sampleData || sampleData.rows.length === 0) {
      return { suggestions: [], analysis: { empty: true } };
    }
    
    var suggestions = getAISuggestions(sampleData, context);
    
    var analysis = {
      method: 'ai',
      sampleSize: sampleData.rows.length,
      headers: sampleData.headers,
      suggestionCount: suggestions.length,
      duration: Date.now() - startTime
    };
    
    Logger.log('[Analyzer] Analysis completed in ' + analysis.duration + 'ms: ' + 
               suggestions.length + ' suggestions (ai)');
    
    return {
      suggestions: suggestions,
      analysis: analysis
    };
    
  } catch (e) {
    Logger.log('[Analyzer] Error: ' + e.message);
    return { 
      suggestions: getFallbackSuggestions(context), 
      analysis: { error: e.message, fallback: true } 
    };
  }
}

// ============================================
// DATA SAMPLING
// ============================================

/**
 * Get sample values from a specific column
 */
function getSampleValuesForColumn(col, startRow, count) {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var range = sheet.getRange(col + startRow + ':' + col + (startRow + count - 1));
    return range.getValues().map(function(row) { return row[0]; }).filter(function(v) {
      return v !== null && v !== undefined && v !== '';
    });
  } catch (e) {
    return [];
  }
}

/**
 * Get structured sample data for AI analysis
 */
function getSampleDataForAI(context) {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var selInfo = context.selectionInfo;
    
    var headers = [];
    if (selInfo && selInfo.headers) {
      headers = selInfo.headers.map(function(h) { 
        return { column: h.column, name: h.name || h.column };
      });
    }
    
    var dataRange = selInfo?.dataRange;
    var dataRows = [];
    
    if (dataRange) {
      var rangeObj = sheet.getRange(dataRange);
      dataRows = rangeObj.getValues().slice(0, ANALYSIS_SAMPLE_SIZE);
    } else {
      var startRow = selInfo?.dataStartRow || 2;
      var endRow = Math.min(startRow + ANALYSIS_SAMPLE_SIZE - 1, selInfo?.dataEndRow || startRow + 9);
      var lastCol = sheet.getLastColumn();
      
      if (lastCol > 0 && endRow >= startRow) {
        var range = sheet.getRange(startRow, 1, endRow - startRow + 1, lastCol);
        dataRows = range.getValues();
      }
    }
    
    var emptyColumnsRaw = selInfo?.emptyColumns || [];
    var emptyColumns = emptyColumnsRaw.map(function(c) {
      return typeof c === 'object' ? c.column : c;
    });
    
    return {
      headers: headers,
      rows: dataRows,
      emptyColumns: emptyColumns,
      rowCount: selInfo?.dataRowCount || dataRows.length
    };
    
  } catch (e) {
    Logger.log('[Analyzer] getSampleDataForAI error: ' + e.message);
    return { headers: [], rows: [], emptyColumns: [] };
  }
}

// ============================================
// AI-POWERED SUGGESTIONS
// ============================================

/**
 * Use AI to generate contextual suggestions
 */
function getAISuggestions(sampleData, context) {
  var dataDescription = buildDataDescription(sampleData);
  var prompt = buildAnalysisPrompt(dataDescription, sampleData);
  
  Logger.log('[Analyzer] Calling AI for suggestions, prompt length: ' + prompt.length);
  
  var parsed = parseModelSelection(getAgentModel());
  var provider = parsed.provider;
  var apiKey = getUserApiKey(provider);
  
  if (!apiKey) {
    Logger.log('[Analyzer] No API key, using fallback');
    return getFallbackSuggestions(context);
  }
  
  var result = callAIForAnalysis(prompt, provider, apiKey);
  
  if (result && result.suggestions) {
    var formatted = formatAISuggestions(result.suggestions, sampleData, context);
    Logger.log('[Analyzer] AI returned ' + formatted.length + ' suggestions');
    return formatted;
  }
  
  return getFallbackSuggestions(context);
}

/**
 * Build data description for AI prompt
 */
function buildDataDescription(sampleData) {
  var desc = '';
  
  if (sampleData.headers && sampleData.headers.length > 0) {
    desc += 'COLUMNS:\n';
    sampleData.headers.forEach(function(h) {
      desc += '  ' + h.column + ': "' + h.name + '"\n';
    });
  }
  
  desc += 'ROWS: ' + sampleData.rowCount + '\n\n';
  
  if (sampleData.rows && sampleData.rows.length > 0) {
    desc += 'SAMPLE DATA (first ' + sampleData.rows.length + ' rows):\n';
    sampleData.rows.forEach(function(row, i) {
      var vals = [];
      for (var j = 0; j < row.length; j++) {
        var header = sampleData.headers[j] ? sampleData.headers[j].name : 'Col' + j;
        var val = row[j] !== null && row[j] !== undefined ? String(row[j]).substring(0, 60) : '';
        vals.push(header + ': ' + val);
      }
      desc += '  Row ' + (i + 1) + ': ' + vals.join(' | ') + '\n';
    });
  }
  
  return desc;
}

/**
 * Build AI analysis prompt
 */
function buildAnalysisPrompt(dataDescription, sampleData) {
  var emptyColumns = sampleData.emptyColumns || [];
  var emptyColStr = emptyColumns.length > 0 ? emptyColumns.join(', ') : 'next available';
  
  return 'Analyze this spreadsheet data and suggest up to 3 useful actions.\n\n' +
    dataDescription + '\n' +
    'Available output columns: ' + emptyColStr + '\n\n' +
    'Return JSON with this exact format:\n' +
    '{\n' +
    '  "suggestions": [\n' +
    '    {\n' +
    '      "icon": "emoji",\n' +
    '      "title": "Short title (max 40 chars)",\n' +
    '      "description": "What this does (max 100 chars)",\n' +
    '      "command": "The exact command to execute",\n' +
    '      "priority": 1\n' +
    '    }\n' +
    '  ]\n' +
    '}\n\n' +
    'RULES:\n' +
    '- Suggest actions relevant to THIS specific data\n' +
    '- Use actual column letters and names from the data\n' +
    '- Use available output columns for new data\n' +
    '- Commands should be clear, specific, single actions\n' +
    '- Prioritize: 1=most useful, 3=least useful\n' +
    '- Do NOT suggest actions that delete or overwrite existing data\n' +
    '- Return ONLY valid JSON, no markdown';
}

/**
 * Call AI API to generate analysis
 */
function callAIForAnalysis(prompt, provider, apiKey) {
  var url, payload, options;
  var modelId = Config.getDefaultModel(provider);
  
  switch (provider) {
    case 'GEMINI':
      url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey;
      payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
          responseMimeType: 'application/json'
        }
      };
      break;
      
    case 'CHATGPT':
      url = 'https://api.openai.com/v1/chat/completions';
      payload = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' }
      };
      break;
      
    case 'CLAUDE':
      url = 'https://api.anthropic.com/v1/messages';
      payload = {
        model: modelId,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      };
      break;
      
    case 'GROQ':
      url = 'https://api.groq.com/openai/v1/chat/completions';
      payload = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' }
      };
      break;
      
    default:
      Logger.log('[Analyzer] Unknown provider: ' + provider);
      return null;
  }
  
  options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
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
      Logger.log('[Analyzer] ' + provider + ' API error: ' + responseCode);
      return null;
    }
    
    var result = JSON.parse(response.getContentText());
    var text = extractTextFromResponse(result, provider);
    
    if (text) {
      return parseJSONResponse(text);
    }
    
  } catch (e) {
    Logger.log('[Analyzer] API call error: ' + e.message);
  }
  
  return null;
}

/**
 * Extract text content from different API response formats
 */
function extractTextFromResponse(result, provider) {
  try {
    switch (provider) {
      case 'GEMINI':
        return result.candidates?.[0]?.content?.parts?.[0]?.text;
      case 'CHATGPT':
      case 'GROQ':
        return result.choices?.[0]?.message?.content;
      case 'CLAUDE':
        return result.content?.[0]?.text;
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

/**
 * Parse JSON response, handling markdown code blocks
 */
function parseJSONResponse(text) {
  if (!text) return null;
  
  try {
    text = text.trim();
    
    if (text.startsWith('```json')) {
      text = text.replace(/```json\n?/, '').replace(/```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/```\n?/, '').replace(/```$/, '');
    }
    
    return JSON.parse(text);
  } catch (e) {
    Logger.log('[Analyzer] Failed to parse JSON: ' + e.message);
    Logger.log('[Analyzer] Raw text: ' + text.substring(0, 200));
    return null;
  }
}

/**
 * Format and validate AI suggestions
 */
function formatAISuggestions(suggestions, sampleData, context) {
  if (!Array.isArray(suggestions)) return [];
  
  var emptyColumns = sampleData.emptyColumns || [];
  var dataColumns = sampleData.headers
    .filter(function(h) { return emptyColumns.indexOf(h.column) === -1; })
    .map(function(h) { return h.column; });
  
  return suggestions
    .filter(function(s) {
      if (!s || !s.title || !s.command) return false;
      
      var inputMatch = s.command.match(/(?:based on|from)\s+column\s+([A-Z])/i) ||
                       s.command.match(/column\s+([A-Z])(?:\s+to|$)/i);
      
      if (inputMatch) {
        var inputCol = inputMatch[1].toUpperCase();
        if (emptyColumns.indexOf(inputCol) !== -1) {
          Logger.log('[Analyzer] Filtered out suggestion - input column ' + inputCol + ' is empty');
          return false;
        }
        if (dataColumns.length > 0 && dataColumns.indexOf(inputCol) === -1) {
          Logger.log('[Analyzer] Filtered out suggestion - input column ' + inputCol + ' has no data');
          return false;
        }
      }
      
      return true;
    })
    .map(function(s) {
      return {
        type: 'ai',
        icon: s.icon || '✨',
        title: String(s.title).substring(0, 40),
        description: String(s.description || '').substring(0, 100),
        action: 'ai-suggestion',
        command: s.command,
        priority: s.priority || 3
      };
    })
    .slice(0, MAX_SUGGESTIONS);
}

// ============================================
// FALLBACK SUGGESTIONS
// ============================================

/**
 * Generate basic fallback suggestions without AI
 */
function getFallbackSuggestions(context) {
  var suggestions = [];
  var selInfo = context?.selectionInfo;
  
  if (!selInfo) return suggestions;
  
  var dataCol = selInfo.columnsWithData?.[0] || 'A';
  var emptyColRaw = selInfo.emptyColumns?.[0];
  var emptyCol = (typeof emptyColRaw === 'object' ? emptyColRaw?.column : emptyColRaw) || 'E';
  
  if (selInfo.dataRowCount > 0) {
    suggestions.push({
      type: 'fallback',
      icon: '🏷️',
      title: 'Classify Data',
      description: 'Categorize items (Hot/Warm/Cold)',
      action: 'classify',
      command: 'Classify as Hot/Warm/Cold based on column ' + dataCol + ' to column ' + emptyCol,
      priority: 1
    });
    
    suggestions.push({
      type: 'fallback',
      icon: '📝',
      title: 'Summarize',
      description: 'Summarize the content in column ' + dataCol,
      action: 'summarize',
      command: 'Summarize column ' + dataCol + ' to column ' + emptyCol,
      priority: 2
    });
    
    suggestions.push({
      type: 'fallback',
      icon: '🔍',
      title: 'Extract Key Info',
      description: 'Extract key information from column ' + dataCol,
      action: 'extract',
      command: 'Extract key info from column ' + dataCol + ' to column ' + emptyCol,
      priority: 3
    });
  }
  
  return suggestions.slice(0, 3);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString ? num.toLocaleString() : String(num);
}

function colToLetter(col) {
  var letter = '';
  while (col >= 0) {
    letter = String.fromCharCode(65 + (col % 26)) + letter;
    col = Math.floor(col / 26) - 1;
  }
  return letter;
}

// ============================================
// MODULE LOADED
// ============================================

Logger.log('📦 AgentAnalyzer v3.0 (AI-Only) loaded');
