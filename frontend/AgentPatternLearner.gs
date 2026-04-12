/**
 * ============================================
 * AGENT PATTERN LEARNER
 * ============================================
 * 
 * Backend API client for pattern learning.
 * All pattern detection logic lives server-side.
 * This file only handles: retrieve, save, feedback, preferences.
 * 
 * CHANGELOG:
 * - 2.0.0 (2026-04-03): Removed all frontend heuristic detection
 *   (detectThresholdPattern, detectKeywordPattern, detectRangePattern,
 *    findNumericColumns, findTextColumns, checkThresholdForColumn, etc.)
 *   All pattern detection delegated to backend AI.
 * - 1.0.0 (2026-01-16): Initial implementation
 * 
 * ============================================
 */

/**
 * Retrieve stored patterns from backend that match the current data shape
 * Called before running AI to check if a known pattern exists
 * 
 * @param {Array<string>} headers - Column headers
 * @param {string} patternType - e.g., 'threshold', 'keyword', 'classify'
 * @return {Array<Object>} Matching patterns with formula templates
 */
function retrieveStoredPatterns(headers, patternType) {
  try {
    var userId = getUserId();
    if (!userId) return [];
    
    var params = {
      userId: userId,
      resource: 'patterns',
      patternType: patternType || '',
      minAccuracy: '0.85'
    };
    
    var result = ApiClient.get('AGENT_LEARNING', params);
    
    if (result && result.patterns && result.patterns.length > 0) {
      Logger.log('[PatternLearner] Found ' + result.patterns.length + ' stored patterns');
      return result.patterns;
    }
    
    return [];
  } catch (e) {
    Logger.log('[PatternLearner] Failed to retrieve patterns: ' + e.message);
    return [];
  }
}

/**
 * Stub: Pattern detection is now handled server-side.
 * Kept because Sidebar_Agent_PatternLearning.html calls it.
 * Always returns { hasPattern: false } — backend handles detection.
 */
function analyzeResultsForPattern(params) {
  Logger.log('[PatternLearner] analyzeResultsForPattern called — delegating to backend');
  return { hasPattern: false, reason: 'Pattern detection moved to backend' };
}

/**
 * Save a detected pattern to the backend for cross-session learning
 * Called from sidebar JS (savePatternToHistory)
 * 
 * @param {Object} pattern - Pattern object
 * @param {Object} jobData - Job context data
 * @return {Object} { success: boolean }
 */
function savePatternToBackend(pattern, jobData) {
  try {
    var userId = getUserId();
    if (!userId) {
      Logger.log('[PatternLearner] No userId available, skipping save');
      return { success: false, reason: 'no_user' };
    }
    
    var payload = {
      type: 'pattern',
      userId: userId,
      patternType: pattern.patternType || 'unknown',
      formulaTemplate: pattern.formula || null,
      accuracy: pattern.accuracy || 0,
      dataShape: {
        columns: jobData && jobData.headers ? jobData.headers : [],
        rowCount: jobData && jobData.rowCount ? jobData.rowCount : 0
      },
      columnTypes: pattern.columnTypes || null
    };
    
    var result = ApiClient.post('AGENT_LEARNING', payload);
    Logger.log('[PatternLearner] Pattern saved to backend: ' + (result.success ? 'OK' : 'FAILED'));
    return { success: true };
  } catch (e) {
    Logger.log('[PatternLearner] Failed to save pattern: ' + e.message);
    return { success: false, reason: e.message };
  }
}

/**
 * Submit analysis feedback to backend
 * Called from sidebar JS (feedback buttons)
 * 
 * @param {string} queryText - Original analysis question
 * @param {string} feedback - 'up' or 'down'
 * @param {string} correctionCategory - Optional category
 * @param {Object} dataShape - Optional data shape info
 * @return {Object} { success: boolean }
 */
function submitAnalysisFeedback(queryText, feedback, correctionCategory, dataShape) {
  try {
    var userId = getUserId();
    if (!userId) {
      return { success: false, reason: 'no_user' };
    }
    
    var payload = {
      type: 'feedback',
      userId: userId,
      queryText: queryText,
      feedback: feedback,
      correctionCategory: correctionCategory || null,
      dataShape: dataShape || null
    };
    
    var result = ApiClient.post('AGENT_LEARNING', payload);
    return { success: true };
  } catch (e) {
    Logger.log('[PatternLearner] Failed to submit feedback: ' + e.message);
    return { success: false, reason: e.message };
  }
}

/**
 * Retrieve user analysis preferences from backend.
 * Used to adjust analysis behavior based on accumulated feedback.
 * Only returns preferences with confidence >= 0.6, signal_count >= 3.
 * 
 * @return {Object} Map of preference_key -> preference_value
 */
function getUserAnalysisPreferences() {
  try {
    var userId = getUserId();
    if (!userId) return {};
    
    var result = ApiClient.get('AGENT_LEARNING', {
      userId: userId,
      resource: 'preferences'
    });
    
    if (result && result.preferences && result.preferences.length > 0) {
      var prefs = {};
      result.preferences.forEach(function(p) {
        prefs[p.preference_key] = p.preference_value;
      });
      Logger.log('[PatternLearner] Retrieved ' + Object.keys(prefs).length + ' user preferences');
      return prefs;
    }
    
    return {};
  } catch (e) {
    Logger.log('[PatternLearner] Failed to retrieve preferences: ' + e.message);
    return {};
  }
}
