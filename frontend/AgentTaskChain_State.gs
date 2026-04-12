/**
 * @file AgentTaskChain_State.gs
 * @version 2.0.0
 * @updated 2026-02-10
 * @author AISheeter Team
 * 
 * ============================================
 * AGENT TASK CHAIN - State Management
 * ============================================
 * 
 * Manages chain state persistence and retrieval:
 * - Save/load chain state to UserProperties
 * - Automatic cleanup of old chain data
 * - Job status checking and chain advancement
 * - Property storage quota management
 * 
 * Part of the AgentTaskChain module suite:
 * - AgentTaskChain_Parse.gs    (parsing & suggestions)
 * - AgentTaskChain_Execute.gs  (execution flow)
 * - AgentTaskChain_Plan.gs     (plan building)
 * - AgentTaskChain_State.gs    (this file)
 * - AgentTaskChain_Analyze.gs  (analyze/chat steps)
 * 
 * Depends on:
 * - AgentTaskChain_Execute.gs (executeNextStep - for chain advancement)
 * - AgentTaskChain_Plan.gs (generateSmartHeader - for result writing)
 * - Jobs.gs (getJobStatus, writeJobResults)
 */

// ============================================
// CHAIN STATE MANAGEMENT
// ============================================

/**
 * Save chain state to user properties with retry logic
 * Automatically cleans up old chains to prevent quota overflow.
 * 
 * @param {Object} chainState - Chain state object
 * @param {number} [retries] - Number of retries (default 3)
 */
function saveChainState(chainState, retries) {
  retries = retries || 3;
  var lastError = null;
  
  // Clean up debug info and completed step data before saving (reduce payload size)
  delete chainState._debug;
  for (var i = 0; i < chainState.steps.length; i++) {
    delete chainState.steps[i]._lastJobStatus;
    delete chainState.steps[i]._lastJobProgress;
    // Clear bulky fields from completed steps
    if (chainState.steps[i].status === 'completed' || chainState.steps[i].status === 'skipped' || chainState.steps[i].status === 'error' || chainState.steps[i].status === 'failed') {
      delete chainState.steps[i].toolCall;
      delete chainState.steps[i].prompt;
      delete chainState.steps[i]._jobChunkMap;
      delete chainState.steps[i]._completedChunkIds;
      delete chainState.steps[i].bulkPrompt;
      delete chainState.steps[i].bulkOutputHeaders;
      delete chainState.steps[i].data;
      // Keep config for error diagnosis but trim if too large
      if (chainState.steps[i].config && JSON.stringify(chainState.steps[i].config).length > 500) {
        chainState.steps[i].config = { _trimmed: true, range: chainState.steps[i].config.range };
      }
    }
  }
  
  // PRIMARY: Save to database via API (no size limit)
  for (var attempt = 0; attempt < retries; attempt++) {
    try {
      var userId = getUserId();
      ApiClient.post('AGENT_CHAIN_STATE', {
        chainId: chainState.chainId,
        userId: userId,
        state: chainState
      });
      
      // Store just the chainId pointer in PropertiesService (for quick lookup)
      try {
        var props = PropertiesService.getUserProperties();
        props.setProperty('activeChainId', chainState.chainId);
      } catch (propErr) {
        // Non-fatal — DB is the source of truth
        Logger.log('[TaskChain] PropertiesService pointer save failed (non-fatal): ' + propErr.message);
      }
      
      return; // Success
    } catch (e) {
      lastError = e;
      Logger.log('[TaskChain] DB save attempt ' + (attempt + 1) + ' failed: ' + e.message);
      
      if (attempt < retries - 1) {
        Utilities.sleep(100 * Math.pow(2, attempt));
      }
    }
  }
  
  // FALLBACK: If DB save failed, try PropertiesService (legacy path)
  Logger.log('[TaskChain] ⚠️ DB save failed, falling back to PropertiesService');
  try {
    var props = PropertiesService.getUserProperties();
    var key = 'chain_' + chainState.chainId;
    var jsonStr = JSON.stringify(chainState);
    
    // If too large for PropertiesService, aggressively trim
    if (jsonStr.length > 8000) {
      for (var ci = 0; ci < chainState.steps.length; ci++) {
        if (chainState.steps[ci].chatResponse && chainState.steps[ci].chatResponse.length > 200) {
          chainState.steps[ci].chatResponse = chainState.steps[ci].chatResponse.substring(0, 200) + '...';
        }
        if (chainState.steps[ci].data) {
          chainState.steps[ci].data = null;
        }
      }
      jsonStr = JSON.stringify(chainState);
    }
    
    props.setProperty(key, jsonStr);
    props.setProperty('activeChainId', chainState.chainId);
    Logger.log('[TaskChain] Saved to PropertiesService fallback (' + jsonStr.length + ' chars)');
  } catch (fallbackErr) {
    Logger.log('[TaskChain] ❌ Both DB and PropertiesService save failed: ' + fallbackErr.message);
    throw lastError; // Throw the original DB error
  }
}

/**
 * Lightweight cleanup: remove completed chain properties not in active list
 * Called on every save to prevent gradual accumulation.
 */
function _cleanupOldChains(props) {
  try {
    var allKeys = props.getKeys();
    var activeChains = JSON.parse(props.getProperty('activeChains') || '[]');
    var activeSet = {};
    activeChains.forEach(function(id) { activeSet['chain_' + id] = true; });
    
    var removed = 0;
    allKeys.forEach(function(key) {
      if (key.startsWith('chain_') && key !== 'activeChains' && !activeSet[key]) {
        props.deleteProperty(key);
        removed++;
      }
      // Also clean up orphaned chatResp_ keys
      if (key.startsWith('chatResp_')) {
        var chainId = key.split('_')[1];
        if (!activeSet['chain_' + chainId]) {
          props.deleteProperty(key);
          removed++;
        }
      }
    });
    
    if (removed > 0) {
      Logger.log('[TaskChain] Cleanup: removed ' + removed + ' orphaned chain properties');
    }
  } catch (e) {
    Logger.log('[TaskChain] Cleanup error (non-fatal): ' + e.message);
  }
}

/**
 * Deep cleanup: aggressively free property storage when quota is hit.
 * Removes all chain data, old analytics, and trims history.
 */
function _deepCleanupProperties() {
  try {
    var props = PropertiesService.getUserProperties();
    var allKeys = props.getKeys();
    var removedCount = 0;
    
    // Remove ALL chain properties and their chat responses
    allKeys.forEach(function(key) {
      if (key.startsWith('chain_') || key === 'activeChains' || key.startsWith('chatResp_')) {
        props.deleteProperty(key);
        removedCount++;
      }
    });
    
    // Remove analytics
    props.deleteProperty('pendingAnalytics');
    removedCount++;
    
    // Trim task history to last 5
    try {
      var history = JSON.parse(props.getProperty('agentRecentTasks') || '[]');
      if (history.length > 5) {
        props.setProperty('agentRecentTasks', JSON.stringify(history.slice(0, 5)));
      }
    } catch (e2) { /* ignore */ }
    
    Logger.log('[TaskChain] Deep cleanup: removed ' + removedCount + ' properties');
  } catch (e) {
    Logger.log('[TaskChain] Deep cleanup error: ' + e.message);
  }
}

/**
 * Manual cleanup function — can be called from frontend or script editor
 * to free up property storage quota.
 * @return {Object} Cleanup summary
 */
function cleanupPropertyStorage() {
  var props = PropertiesService.getUserProperties();
  var allKeys = props.getKeys();
  var before = allKeys.length;
  
  _deepCleanupProperties();
  
  var after = props.getKeys().length;
  var result = {
    before: before,
    after: after,
    removed: before - after
  };
  Logger.log('[Cleanup] Result: ' + JSON.stringify(result));
  return result;
}

/**
 * Get chain state from user properties
 * Also checks and updates job status for running steps (enables progress tracking)
 * 
 * PERFORMANCE OPTIMIZATION (2026-01-21):
 * - Added minimum interval between job status checks (2 seconds)
 * - Prevents excessive API calls when frontend polls frequently
 * - Saves ~200-300ms per redundant check
 * 
 * @param {string} chainId - Chain ID
 * @return {Object|null} Chain state or null
 */
function getChainState(chainId) {
  var chainState = null;
  
  // PRIMARY: Load from database via API
  try {
    var userId = getUserId();
    var result = ApiClient.get('AGENT_CHAIN_STATE', { chainId: chainId, userId: userId });
    if (result && result.state) {
      chainState = result.state;
    }
  } catch (dbErr) {
    Logger.log('[TaskChain] DB load failed, trying PropertiesService fallback: ' + dbErr.message);
  }
  
  // FALLBACK: Load from PropertiesService (legacy or DB-down)
  if (!chainState) {
    try {
      var props = PropertiesService.getUserProperties();
      var key = 'chain_' + chainId;
      var data = props.getProperty(key);
      if (data) {
        chainState = JSON.parse(data);
        Logger.log('[TaskChain] Loaded from PropertiesService fallback');
      }
    } catch (propErr) {
      Logger.log('[TaskChain] PropertiesService load also failed: ' + propErr.message);
    }
  }
  
  if (!chainState) return null;
  
  // If chain is running, check status of running steps
  if (chainState.status === 'running') {
    try {
      // PERFORMANCE: Only check job status if enough time has passed
      var now = new Date().getTime();
      var lastCheck = chainState._lastStatusCheck || 0;
      var MIN_CHECK_INTERVAL = 2000; // 2 seconds minimum between checks
      
      if (now - lastCheck >= MIN_CHECK_INTERVAL) {
        chainState._lastStatusCheck = now;
        var result = checkRunningStepsStatus(chainState);
        // Only save if modified AND executeNextStep didn't already save
        if (result.modified && !result.savedByNextStep) {
          saveChainState(chainState);
        }
      } else {
        Logger.log('[TaskChain] Skipping job status check (last check ' + (now - lastCheck) + 'ms ago)');
      }
    } catch (e) {
      chainState._debug = chainState._debug || [];
      chainState._debug.push({
        time: new Date().toISOString(),
        error: 'checkRunningStepsStatus failed: ' + e.message
      });
      if (chainState._debug.length > 5) {
        chainState._debug = chainState._debug.slice(-5);
      }
    }
  }
  
  return chainState;
}

/**
 * Check status of running steps and advance chain if needed
 * This enables the polling mechanism to track progress
 * 
 * @param {Object} chainState - Chain state
 * @return {Object} { modified: boolean, savedByNextStep: boolean }
 */
function checkRunningStepsStatus(chainState) {
  var modified = false;
  var savedByNextStep = false; // Prevent double-save when executeNextStep already saved
  
  for (var i = 0; i < chainState.steps.length; i++) {
    var step = chainState.steps[i];
    
    // BATCH RESUME: If a step is pending_resume, the previous GAS call yielded
    // after hitting the time/count limit. Resume execution now (fresh GAS call).
    if (step.status === 'pending_resume') {
      Logger.log('[TaskChain] ▶️ Resuming batch execution at step ' + (i + 1));
      step.status = 'pending';
      chainState._batchStartTime = null; // Fresh time budget for new GAS invocation
      chainState._batchCounter = 0;
      modified = true;
      executeNextStep(chainState.chainId, chainState);
      savedByNextStep = true;
      break; // Only resume one batch per poll
    }
    
    if (step.status === 'running') {
      // Check if step has a job ID
      if (!step.jobId) {
        Logger.log('[TaskChain] ⚠️ Step ' + (i + 1) + ' is running but has NO jobId!');
        // This means the job creation failed silently - mark as failed
        step.status = 'failed';
        step.error = 'No job was created for this step';
        // DON'T set chainState.status = 'failed' — let remaining steps execute
        modified = true;
        // Trigger next step to continue the chain
        executeNextStep(chainState.chainId, chainState);
        savedByNextStep = true;
        continue;
      }
      
      // === CHUNKED JOB POLLING (multiple parallel jobs per step) ===
      if (step._chunkedJob && step.allJobIds && step.allJobIds.length > 1) {
        var chunkResult = _checkChunkedJobsStatus(step, chainState, i);
        if (chunkResult.modified) {
          modified = true;
          if (chunkResult.savedByNextStep) savedByNextStep = true;
        }
        continue;
      }
      
      // === SINGLE JOB POLLING ===
      try {
        Logger.log('[TaskChain] Checking job status for step ' + (i + 1) + ': ' + step.jobId);
        Logger.log('[TaskChain] Step outputRange: ' + step.outputRange);
        var jobStatus = getJobStatus(step.jobId);
        Logger.log('[TaskChain] Job results count: ' + (jobStatus.results ? jobStatus.results.length : 0));
        
        // Store for frontend visibility (this was previously done in getChainState too - now only here)
        step._lastJobStatus = jobStatus ? jobStatus.status : 'unknown';
        step._lastJobProgress = jobStatus ? (jobStatus.progress || 0) : 0;
        
        Logger.log('[TaskChain] Job ' + step.jobId + ' status: ' + JSON.stringify({
          status: jobStatus && jobStatus.status,
          progress: jobStatus && jobStatus.progress,
          error: jobStatus && jobStatus.error
        }));
        
        if (jobStatus && jobStatus.status === 'completed') {
          Logger.log('[TaskChain] ✅ Step ' + (i + 1) + ' job completed!');
          
          // CRITICAL: Write job results to the sheet (this was missing!)
          // Without this, jobs complete but no data is written!
          var results = jobStatus.results || [];
          if (results.length > 0 && step.outputRange) {
            Logger.log('[TaskChain] 📝 Writing ' + results.length + ' results to ' + step.outputRange);
            
            // Extract output column and start row from outputRange (e.g., "G8:G15")
            var rangeMatch = step.outputRange.match(/([A-Z]+)(\d+)/i);
            var outputColumn = rangeMatch ? rangeMatch[1] : 'G';
            var startRow = rangeMatch ? parseInt(rangeMatch[2]) : 2;
            
            try {
              var sheet = SpreadsheetApp.getActiveSheet();
              
              // CRITICAL: Check if multi-aspect (split results into multiple columns)
              var isMultiAspect = step.outputColumns && step.outputColumns.length > 1 && 
                                  step.outputFormat && step.outputFormat.indexOf('|') !== -1;
              
              if (isMultiAspect) {
                Logger.log('[TaskChain] 🔀 Multi-aspect detected: ' + step.outputColumns.length + ' aspects');
                Logger.log('[TaskChain] 🔀 Output format: ' + step.outputFormat);
                Logger.log('[TaskChain] 🔀 Columns: ' + step.outputColumns.join(', '));
                
                // Split results
                var aspectCount = step.outputColumns.length;
                var columnResults = [];
                for (var colIdx = 0; colIdx < aspectCount; colIdx++) {
                  columnResults.push([]);
                }
                
                results.forEach(function(result, rowIdx) {
                  var output = String(result.output || '').trim();
                  // Split on |, ||, or ||| separators (AI may use any variant)
                  var parts = output.split(/\|{1,3}/).map(function(p) { return p.trim(); });
                  
                  if (rowIdx < 3) {
                    Logger.log('[TaskChain] 🔀 Row ' + rowIdx + ': "' + output + '" → [' + parts.join(', ') + ']');
                  }
                  
                  for (var colIdx = 0; colIdx < aspectCount; colIdx++) {
                    var value = parts[colIdx] || '';
                    columnResults[colIdx].push({
                      index: result.index,
                      output: value,
                      input: result.input
                    });
                  }
                });
                
                // Write each aspect to its column
                step.outputColumns.forEach(function(col, colIdx) {
                  Logger.log('[TaskChain] 📝 Writing aspect ' + (colIdx + 1) + ' to column ' + col);
                  
                  // Write header using universal cell protection
                  if (chainState.addHeaders) {
                    var headerRow = startRow - 1;
                    if (headerRow >= 1) {
                      var aspects = step.outputFormat.split('|').map(function(a) { return a.trim(); });
                      var headerText = aspects[colIdx] || ('Aspect ' + (colIdx + 1));
                      _safeWriteHeader(sheet, col, headerRow, headerText, false);
                    }
                  }
                  
                  var writeResult = writeJobResults(columnResults[colIdx], col, startRow);
                  Logger.log('[TaskChain] 📝 Column ' + col + ' write result: ' + writeResult.successCount + ' success');
                });
                
                step.writeResult = { successCount: results.length, errorCount: 0 };
              } else {
                // Single-column write
                // Write column header using universal cell protection
                if (chainState.addHeaders && outputColumn) {
                  var headerRow = startRow - 1;
                  if (headerRow >= 1) {
                    var headerText = generateSmartHeader(step.description, step.action);
                    if (headerText.length > 40) {
                      headerText = headerText.substring(0, 37) + '...';
                    }
                    _safeWriteHeader(sheet, outputColumn, headerRow, headerText, false);
                  }
                }
                
                var writeResult = writeJobResults(results, outputColumn, startRow);
                Logger.log('[TaskChain] 📝 Write result: ' + writeResult.successCount + ' success, ' + writeResult.errorCount + ' errors');
                step.writeResult = writeResult;
              }
            } catch (writeError) {
              Logger.log('[TaskChain] ❌ Failed to write results: ' + writeError.message);
              step.writeError = writeError.message;
              step.status = 'failed';
              step.error = 'Failed to write results: ' + writeError.message;
              // DON'T set chainState.status = 'failed' — let remaining steps execute
              modified = true;
              // Trigger next step to continue the chain
              executeNextStep(chainState.chainId, chainState);
              savedByNextStep = true;
              continue;
            }
          } else {
            Logger.log('[TaskChain] ⚠️ No results to write or no outputRange! results=' + results.length + ', outputRange=' + step.outputRange);
          }
          
          step.status = 'completed';
          step.completedAt = new Date().toISOString();
          modified = true;
          
          // Trigger next step (this saves chain state internally)
          executeNextStep(chainState.chainId, chainState);
          savedByNextStep = true;
          
        } else if (jobStatus && jobStatus.status === 'failed') {
          Logger.log('[TaskChain] ❌ Step ' + (i + 1) + ' job failed: ' + (jobStatus.error || 'Unknown error'));
          step.status = 'failed';
          step.error = jobStatus.error || 'Job failed';
          // DON'T set chainState.status = 'failed' — let remaining steps execute
          modified = true;
          // Trigger next step to continue the chain
          executeNextStep(chainState.chainId, chainState);
          savedByNextStep = true;
        } else if (jobStatus && (jobStatus.status === 'queued' || jobStatus.status === 'processing')) {
          // Job is still being processed - check if worker is running
          Logger.log('[TaskChain] Job ' + step.jobId + ' still ' + jobStatus.status + ', waiting...');
        } else {
          Logger.log('[TaskChain] ⚠️ Unknown job status: ' + (jobStatus && jobStatus.status || 'null'));
        }
        
      } catch (e) {
        Logger.log('[TaskChain] Error checking job status: ' + e.message);
        Logger.log('[TaskChain] Error stack: ' + (e.stack || 'N/A'));
        
        // Store error in step for frontend visibility
        step._lastJobStatus = 'error: ' + e.message;
        
        // If quota error, stop the chain to prevent burning more quota
        if (e.message && (e.message.indexOf('too many times') > -1 || 
                          e.message.indexOf('urlfetch') > -1 ||
                          e.message.indexOf('quota') > -1)) {
          Logger.log('[TaskChain] ❌ QUOTA ERROR - marking step failed, continuing chain...');
          step.status = 'failed';
          step.error = 'Google API quota exceeded. Please try again later.';
          chainState._quotaError = true;
          // DON'T set chainState.status = 'failed' — let remaining steps attempt execution
          // Remaining steps may not require API calls (e.g., sheet actions, formulas)
          modified = true;
          // Trigger next step to continue the chain
          executeNextStep(chainState.chainId, chainState);
          savedByNextStep = true;
        }
      }
    }
  }
  
  return { modified: modified, savedByNextStep: savedByNextStep };
}

/**
 * Get all active chains for current user
 * 
 * @return {Array} List of chain states
 */
function getActiveChains() {
  var props = PropertiesService.getUserProperties();
  var activeChains = JSON.parse(props.getProperty('activeChains') || '[]');
  
  return activeChains.map(function(chainId) {
    return getChainState(chainId);
  }).filter(function(state) {
    return state !== null;
  });
}

/**
 * Clear a chain state
 * 
 * @param {string} chainId - Chain ID
 */
function clearChainState(chainId) {
  var props = PropertiesService.getUserProperties();
  props.deleteProperty('chain_' + chainId);
  
  var activeChains = JSON.parse(props.getProperty('activeChains') || '[]');
  var index = activeChains.indexOf(chainId);
  if (index !== -1) {
    activeChains.splice(index, 1);
    props.setProperty('activeChains', JSON.stringify(activeChains));
  }
}

// ============================================
// RETRY FAILED CHUNKS
// ============================================

/**
 * Retry only the failed chunks for a completed-with-errors chunked step.
 * Creates new jobs for just the failed chunks and re-enters the polling loop.
 * 
 * @param {string} chainId - Chain ID
 * @param {number} stepIndex - Index of the step to retry
 * @return {Object} { success, message, retryJobCount }
 */
function retryFailedChunks(chainId, stepIndex) {
  var chainState = getChainState(chainId);
  if (!chainState) {
    return { success: false, error: 'Chain not found: ' + chainId };
  }
  
  var step = chainState.steps[stepIndex];
  if (!step || !step._retryInfo || !step._retryable) {
    return { success: false, error: 'Step is not retryable' };
  }
  
  var retryInfo = step._retryInfo;
  var failedChunks = retryInfo.failedChunks || [];
  
  if (failedChunks.length === 0) {
    return { success: false, error: 'No failed chunks to retry' };
  }
  
  Logger.log('[RetryChunks] Retrying ' + failedChunks.length + ' failed chunks for step ' + (stepIndex + 1));
  
  // Read sheet data to get input for failed rows
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(chainState.sheetName) ||
              SpreadsheetApp.getActiveSheet();
  var fullDataRange = sheet.getDataRange();
  var allData = fullDataRange.getValues();
  var headers = allData[0] || [];
  var dataRows = allData.slice(1);
  
  // Build input data for each row
  var allInputData = [];
  for (var r = 0; r < dataRows.length; r++) {
    var rowParts = [];
    for (var c = 0; c < headers.length; c++) {
      var cellValue = dataRows[r][c];
      if (cellValue !== '' && cellValue !== null && cellValue !== undefined) {
        var headerName = headers[c] || String.fromCharCode(65 + c);
        rowParts.push(headerName + ': ' + cellValue);
      }
    }
    allInputData.push(rowParts.join('; '));
  }
  
  // Get model from chain state
  var modelSelection = chainState.model || getAgentModel();
  var parsedModel = parseModelSelection(modelSelection);
  var model = parsedModel.provider;
  var specificModel = chainState.specificModel || parsedModel.specificModel;
  
  // Create new jobs for each failed chunk
  var newJobIds = [];
  var newJobChunkMap = {};
  
  for (var i = 0; i < failedChunks.length; i++) {
    var chunk = failedChunks[i];
    var chunkInput = allInputData.slice(chunk.startIdx, chunk.startIdx + chunk.rowCount);
    
    try {
      var job = createBulkJob(chunkInput, retryInfo.bulkPrompt, model, specificModel);
      newJobIds.push(job.id);
      newJobChunkMap[job.id] = {
        startIdx: chunk.startIdx,
        rowCount: chunk.rowCount,
        chunkIndex: chunk.chunkIndex
      };
      
      Logger.log('[RetryChunks] Retry job ' + job.id + ' created for chunk ' + chunk.chunkIndex + 
                 ' (' + chunkInput.length + ' rows at offset ' + chunk.startIdx + ')');
                 
      logJobActivity({
        jobId: job.id,
        action: 'retried',
        message: 'Retrying failed chunk ' + chunk.chunkIndex + ' (' + chunkInput.length + ' rows)',
        details: { originalJobId: chunk.jobId, chainId: chainId }
      });
    } catch (jobError) {
      Logger.log('[RetryChunks] ❌ Failed to create retry job for chunk ' + chunk.chunkIndex + ': ' + jobError.message);
    }
  }
  
  if (newJobIds.length === 0) {
    return { success: false, error: 'Failed to create any retry jobs' };
  }
  
  // Reset step for re-polling
  step.status = 'running';
  step.error = null;
  step._retryable = false;
  step.allJobIds = (step.allJobIds || []).concat(newJobIds);
  step._completedChunkIds = step._completedChunkIds || [];
  step._failedChunks = [];
  step._totalChunks = (step._totalChunks || 0) + newJobIds.length;
  
  // Merge new job chunk map into existing
  var existingMap = step._jobChunkMap || {};
  Object.keys(newJobChunkMap).forEach(function(k) {
    existingMap[k] = newJobChunkMap[k];
  });
  step._jobChunkMap = existingMap;
  
  saveChainState(chainState);
  
  // Trigger workers
  triggerWorkerAsync(newJobIds);
  
  Logger.log('[RetryChunks] ✅ ' + newJobIds.length + ' retry jobs created and triggered');
  
  return {
    success: true,
    chainId: chainId,
    message: 'Retrying ' + newJobIds.length + ' failed chunk(s)',
    retryJobCount: newJobIds.length
  };
}

// ============================================
// CHUNKED JOB POLLING
// ============================================

/**
 * Check status of a chunked step (multiple parallel chunk jobs).
 * Writes results to the sheet as each chunk completes (incremental).
 * Only polls jobs not yet confirmed complete to minimize API calls.
 * 
 * @param {Object} step - Step with _chunkedJob=true
 * @param {Object} chainState - Chain state
 * @param {number} stepIndex - Step index
 * @return {Object} { modified, savedByNextStep }
 */
function _checkChunkedJobsStatus(step, chainState, stepIndex) {
  var allJobIds = step.allJobIds;
  var completedChunkIds = step._completedChunkIds || [];
  var jobChunkMap = step._jobChunkMap || {};
  var totalChunks = step._totalChunks || allJobIds.length;
  var modified = false;
  var savedByNextStep = false;
  var hasFailure = false;
  var failedChunks = step._failedChunks || []; // Track which chunks failed
  
  Logger.log('[ChunkedJob] Polling step ' + (stepIndex + 1) + ': ' + 
             completedChunkIds.length + '/' + totalChunks + ' chunks complete');
  
  // Only poll jobs we haven't confirmed complete yet
  for (var j = 0; j < allJobIds.length; j++) {
    var jid = allJobIds[j];
    if (completedChunkIds.indexOf(jid) !== -1) continue; // Already handled
    
    try {
      var jobStatus = getJobStatus(jid);
      
      if (jobStatus && jobStatus.status === 'completed') {
        Logger.log('[ChunkedJob] ✅ Chunk job ' + jid + ' completed (' + 
                   (jobStatus.results ? jobStatus.results.length : 0) + ' results)');
        
        // Write this chunk's results to the sheet immediately
        var results = jobStatus.results || [];
        if (results.length > 0) {
          var chunkMeta = jobChunkMap[jid] || { startIdx: 0 };
          _writeChunkResults(step, results, chunkMeta.startIdx);
        }
        
        completedChunkIds.push(jid);
        modified = true;
        
        // Log success activity
        logJobActivity({
          jobId: jid,
          action: 'chunk_completed',
          message: 'Chunk completed: ' + (results.length || 0) + ' rows written',
          details: { 
            chunkIndex: (jobChunkMap[jid] || {}).chunkIndex,
            startIdx: (jobChunkMap[jid] || {}).startIdx,
            rowCount: results.length,
            chainId: chainState.chainId
          }
        });
        
      } else if (jobStatus && jobStatus.status === 'failed') {
        Logger.log('[ChunkedJob] ❌ Chunk job ' + jid + ' failed: ' + (jobStatus.error || 'Unknown'));
        completedChunkIds.push(jid);
        hasFailure = true;
        modified = true;
        
        // Track this specific failed chunk for retry
        var failedMeta = jobChunkMap[jid] || { startIdx: 0, rowCount: 0 };
        failedChunks.push({
          jobId: jid,
          chunkIndex: failedMeta.chunkIndex,
          startIdx: failedMeta.startIdx,
          rowCount: failedMeta.rowCount,
          error: jobStatus.error || 'Unknown error'
        });
        
        // Log failure activity
        logJobActivity({
          jobId: jid,
          action: 'chunk_failed',
          message: 'Chunk failed: ' + (jobStatus.error || 'Unknown'),
          details: {
            chunkIndex: failedMeta.chunkIndex,
            startIdx: failedMeta.startIdx,
            rowCount: failedMeta.rowCount,
            chainId: chainState.chainId
          }
        });
        
      } else {
        // Still processing — update progress
        Logger.log('[ChunkedJob] Job ' + jid + ' still ' + (jobStatus ? jobStatus.status : 'unknown'));
      }
    } catch (pollErr) {
      Logger.log('[ChunkedJob] Error polling job ' + jid + ': ' + pollErr.message);
    }
  }
  
  // Update step progress info
  step._completedChunkIds = completedChunkIds;
  step._failedChunks = failedChunks;
  step._lastJobProgress = Math.floor((completedChunkIds.length / totalChunks) * 100);
  step._lastJobStatus = completedChunkIds.length + '/' + totalChunks + ' chunks done' +
                         (failedChunks.length > 0 ? ' (' + failedChunks.length + ' failed)' : '');
  
  // Check if ALL chunks are done
  if (completedChunkIds.length >= totalChunks) {
    Logger.log('[ChunkedJob] 🏁 All ' + totalChunks + ' chunks complete for step ' + (stepIndex + 1) +
               (failedChunks.length > 0 ? ' (' + failedChunks.length + ' failed)' : ''));
    
    step.status = hasFailure ? 'error' : 'completed';
    step.completedAt = new Date().toISOString();
    step.writeResult = {
      successCount: chainState.rowCount || 0,
      errorCount: failedChunks.length,
      isChunked: true,
      totalChunks: totalChunks,
      failedChunks: failedChunks.length,
      failedChunkDetails: failedChunks // Preserve for retry
    };
    
    if (hasFailure) {
      step.error = failedChunks.length + ' chunk(s) failed — partial results written. ' +
                   'Failed rows: ' + failedChunks.map(function(c) { 
                     return c.startIdx + '-' + (c.startIdx + c.rowCount - 1);
                   }).join(', ');
      step._retryable = true; // Flag that this step can be retried
      step._retryInfo = {
        failedChunks: failedChunks,
        outputColumns: step.outputColumns,
        bulkPrompt: step.bulkPrompt,
        bulkChunkSize: step.bulkChunkSize || 50,
        dataStartRow: step._bulkDataStartRow
      };
    }
    
    // CRITICAL: Clean bulk metadata from completed step to save PropertiesService quota.
    // The _jobChunkMap and allJobIds can be large for many chunks.
    delete step._jobChunkMap;
    delete step._completedChunkIds;
    delete step.bulkPrompt;
    delete step.bulkOutputHeaders;
    
    modified = true;
    
    // Advance chain to next step
    executeNextStep(chainState.chainId, chainState);
    savedByNextStep = true;
  }
  
  return { modified: modified, savedByNextStep: savedByNextStep };
}

/**
 * Write results from a single chunk job to the correct sheet position.
 * Each chunk writes to the rows corresponding to its startIdx offset.
 * 
 * @param {Object} step - Step with output column info
 * @param {Array} results - Job results [{index, output, ...}]
 * @param {number} chunkStartIdx - Starting row index (0-based) for this chunk
 */
function _writeChunkResults(step, results, chunkStartIdx) {
  var dataStartRow = step._bulkDataStartRow || 2;
  var outputColumns = step.outputColumns || [];
  var isMultiColumn = outputColumns.length > 1 && step.outputFormat && step.outputFormat.indexOf('|') !== -1;
  
  // Sort results by index for orderly writing
  results.sort(function(a, b) { return (a.index || 0) - (b.index || 0); });
  
  var sheet = SpreadsheetApp.getActiveSheet();
  
  // CRITICAL: Each chunk job's results have index 0-based within the chunk
  // (because each createBulkJob call creates a fresh input_data array).
  // We must add chunkStartIdx to get the absolute row offset in the full dataset.
  
  if (isMultiColumn) {
    // Multi-column: split pipe-separated output into columns
    for (var r = 0; r < results.length; r++) {
      var output = String(results[r].output || '').trim();
      // result.index is 0-based within the chunk; add chunkStartIdx for absolute position
      var localIdx = results[r].index !== undefined ? results[r].index : r;
      var absoluteIdx = chunkStartIdx + localIdx;
      var targetRow = dataStartRow + absoluteIdx;
      var parts = output.split(/\|{1,3}/).map(function(p) { return p.trim(); });
      
      for (var c = 0; c < outputColumns.length; c++) {
        var value = parts[c] || '';
        var colNum = outputColumns[c].charCodeAt(0) - 64; // A=1, B=2, ...
        try {
          sheet.getRange(targetRow, colNum).setValue(value);
        } catch (writeErr) {
          Logger.log('[ChunkWrite] Error writing row ' + targetRow + ' col ' + outputColumns[c] + ': ' + writeErr.message);
        }
      }
    }
  } else {
    // Single column: write directly
    var outputCol = outputColumns[0] || 'A';
    for (var r = 0; r < results.length; r++) {
      var output = String(results[r].output || '').trim();
      var localIdx = results[r].index !== undefined ? results[r].index : r;
      var absoluteIdx = chunkStartIdx + localIdx;
      var targetRow = dataStartRow + absoluteIdx;
      var colNum = outputCol.charCodeAt(0) - 64;
      try {
        sheet.getRange(targetRow, colNum).setValue(output);
      } catch (writeErr) {
        Logger.log('[ChunkWrite] Error writing row ' + targetRow + ': ' + writeErr.message);
      }
    }
  }
  
  Logger.log('[ChunkWrite] Wrote ' + results.length + ' results for chunk at offset ' + chunkStartIdx + 
             ' (indices ' + dataStartRow + '+' + chunkStartIdx + '...' + (chunkStartIdx + results.length - 1) + ')' +
             ' to columns ' + outputColumns.join(','));
}

// ============================================
// MODULE LOADED
// ============================================

Logger.log('📦 AgentTaskChain_State module loaded');
