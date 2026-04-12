/**
 * @file AgentTaskChain_Execute.gs
 * @version 2.0.0
 * @updated 2026-02-10
 * @author AISheeter Team
 * 
 * ============================================
 * AGENT TASK CHAIN - Execution Flow
 * ============================================
 * 
 * Handles the main execution flow of task chains:
 * - Initialize chain state and start execution
 * - Execute steps sequentially (sheet actions, formulas, AI jobs, analyze)
 * - Handle step completion callbacks
 * 
 * Part of the AgentTaskChain module suite:
 * - AgentTaskChain_Parse.gs    (parsing & suggestions)
 * - AgentTaskChain_Execute.gs  (this file)
 * - AgentTaskChain_Plan.gs     (plan building)
 * - AgentTaskChain_State.gs    (state management)
 * - AgentTaskChain_Analyze.gs  (analyze/chat steps)
 * 
 * Depends on:
 * - Agent.gs (executeAgentPlan, getAgentModel, getAgentContext)
 * - AgentTaskChain_Plan.gs (buildPlanForChainStep)
 * - AgentTaskChain_State.gs (saveChainState, getChainState)
 * - AgentTaskChain_Analyze.gs (_executeAnalyzeStep)
 * - SheetActions_Main.gs (AgentSheetActions)
 * - Jobs.gs (writeJobResults)
 */

// ============================================
// FORMULA SYNTAX NORMALIZER
// ============================================

/**
 * Normalize common cross-sheet reference syntax errors before applying a formula.
 * Fixes Excel-isms that produce #REF! in Google Sheets:
 *   '$SheetName'!A1  →  'SheetName'!A1   ($ before sheet name inside quotes)
 *   $SheetName!A1    →  SheetName!A1     ($ before sheet name without quotes)
 *   Sheet.A1         →  Sheet!A1         (dot notation)
 *
 * Also auto-wraps array formulas that Google Sheets can't evaluate without ARRAYFORMULA:
 *   MATCH(TRUE, range>0, 0)  →  MATCH(1, ARRAYFORMULA(range>0), 0)
 *   AVERAGE((R1-R2)/R2)      →  AVERAGE(ARRAYFORMULA((R1-R2)/R2))
 */
function _normalizeFormulaSyntax(formula) {
  if (!formula) return formula;
  // '$SheetName' → 'SheetName' (dollar sign inside single-quoted sheet name)
  var normalized = formula.replace(/'(\$)([^']+)'/g, "'$2'");
  // =$SheetName!  →  =SheetName!  (dollar sign before unquoted sheet name at start)
  normalized = normalized.replace(/=\$([A-Za-z_][\w\s]*!)/g, '=$1');
  // ,$SheetName! or +$SheetName! etc. (dollar sign before sheet name after operator)
  normalized = normalized.replace(/([\(,+\-\*\/])(\$)([A-Za-z_][\w\s]*!)/g, '$1$3');
  // SheetName.A1 → SheetName!A1 (dot notation for cross-sheet refs)
  normalized = normalized.replace(/([A-Za-z_][\w\s]*)\.(\$?[A-Z]+\$?\d+)/g, '$1!$2');

  // --- Array formula auto-wrapping ---
  normalized = _wrapArrayFormulas(normalized);

  if (normalized !== formula) {
    Logger.log('[FormulaNormalize] Fixed syntax: ' + formula.substring(0, 80) + ' → ' + normalized.substring(0, 80));
  }
  return normalized;
}

/**
 * Detect and wrap implicit array operations that Google Sheets requires ARRAYFORMULA for.
 *
 * Patterns handled:
 * 1. MATCH(TRUE, range>value, 0) → MATCH(1, ARRAYFORMULA(range>value), 0)
 * 2. Aggregate functions (AVERAGE, SUM, SUMPRODUCT) with range arithmetic inside
 *    e.g., AVERAGE((B3:B13-B2:B12)/B2:B12) → AVERAGE(ARRAYFORMULA((B3:B13-B2:B12)/B2:B12))
 */
function _wrapArrayFormulas(formula) {
  if (!formula) return formula;
  var upper = formula.toUpperCase();
  if (upper.indexOf('ARRAYFORMULA') >= 0) return formula; // already wrapped

  var result = formula;

  // Pattern 1: MATCH(TRUE, <expr>, <match_type>)
  // Google Sheets can't evaluate the boolean array in the 2nd arg without ARRAYFORMULA.
  // Rewrite: MATCH(TRUE, expr, n) → MATCH(1, ARRAYFORMULA(expr), n)
  var matchTrueRe = /\bMATCH\(\s*TRUE\s*,\s*/gi;
  var m;
  while ((m = matchTrueRe.exec(result)) !== null) {
    var afterMatch = result.substring(m.index + m[0].length);
    var secondArgEnd = _findArgEnd(afterMatch, 0);
    if (secondArgEnd > 0) {
      var secondArg = afterMatch.substring(0, secondArgEnd);
      var before = result.substring(0, m.index);
      var after = result.substring(m.index + m[0].length + secondArgEnd);
      result = before + 'MATCH(1, ARRAYFORMULA(' + secondArg + ')' + after;
      matchTrueRe.lastIndex = 0; // restart after mutation
    }
  }

  // Pattern 2: Aggregate functions with range arithmetic inside their arguments.
  // Detect: AVERAGE/SUM/SUMPRODUCT( <expr with range arithmetic> )
  // Range arithmetic = two range refs (e.g., B3:B13) connected by +, -, *, /
  var aggFns = ['AVERAGE', 'SUM', 'SUMPRODUCT', 'STDEV', 'VAR', 'MEDIAN'];
  for (var i = 0; i < aggFns.length; i++) {
    var fnRe = new RegExp('\\b' + aggFns[i] + '\\(', 'gi');
    var am;
    while ((am = fnRe.exec(result)) !== null) {
      var fnStart = am.index + am[0].length;
      var argEnd = _findArgEnd(result.substring(fnStart), 0);
      if (argEnd <= 0) continue;
      var innerArg = result.substring(fnStart, fnStart + argEnd);
      if (innerArg.toUpperCase().indexOf('ARRAYFORMULA') >= 0) continue;

      // Check if the argument contains range arithmetic:
      // Two range references (COL#:COL#) with an operator between them
      var hasRangeArith = /[A-Z]+\d+:[A-Z]+\d+\s*[\+\-\*\/]\s*[A-Z]+\d+/i.test(innerArg) ||
                          /[A-Z]+\d+\s*[\+\-\*\/]\s*[A-Z]+\d+:[A-Z]+\d+/i.test(innerArg);
      if (hasRangeArith) {
        var before = result.substring(0, fnStart);
        var after = result.substring(fnStart + argEnd);
        result = before + 'ARRAYFORMULA(' + innerArg + ')' + after;
        fnRe.lastIndex = 0; // restart after mutation
      }
    }
  }

  return result;
}

/**
 * Find the end position of a function argument starting at `start` in `str`.
 * Tracks parenthesis depth; returns the index of the comma or closing paren.
 */
function _findArgEnd(str, start) {
  var depth = 0;
  for (var i = start; i < str.length; i++) {
    var ch = str[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) return i;
      depth--;
    } else if (ch === ',' && depth === 0) {
      return i;
    }
  }
  return -1;
}

// ============================================
// TASK CHAIN EXECUTION
// ============================================

/**
 * Execute a multi-step task chain
 * 
 * @param {Object} chain - Parsed task chain { steps, ... }
 * @param {Object} context - Spreadsheet context
 * @return {Object} Execution result with chain job ID
 */
/**
 * Execute a task chain
 * REUSES the same context/selection logic as single-step commands
 * 
 * @param {Object} chain - Parsed chain with steps
 * @param {Object} context - Selection context from frontend
 * @return {Object} Result with chainId
 */
function executeTaskChain(chain, context) {
  if (!chain || !chain.steps || chain.steps.length === 0) {
    throw new Error('Invalid task chain');
  }
  
  Logger.log('[TaskChain] 🔗 Starting chain with ' + chain.steps.length + ' steps');
  
  // DEBUG: Log the chain object as received
  Logger.log('[TaskChain] 📥 Chain received from frontend:');
  Logger.log('  chain.inputRange: ' + chain.inputRange);
  Logger.log('  chain.inputColumn: ' + chain.inputColumn);
  Logger.log('  chain.inputColumns: ' + JSON.stringify(chain.inputColumns));
  Logger.log('  chain.inputColumns type: ' + typeof chain.inputColumns);
  Logger.log('  chain.inputColumns isArray: ' + Array.isArray(chain.inputColumns));
  Logger.log('  chain.hasMultipleInputColumns: ' + chain.hasMultipleInputColumns);
  
  // Log ALL steps to see what we received
  Logger.log('[TaskChain] 📋 All steps received:');
  chain.steps.forEach(function(step, idx) {
    Logger.log('  Step ' + (idx + 1) + ': ' + step.action + ' | desc: ' + (step.description || 'N/A').substring(0, 40));
    Logger.log('    inputColumns: ' + JSON.stringify(step.inputColumns));
    Logger.log('    outputColumn: ' + step.outputColumn);
  });
  
  // DEFENSIVE: Ensure inputColumns is an array (google.script.run can mangle arrays)
  if (chain.inputColumns && !Array.isArray(chain.inputColumns)) {
    Logger.log('[TaskChain] ⚠️ inputColumns is not an array! Converting...');
    if (typeof chain.inputColumns === 'object') {
      chain.inputColumns = Object.values(chain.inputColumns);
    } else if (typeof chain.inputColumns === 'string') {
      chain.inputColumns = chain.inputColumns.split(',');
    }
    Logger.log('[TaskChain] Converted to: ' + JSON.stringify(chain.inputColumns));
  }
  
  // === GET CONTEXT IF NOT PROVIDED ===
  if (!context || Object.keys(context).length === 0) {
    Logger.log('[TaskChain] No context provided, getting fresh context');
    context = getAgentContext();
  }
  
  Logger.log('[TaskChain] Context keys: ' + JSON.stringify(Object.keys(context)));
  
  // === EXTRACT INPUT INFORMATION ===
  var inputRange = null;
  var inputColumn = null;
  var inputColumns = [];
  var inputColumnHeaders = {};
  var hasMultipleInputColumns = false;
  var rowCount = 0;
  
  // PRIORITY 0: Chain-level configuration (set by backend)
  if (chain.inputRange) {
    Logger.log('[TaskChain] ✨ Using chain-level input config from backend');
    inputRange = chain.inputRange;
    inputColumn = chain.inputColumn || (chain.inputColumns && chain.inputColumns[0]) || inputRange.charAt(0);
    inputColumns = chain.inputColumns || [inputColumn];
    hasMultipleInputColumns = chain.hasMultipleInputColumns || inputColumns.length > 1;
    rowCount = chain.rowCount || 0;
    Logger.log('[TaskChain] Chain config: inputRange=' + inputRange + ', columns=' + inputColumns.join(','));
    
    if ((!chain.inputColumns || chain.inputColumns.length === 0) && context.selectionInfo && context.selectionInfo.columnsWithData) {
      inputColumns = context.selectionInfo.columnsWithData;
      inputColumn = inputColumns[0];
      hasMultipleInputColumns = inputColumns.length > 1;
      Logger.log('[TaskChain] ⚡ Enhanced columns from context: ' + inputColumns.join(','));
    }
  }
  // Priority 1: Use selectionInfo if available
  else if (context.selectionInfo) {
    var info = context.selectionInfo;
    inputRange = info.dataRange || info.range;
    
    if (info.columnsWithData && info.columnsWithData.length > 0) {
      inputColumns = info.columnsWithData;
      inputColumn = inputColumns[0];
      hasMultipleInputColumns = inputColumns.length > 1;
      
      if (info.selectedHeaders) {
        info.selectedHeaders.forEach(function(h) {
          if (h.column && h.name) {
            inputColumnHeaders[h.column] = h.name;
          }
        });
      }
    }
    
    rowCount = info.numRows || info.rowCount || 0;
    Logger.log('[TaskChain] Using selectionInfo: ' + inputRange + ' (' + (hasMultipleInputColumns ? 'multi-column' : 'single-column') + ')');
  }
  // Priority 2: Use selected range
  else if (context.selectedRange) {
    inputRange = context.selectedRange;
    inputColumn = inputRange.charAt(0);
    Logger.log('[TaskChain] Using selectedRange: ' + inputRange);
  }
  // Priority 3: Use columnDataRanges
  else if (context.columnDataRanges && typeof context.columnDataRanges === 'object') {
    var colKeys = Object.keys(context.columnDataRanges);
    if (colKeys.length > 0) {
      inputColumn = colKeys[0];
      inputRange = context.columnDataRanges[inputColumn].dataRange || context.columnDataRanges[inputColumn].range;
      rowCount = context.columnDataRanges[inputColumn].rowCount || 0;
      Logger.log('[TaskChain] Using columnDataRanges: ' + inputRange);
    }
  }
  
  // Priority 4: Fallback to current selection
  if (!inputRange) {
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      var selection = sheet.getActiveRange();
      if (selection) {
        inputRange = selection.getA1Notation();
        inputColumn = inputRange.charAt(0);
        rowCount = selection.getNumRows();
        Logger.log('[TaskChain] Using active selection fallback: ' + inputRange);
      }
    } catch (e) {
      Logger.log('[TaskChain] Could not get active selection: ' + e.message);
    }
  }
  
  if (!inputRange) {
    throw new Error('No input range found. Please select a range with data before running the task chain.');
  }
  
  Logger.log('[TaskChain] 📊 Input config:');
  Logger.log('  inputRange: ' + inputRange);
  Logger.log('  inputColumn: ' + inputColumn);
  Logger.log('  inputColumns: ' + JSON.stringify(inputColumns));
  Logger.log('  hasMultipleInputColumns: ' + hasMultipleInputColumns);
  Logger.log('  rowCount: ' + rowCount);
  
  // === CREATE CHAIN STATE ===
  var chainId = 'chain_' + Utilities.getUuid().substring(0, 8);
  
  var modelSelection = chain.model || getAgentModel();
  var parsedModel = parseModelSelection(modelSelection);
  var model = parsedModel.provider;
  var specificModel = parsedModel.specificModel;
  Logger.log('[TaskChain] 🤖 Using model: ' + model + (specificModel ? ' (' + specificModel + ')' : ''));
  
  var chainState = {
    chainId: chainId,
    totalSteps: chain.steps.length,
    currentStep: 0,
    status: 'running',
    model: model,
    specificModel: specificModel,
    addHeaders: chain.addHeaders || false,
    inputRange: inputRange,
    inputColumn: inputColumn,
    inputColumns: inputColumns,
    inputColumnHeaders: inputColumnHeaders,
    hasMultipleInputColumns: hasMultipleInputColumns,
    rowCount: rowCount,
    sheetName: context.sheetName || SpreadsheetApp.getActiveSheet().getName(),
    // Preserve chain-level sheetConfig (used as fallback for chart/format steps)
    sheetConfig: chain.sheetConfig || null,
    steps: chain.steps.map(function(step, idx) {
      Logger.log('[TaskChain] Copying step ' + (idx + 1) + ':');
      Logger.log('  action: ' + step.action);
      Logger.log('  inputColumns: ' + JSON.stringify(step.inputColumns));
      Logger.log('  outputColumn: ' + step.outputColumn);
      Logger.log('  formula: ' + (step.formula ? step.formula.substring(0, 50) + '...' : 'none'));
      Logger.log('  config: ' + (step.config ? JSON.stringify(step.config).substring(0, 100) + '...' : 'none'));
      
      // PASS-THROUGH ARCHITECTURE: Copy ALL properties from the backend step,
      // then overlay chain-specific execution state fields.
      // This ensures ANY backend flag (skipHeader, or future additions)
      // automatically propagates without needing to enumerate each one.
      // Previously, we selectively mapped properties and missed flags like skipHeader.
      var stepCopy = {};
      var stepKeys = Object.keys(step);
      for (var ki = 0; ki < stepKeys.length; ki++) {
        var key = stepKeys[ki];
        stepCopy[key] = step[key];
      }
      
      // Ensure critical fields have defaults
      stepCopy.id = step.id || ('step_' + (idx + 1));
      stepCopy.order = step.order || (idx + 1);
      stepCopy.action = step.action || 'process';
      stepCopy.description = step.description || '';
      stepCopy.prompt = step.prompt || step.description || '';
      stepCopy.options = step.options || step.formatOptions || null;
      
      // Chain-specific execution state (always override)
      stepCopy.status = 'pending';
      stepCopy.jobId = null;
      stepCopy.allJobIds = [];
      stepCopy.outputRange = null;
      stepCopy.result = null;
      stepCopy.error = null;
      
      return stepCopy;
    }),
    startedAt: new Date().toISOString()
  };
  
  saveChainState(chainState);
  
  Logger.log('[TaskChain] 🚀 Starting execution...');
  executeNextStep(chainState.chainId, chainState);
  
  return {
    success: true,
    chainId: chainId,
    totalSteps: chain.steps.length,
    message: 'Task chain started'
  };
}

/**
 * Execute the next step in a chain
 * REUSES the same logic as single-step execution via executeAgentPlan
 * 
 * @param {string} chainId - Chain ID or chainState object
 * @param {Object} chainStateOrContext - Chain state (if passed from executeTaskChain) or context
 */
function executeNextStep(chainId, chainStateOrContext) {
  Logger.log('[executeNextStep] Called with chainId type: ' + typeof chainId);
  
  // Handle both chainId string and chainState object
  var chainState;
  if (typeof chainId === 'string') {
    // If chainState was passed as second arg, use it directly (avoids re-fetching)
    if (chainStateOrContext && typeof chainStateOrContext === 'object' && chainStateOrContext.chainId) {
      Logger.log('[executeNextStep] Using passed chainState directly');
      chainState = chainStateOrContext;
    } else {
      Logger.log('[executeNextStep] Fetching chainState from storage');
      chainState = getChainState(chainId);
    }
  } else if (chainId && chainId.chainId) {
    chainState = chainId;
    chainId = chainState.chainId;
  }
  
  if (!chainState) {
    Logger.log('[TaskChain] Chain not found: ' + chainId);
    return;
  }
  
  // Find next pending step
  var nextStepIndex = chainState.steps.findIndex(function(s) {
    return s.status === 'pending';
  });
  
  // DEFERRED HOLISTIC SCAN: If the next pending step is the synthetic _holistic_scan,
  // run the scan now in this fresh GAS invocation, then finalize the chain.
  if (nextStepIndex >= 0 && chainState.steps[nextStepIndex].action === '_holistic_scan') {
    Logger.log('[TaskChain] ▶️ Running deferred holistic scan in fresh GAS invocation');
    // Remove the synthetic step so it doesn't appear in final results
    chainState.steps.splice(nextStepIndex, 1);
    chainState._pendingScan = false;
    chainState._pendingScanComplete = true;
    chainState._batchStartTime = Date.now(); // fresh budget for scan
    // Re-search: with synthetic step removed, nextStepIndex should be -1
    nextStepIndex = -1;
  }
  
  if (nextStepIndex === -1) {
    // All steps are in a terminal state — determine chain outcome
    var stepResults = _summarizeStepResults(chainState);
    
    // TIME CHECK: If the current batch has consumed most of the GAS budget,
    // defer the holistic scan to a fresh invocation to avoid timeout.
    var SCAN_BUDGET_MS = 240000; // need ~2 min for scan + repair cycles
    var batchElapsed = chainState._batchStartTime ? (Date.now() - chainState._batchStartTime) : 0;
    if (batchElapsed > SCAN_BUDGET_MS && !chainState._pendingScanComplete) {
      Logger.log('[TaskChain] ⏸️ Deferring holistic scan — batch elapsed ' + batchElapsed + 'ms (budget: ' + SCAN_BUDGET_MS + 'ms)');
      chainState._pendingScan = true;
      chainState._batchStartTime = null;
      chainState._batchCounter = 0;
      chainState.steps.push({
        action: '_holistic_scan',
        description: 'Verify formulas and fix errors',
        status: 'pending_resume'
      });
      saveChainState(chainState);
      return;
    }
    
    // HOLISTIC VERIFICATION: Scan all cells for formula errors after all steps complete.
    // Like xlsx skill's recalc.py — catches cascade errors that per-step checks miss.
    var holisticScan = _scanSheetForErrors(chainState);
    if (holisticScan) {
      chainState._holisticScan = holisticScan;
      var needsRepair = holisticScan.totalErrors > 0 || (holisticScan.totalSuspicious || 0) > 0;
      if (needsRepair) {
        if (holisticScan.totalErrors > 0) {
          Logger.log('[TaskChain] HOLISTIC SCAN: ' + holisticScan.totalErrors + ' formula error(s) detected across ' + 
                     holisticScan.totalFormulas + ' formulas. Locations: ' + JSON.stringify(holisticScan.errorSummary));
        }
        if ((holisticScan.totalSuspicious || 0) > 0) {
          Logger.log('[TaskChain] HOLISTIC SCAN: ' + holisticScan.totalSuspicious + ' formula column(s) produce all-zero values — likely broken references');
        }

        var maxRepairCycles = 2;
        for (var repairCycle = 0; repairCycle < maxRepairCycles; repairCycle++) {
          Logger.log('[TaskChain] 🔧 Repair cycle ' + (repairCycle + 1) + '/' + maxRepairCycles);
          var repairedScan = _requestChainRepair(chainState, holisticScan);
          if (!repairedScan) {
            Logger.log('[TaskChain] Repair cycle returned no result — stopping');
            break;
          }
          holisticScan = repairedScan;
          chainState._holisticScan = holisticScan;
          if (holisticScan.totalErrors === 0 && (holisticScan.totalSuspicious || 0) === 0) {
            Logger.log('[TaskChain] ✅ All issues resolved after repair cycle ' + (repairCycle + 1));
            break;
          }
          Logger.log('[TaskChain] Still ' + holisticScan.totalErrors + ' errors, ' + 
                     (holisticScan.totalSuspicious || 0) + ' suspicious after repair cycle ' + (repairCycle + 1));
        }
      } else {
        Logger.log('[TaskChain] HOLISTIC SCAN: ' + holisticScan.totalFormulas + ' formulas, zero errors.');
      }
    }
    
    if (stepResults.failedCount === 0 && (!holisticScan || (holisticScan.totalErrors === 0 && (holisticScan.totalSuspicious || 0) === 0))) {
      chainState.status = 'completed';
    } else if (stepResults.completedCount > 0) {
      chainState.status = 'completed_with_errors';
    } else {
      chainState.status = 'failed';
    }
    
    chainState.completedAt = new Date().toISOString();
    chainState._stepSummary = stepResults;
    saveChainState(chainState);
    Logger.log('[TaskChain] ' + (chainState.status === 'completed' ? '✅' : '⚠️') + 
               ' Chain finished: ' + chainState.status + 
               ' (' + stepResults.completedCount + '/' + stepResults.total + ' steps OK, ' + 
               stepResults.failedCount + ' failed)');
    
    // Post-completion review hook: record implicit positive feedback for analysis steps
    _recordImplicitFeedback(chainState);
    
    // Report execution outcome to backend for learning
    _reportExecutionOutcome(chainState);
    
    // Auto-cleanup: remove legacy PropertiesService chain data
    try {
      var props = PropertiesService.getUserProperties();
      props.deleteProperty('chain_' + chainState.chainId);
      Logger.log('[TaskChain] Cleaned up local PropertiesService chain key');
    } catch (cleanupErr) {
      Logger.log('[TaskChain] Local cleanup error (non-fatal): ' + cleanupErr.message);
    }
    
    return;
  }
  
  // SAFEGUARD: If this isn't step 1, ensure previous steps are completed
  if (nextStepIndex > 0) {
    var prevStep = chainState.steps[nextStepIndex - 1];
    if (prevStep.status !== 'completed') {
      Logger.log('[TaskChain] ⚠️ SAFEGUARD: Trying to start step ' + (nextStepIndex + 1) + ' but step ' + nextStepIndex + ' is ' + prevStep.status);
      Logger.log('[TaskChain] Previous step jobId: ' + prevStep.jobId);
      // If previous step is still running, don't start next step
      if (prevStep.status === 'running') {
        Logger.log('[TaskChain] Waiting for previous step to complete...');
        return;
      }
    }
  }
  
  var step = chainState.steps[nextStepIndex];
  
  Logger.log('[TaskChain] ▶️ Executing step ' + (nextStepIndex + 1) + '/' + chainState.totalSteps + ': ' + step.action);
  Logger.log('[TaskChain] Step description: ' + step.description);
  Logger.log('[TaskChain] Step status before: ' + step.status);
  Logger.log('[TaskChain] All steps status: ' + chainState.steps.map(function(s) { return s.status; }).join(', '));
  
  // BATCH YIELDING: Prevent GAS 6-minute timeout using wall-clock time tracking.
  // GAS has no ScriptApp.getRemainingExecutionTime() — we track Date.now() manually.
  // When elapsed time exceeds TIME_BUDGET_MS, yield control back to the frontend poller
  // which will call getChainState() → checkRunningStepsStatus() → executeNextStep()
  // in a fresh GAS invocation with a new 6-minute budget.
  var TIME_BUDGET_MS = 270000; // 4.5 minutes — leaves 90s buffer for save/flush/overhead
  var MAX_STEPS_PER_BATCH = 50; // safety net in case Date.now() fails
  
  if (!chainState._batchStartTime) chainState._batchStartTime = Date.now();
  if (!chainState._batchCounter) chainState._batchCounter = 0;
  chainState._batchCounter++;
  
  var elapsed = Date.now() - chainState._batchStartTime;
  if (elapsed > TIME_BUDGET_MS || chainState._batchCounter > MAX_STEPS_PER_BATCH) {
    Logger.log('[TaskChain] ⏸️ Batch yield: ' + elapsed + 'ms elapsed, ' + chainState._batchCounter + ' steps in this GAS call. Yielding at step ' + (nextStepIndex + 1));
    chainState.steps[nextStepIndex].status = 'pending_resume';
    chainState._batchCounter = 0;
    chainState._batchStartTime = null;
    saveChainState(chainState);
    return; // Yield — frontend poller will resume in a fresh GAS invocation
  }
  
  // Mark step as running
  chainState.currentStep = nextStepIndex + 1;
  chainState.steps[nextStepIndex].status = 'running';
  saveChainState(chainState);
  
  try {
    // === BUILD A PLAN FOR THIS STEP (reusing same logic as single-step) ===
    // For sheet actions (format, chart, sheetOps, etc.), the plan is only used for
    // inputRange/dataRange references. If these aren't available (empty sheet),
    // we still need to proceed since sheet actions carry their own config.
    var plan = null;
    var isSheetAction = AgentSheetActions && AgentSheetActions.isSheetAction(step.action);
    
    try {
      plan = buildPlanForChainStep(step, chainState, nextStepIndex);
    } catch (planError) {
      // Formula and analyze steps carry their own config from the backend
      // (startRow, endRow, formula, outputColumn). They don't need a full plan.
      // Sheet actions also carry their own config. Only AI-job steps truly
      // need a valid plan.inputRange.
      var stepCanSelfExecute = isSheetAction || 
        step.outputFormat === 'formula' || 
        step.outputFormat === 'chat' || 
        step.action === 'analyze';
      
      if (stepCanSelfExecute) {
        Logger.log('[TaskChain] ⚠️ buildPlanForChainStep failed (' + planError.message + ') — proceeding with step config (action: ' + step.action + ')');
        plan = {
          inputRange: chainState.inputRange || '',
          inputColumn: chainState.inputColumn || 'A',
          inputColumns: chainState.inputColumns || [],
          hasMultipleInputColumns: false,
          outputColumns: [step.outputColumn || 'A'],
          prompt: step.prompt || step.description || '',
          model: chainState.model || 'GEMINI'
        };
      } else {
        throw planError; // Re-throw for steps that truly need a plan
      }
    }
    
    if (!plan) {
      throw new Error('Failed to build plan for step');
    }
    
    Logger.log('[TaskChain] 📋 Built plan for step ' + (nextStepIndex + 1) + ':');
    Logger.log('  Step description: ' + step.description);
    Logger.log('  inputRange: ' + plan.inputRange);
    Logger.log('  inputColumn: ' + plan.inputColumn);
    Logger.log('  inputColumns: ' + JSON.stringify(plan.inputColumns));
    Logger.log('  inputColumns length: ' + (plan.inputColumns ? plan.inputColumns.length : 'null'));
    Logger.log('  hasMultipleInputColumns: ' + plan.hasMultipleInputColumns);
    Logger.log('  outputColumns: ' + plan.outputColumns.join(', '));
    Logger.log('  prompt: ' + plan.prompt.substring(0, 80) + '...');
    Logger.log('  model: ' + plan.model);
    
    // Verify we have the right data
    if (plan.hasMultipleInputColumns && (!plan.inputColumns || plan.inputColumns.length === 0)) {
      Logger.log('[TaskChain] ⚠️ WARNING: hasMultipleInputColumns is true but inputColumns is empty!');
    }
    
    // === LARGE DATASET CHUNKING ===
    // For writeData steps flagged for bulk processing (>50 rows needing per-row AI),
    // route through the bulk job system instead of one-shot writeData.
    // This creates multiple parallel chunk jobs for speed and quality.
    if (step.bulkProcessing && step.action === 'writeData') {
      // Verify the sheet actually has data before attempting bulk processing.
      // If the sheet is empty (e.g., creating a brand new dataset), bulk processing
      // cannot work — it requires existing rows to read. Fall through to regular writeData.
      var bulkSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(chainState.sheetName) ||
                      SpreadsheetApp.getActiveSheet();
      var bulkDataRange = bulkSheet.getDataRange();
      var bulkRowCount = bulkDataRange.getNumRows();
      
      if (bulkRowCount <= 1) {
        Logger.log('[TaskChain] ⚠️ Bulk processing flagged but sheet is empty (' + bulkRowCount + ' rows) — falling back to regular writeData');
        step.bulkProcessing = false;
        // Fall through to sheet action execution below
      } else {
        Logger.log('[TaskChain] 🔄 Bulk processing: routing writeData through chunk jobs (' + chainState.rowCount + ' rows)');
        try {
          _executeBulkWriteData(step, chainState, nextStepIndex);
        } catch (bulkError) {
          Logger.log('[TaskChain] ❌ Bulk writeData failed: ' + bulkError.message);
          chainState.steps[nextStepIndex].status = 'error';
          chainState.steps[nextStepIndex].error = 'Bulk processing failed: ' + bulkError.message;
          saveChainState(chainState);
          executeNextStep(chainState.chainId, chainState);
        }
        return;
      }
    }
    
    // === CHECK IF THIS IS A SHEET ACTION (chart, format, validation, filter) ===
    // Sheet actions execute instantly without AI jobs
    if (AgentSheetActions && AgentSheetActions.isSheetAction(step.action)) {
      Logger.log('[TaskChain] ⚡ Sheet action detected: ' + step.action);
      
      // MULTI-SHEET: Switch to target sheet if specified (for format, chart, conditionalFormat, etc.)
      var actionTargetSheet = step.targetSheet || (step.config && step.config.targetSheet);
      if (actionTargetSheet && step.action !== 'writeData') {
        _switchToTargetSheet(actionTargetSheet);
      }
      
      // SKIP writeData steps that have no data — these are redundant steps created by
      // the AI when it also creates formula/analyze steps for the same output columns.
      // The formula/analyze steps will produce the actual content.
      if (step.action === 'writeData') {
        var stepData = step.data || (step.config && step.config.data);
        var hasNoData = !stepData || !Array.isArray(stepData) || stepData.length === 0;
        var hasNoCopyConfig = !(step.config && step.config.dataRange && step.config.newSheet);
        
        if (hasNoData && hasNoCopyConfig) {
          Logger.log('[TaskChain] ⏩ Skipping writeData step with no data (redundant — subsequent steps will fill output)');
          chainState.steps[nextStepIndex].status = 'skipped';
          chainState.steps[nextStepIndex].completedAt = new Date().toISOString();
          chainState.steps[nextStepIndex].error = null;
          saveChainState(chainState);
          executeNextStep(chainState.chainId, chainState);
          return;
        }
      }
      
      // Build step config for sheet action
      // IMPORTANT: Step-level properties from the AI tool call take precedence over 
      // chain-level sheetConfig, since each step has its own distinct parameters.
      var stepConfig = step.config || {};
      
      // ROBUSTNESS: Also check chain-level sheetConfig as fallback
      // The SDK Agent stores config in step.config, but legacy path stores in chainState.sheetConfig
      var chainSheetConfig = chainState.sheetConfig || {};
      
      var sheetStep = {
        action: step.action,
        inputRange: plan.inputRange,
        dataRange: plan.inputRange,
        // Pass through range from AI tool call (critical for conditionalFormat, filter, etc.)
        range: step.range || stepConfig.range || chainSheetConfig.range || null,
        // Config object with step-level details merged in
        // CRITICAL: If step.config is empty but chainState.sheetConfig has data, use that
        config: (step.config && Object.keys(step.config).length > 0) ? step.config : (chainSheetConfig || {}),
        chartType: step.chartType || stepConfig.chartType || chainSheetConfig.chartType,
        formatType: step.formatType || stepConfig.formatType || chainSheetConfig.formatType,
        validationType: step.validationType || stepConfig.validationType || chainSheetConfig.validationType,
        rules: step.rules || stepConfig.rules || chainSheetConfig.rules,
        criteria: step.criteria || stepConfig.criteria || chainSheetConfig.criteria,
        options: step.options || stepConfig.options || chainSheetConfig.options || {},
        // Pass through other properties that specific actions need
        operations: step.operations || stepConfig.operations || chainSheetConfig.operations,
        startCell: step.startCell || stepConfig.startCell || chainSheetConfig.startCell,
        data: step.data || stepConfig.data || chainSheetConfig.data,
        title: step.title || stepConfig.title || chainSheetConfig.title,
        description: step.description
      };
      
      Logger.log('[TaskChain] Sheet step config: ' + JSON.stringify(sheetStep).substring(0, 500));
      Logger.log('[TaskChain] Step config keys: ' + (step.config ? Object.keys(step.config).join(',') : 'null'));
      Logger.log('[TaskChain] Step config full: ' + (step.config ? JSON.stringify(step.config).substring(0, 600) : 'null'));
      Logger.log('[TaskChain] Chain sheetConfig keys: ' + Object.keys(chainSheetConfig).join(','));
      Logger.log('[TaskChain] Step operations: ' + (sheetStep.operations ? JSON.stringify(sheetStep.operations).substring(0, 200) : 'null'));
      Logger.log('[TaskChain] Step options: ' + (sheetStep.options ? JSON.stringify(sheetStep.options).substring(0, 200) : 'null'));
      Logger.log('[TaskChain] Step range: ' + (sheetStep.range || 'null'));
      
      // Chart-specific debug: log domainColumn/dataColumns so we can verify
      // the AI tool call provided proper column config for charting
      if (step.action === 'chart') {
        var chartConfig = sheetStep.config || {};
        Logger.log('[TaskChain] 📊 CHART DEBUG:');
        Logger.log('[TaskChain]   domainColumn: ' + (chartConfig.domainColumn || 'MISSING'));
        Logger.log('[TaskChain]   dataColumns: ' + JSON.stringify(chartConfig.dataColumns || 'MISSING'));
        Logger.log('[TaskChain]   chartType: ' + (chartConfig.chartType || sheetStep.chartType || 'MISSING'));
        Logger.log('[TaskChain]   title: ' + (chartConfig.title || 'MISSING'));
        Logger.log('[TaskChain]   seriesNames: ' + JSON.stringify(chartConfig.seriesNames || 'MISSING'));
        Logger.log('[TaskChain]   inputRange: ' + (sheetStep.inputRange || 'MISSING'));
        Logger.log('[TaskChain]   config keys: ' + Object.keys(chartConfig).join(','));
      }
      
      
      // Execute sheet action
      var sheetResult = AgentSheetActions.execute(sheetStep);
      
      if (sheetResult.success) {
        Logger.log('[TaskChain] ✅ Sheet action completed: ' + sheetResult.action);
        
        // After writeData, update chainState.inputRange so subsequent formula steps
        // know the actual data range (row boundaries). On blank sheets, inputRange
        // starts as '' or 'A1' — this gives formulas the correct endRow.
        if (step.action === 'writeData' && sheetResult.result && sheetResult.result.range) {
          var writtenRange = sheetResult.result.range; // e.g., 'A1:G13'
          var prevRange = chainState.inputRange;
          // Only update if the written range is more informative than the current
          if (!prevRange || prevRange.length < writtenRange.length) {
            chainState.inputRange = writtenRange;
            // Extract row count from written range for formula boundary inference
            var rangeNums = writtenRange.match(/\d+/g);
            if (rangeNums && rangeNums.length >= 2) {
              chainState.rowCount = parseInt(rangeNums[rangeNums.length - 1]) - parseInt(rangeNums[0]) + 1;
            }
            Logger.log('[TaskChain] 📊 Updated inputRange after writeData: ' + writtenRange + ' (rowCount=' + chainState.rowCount + ')');
          }
        }
        
        // Mark step as completed immediately (sheet actions execute instantly)
        chainState.steps[nextStepIndex].status = 'completed';
        chainState.steps[nextStepIndex].completedAt = new Date().toISOString();
        chainState.steps[nextStepIndex].result = sheetResult.result;
        saveChainState(chainState);
        
        // Execute next step immediately
        executeNextStep(chainState.chainId, chainState);
      } else {
        Logger.log('[TaskChain] ❌ Sheet action failed: ' + sheetResult.error);
        
        chainState.steps[nextStepIndex].status = 'error';
        chainState.steps[nextStepIndex].error = sheetResult.error;
        // DON'T set chainState.status = 'error' — let remaining steps execute
        saveChainState(chainState);
        
        // Continue to next step despite this failure
        Logger.log('[TaskChain] ⏩ Continuing chain after step failure...');
        executeNextStep(chainState.chainId, chainState);
      }
      
      return;
    }
    
    // === CHECK IF THIS IS A FORMULA STEP ===
    // Support both step.formula (SDK Agent) and step.prompt (legacy) as formula source
    var formulaSource = null;
    Logger.log('[TaskChain] Checking for formula: outputFormat=' + step.outputFormat + 
               ', hasFormula=' + !!step.formula + 
               ', formulaValue=' + (step.formula ? step.formula.substring(0, 50) : 'none'));
    
    if (step.formula) {
      // SDK Agent path - formula from tool call
      formulaSource = step.formula.startsWith('=') ? step.formula : '=' + step.formula;
      formulaSource = _normalizeFormulaSyntax(formulaSource);
      Logger.log('[TaskChain] Using step.formula: ' + formulaSource.substring(0, 80));
    } else if (step.prompt && step.prompt.startsWith('=')) {
      // Legacy path - formula in prompt
      formulaSource = _normalizeFormulaSyntax(step.prompt);
      Logger.log('[TaskChain] Using step.prompt as formula');
    }
    
    // GUARD: If step is marked as formula but no formulaSource was found, mark as error.
    // Without this guard, formula steps with missing formula data would fall through
    // to the AI job path, which writes TEXT descriptions to cells (causing #VALUE! cascades).
    if (step.outputFormat === 'formula' && !formulaSource) {
      Logger.log('[TaskChain] ❌ Formula step has no formula data! step.formula=' + step.formula + ', step.prompt=' + (step.prompt ? step.prompt.substring(0, 50) : 'none'));
      chainState.steps[nextStepIndex].status = 'error';
      chainState.steps[nextStepIndex].error = 'Formula step missing formula data for column ' + (step.outputColumn || '?') + ' ("' + (step.description || step.action) + '")';
      chainState.steps[nextStepIndex].completedAt = new Date().toISOString();
      saveChainState(chainState);
      executeNextStep(chainState.chainId, chainState);
      return;
    }
    
    if (step.outputFormat === 'formula' && formulaSource) {
      Logger.log('[TaskChain] ⚡ Formula step detected - applying formula directly');
      Logger.log('[TaskChain] Formula: ' + formulaSource);
      
      var formulaTargetSheet = step.targetSheet || (step.config && step.config.targetSheet);
      if (formulaTargetSheet) {
        _switchToTargetSheet(formulaTargetSheet);
      }
      var sheet = SpreadsheetApp.getActiveSheet();
      
      // Extract row boundaries
      // Priority: backend-provided startRow/endRow > plan.inputRange > sheet data detection > default
      var rowNums = plan.inputRange ? plan.inputRange.match(/\d+/g) : null;
      var startRow = step.startRow || (rowNums ? parseInt(rowNums[0]) : 2);
      var endRow = step.endRow || (rowNums && rowNums.length > 1 ? parseInt(rowNums[rowNums.length - 1]) : null);
      
      // SAFETY: If endRow is still unknown, detect from column A's contiguous data.
      // Use column A (which has month labels/row identifiers) to find the actual data table boundary,
      // NOT sheet.getLastRow() which includes summary sections written below the main data.
      if (!endRow) {
        try {
          var colAValues = sheet.getRange('A1:A' + sheet.getLastRow()).getValues();
          var lastContiguousRow = 1;
          for (var ri = 1; ri < colAValues.length; ri++) { // Start from row 2 (index 1)
            if (colAValues[ri][0] === '' || colAValues[ri][0] === null) break;
            lastContiguousRow = ri + 1; // Convert 0-indexed to row number
          }
          endRow = lastContiguousRow > startRow ? lastContiguousRow : startRow + 11;
          Logger.log('[TaskChain] 📐 Inferred endRow from column A contiguous data: ' + endRow + ' (lastRow=' + sheet.getLastRow() + ')');
        } catch (e) {
          endRow = startRow + 11;
        }
      }
      
      var successCount = 0;
      var formulaErrors = [];
      
      // STANDARD: Natural Google Sheets formula — set on first row, copy down
      Logger.log('[TaskChain] Using standard formula mode (copy down)');
      try {
        var firstCell = sheet.getRange(step.outputColumn + startRow);
        firstCell.setFormula(formulaSource);
        successCount = 1;
        
        if (endRow > startRow) {
          var destRange = sheet.getRange(step.outputColumn + (startRow + 1) + ':' + step.outputColumn + endRow);
          firstCell.copyTo(destRange);
          successCount = endRow - startRow + 1;
        }
        Logger.log('[TaskChain] ✅ Formula set on ' + step.outputColumn + startRow + ' and copied to row ' + endRow);
      } catch (formulaError) {
        formulaErrors.push(formulaError.message);
        Logger.log('[TaskChain] ❌ Formula application error: ' + formulaError.message);
      }
      
      // If no formulas were successfully applied, mark as error
      if (successCount === 0) {
        Logger.log('[TaskChain] ❌ Formula step FAILED - 0 formulas set. Errors: ' + formulaErrors.join('; '));
        Logger.log('[TaskChain] ❌ Failed formula was: ' + formulaSource);
        chainState.steps[nextStepIndex].status = 'error';
        chainState.steps[nextStepIndex].error = 'Formula failed in col ' + (step.outputColumn || '?') + ': ' + (formulaErrors[0] || 'unknown error') + ' (formula: ' + formulaSource.substring(0, 60) + ')';
        chainState.steps[nextStepIndex].completedAt = new Date().toISOString();
        saveChainState(chainState);
        executeNextStep(chainState.chainId, chainState);
        return;
      }
      
      // POST-VERIFY: Sample first/middle/last cells for errors (not just the first).
      // If any cell errors, ask the AI model to self-correct (up to 2 retries).
      SpreadsheetApp.flush();
      var verifyResult = _verifyFormulaRange(sheet, step.outputColumn, startRow, endRow);
      if (!verifyResult.ok) {
        var formulaFailureHint = _buildFormulaFailureHint(sheet, formulaSource, startRow, verifyResult.error);
        Logger.log('[TaskChain] ⚠️ Formula produces ' + verifyResult.error + ' in col ' + step.outputColumn + ' | formula: ' + formulaSource +
                   (formulaFailureHint ? ' | hint: ' + formulaFailureHint : ''));

        var maxFixRetries = 2;
        var fixAttempt = 0;
        var currentFormula = formulaSource;

        while (!verifyResult.ok && fixAttempt < maxFixRetries) {
          fixAttempt++;
          Logger.log('[TaskChain] 🔄 Formula retry #' + fixAttempt + '/' + maxFixRetries + ' for col ' + step.outputColumn);

          try {
            var fixedFormula = _requestFormulaFix(currentFormula, verifyResult.error + (formulaFailureHint ? ' — Hint: ' + formulaFailureHint : ''), step.outputColumn, step.description || step.action || '', sheet, startRow, endRow, chainState, fixAttempt);

            if (fixedFormula && fixedFormula !== currentFormula) {
              Logger.log('[TaskChain] 🔧 AI suggested fix: ' + fixedFormula.substring(0, 80));

              var fixedSource = fixedFormula.startsWith('=') ? fixedFormula : '=' + fixedFormula;
              var firstCell = sheet.getRange(step.outputColumn + startRow);
              firstCell.setFormula(fixedSource);
              if (endRow > startRow) {
                var destRange = sheet.getRange(step.outputColumn + (startRow + 1) + ':' + step.outputColumn + endRow);
                firstCell.copyTo(destRange);
              }
              SpreadsheetApp.flush();

              verifyResult = _verifyFormulaRange(sheet, step.outputColumn, startRow, endRow);
              currentFormula = fixedSource;

              if (verifyResult.ok) {
                Logger.log('[TaskChain] ✅ Formula self-corrected on retry #' + fixAttempt + ': ' + fixedSource.substring(0, 80));
                formulaSource = fixedSource;
              } else {
                Logger.log('[TaskChain] ⚠️ Retry #' + fixAttempt + ' still errors: ' + verifyResult.error);
              }
            } else {
              Logger.log('[TaskChain] ⚠️ AI returned same formula or null — skipping further retries');
              break;
            }
          } catch (fixError) {
            Logger.log('[TaskChain] ⚠️ Formula fix API call failed: ' + fixError.message);
            break;
          }
        }

        if (!verifyResult.ok) {
          Logger.log('[TaskChain] ❌ Formula still errors after ' + fixAttempt + ' retries in col ' + step.outputColumn);
        }
      }
      
      // Write header using universal cell protection
      // skipHeader: backend signals that writeData already provided headers
      // (e.g., sequential formulas where startRow > data start — writing header
      // at startRow-1 would overwrite the seed value in the data row)
      if (chainState.addHeaders && step.outputColumn && !step.skipHeader) {
        var headerRow = startRow - 1;
        if (headerRow >= 1) {
          var headerText = step.description || step.action || 'Result';
          _safeWriteHeader(sheet, step.outputColumn, headerRow, headerText, true);
        }
      }
      
      Logger.log('[TaskChain] ✅ Formula applied to ' + successCount + ' rows' + (formulaErrors.length > 0 ? ' (' + formulaErrors.length + ' errors)' : ''));
      
      chainState.steps[nextStepIndex].status = verifyResult.ok ? 'completed' : 'error';
      chainState.steps[nextStepIndex].completedAt = new Date().toISOString();
      chainState.steps[nextStepIndex].outputRange = step.outputColumn + startRow + ':' + step.outputColumn + endRow;
      var finalFailureHint = (!verifyResult.ok) ? _buildFormulaFailureHint(sheet, formulaSource, startRow) : null;
      chainState.steps[nextStepIndex].error = verifyResult.ok
        ? null
        : ('Formula verification failed: ' + verifyResult.error + ' [' + formulaSource.substring(0, 80) + ']' +
           (finalFailureHint ? ' — Hint: ' + finalFailureHint : ''));
      chainState.steps[nextStepIndex].writeResult = { 
        successCount: successCount, 
        errorCount: formulaErrors.length,
        isFormula: true,
        formulaHealth: verifyResult.ok
          ? 'ok'
          : (verifyResult.error + (finalFailureHint ? ' — Hint: ' + finalFailureHint : '')),
        formulaText: formulaSource.substring(0, 100)
      };
      saveChainState(chainState);
      executeNextStep(chainState.chainId, chainState);
      return;
    }
    
    // === CHECK IF THIS IS A CHAT/ANALYZE STEP (NO CELL WRITING) ===
    if (step.outputFormat === 'chat' || step.action === 'analyze') {
      Logger.log('[TaskChain] 💬 Chat/Analyze step detected - will NOT write to cells');
      
      // For chat output, we need to get AI insights but not write to cells
      // The insights will be displayed in the sidebar chat
      try {
        var chatResult = _executeAnalyzeStep(step, plan, chainState);
        
        chainState.steps[nextStepIndex].status = 'completed';
        chainState.steps[nextStepIndex].completedAt = new Date().toISOString();
        chainState.steps[nextStepIndex].chatResponse = chatResult.response || 'Analysis complete';
        // NOTE: Don't duplicate response in writeResult to save PropertiesService space (9KB limit)
        chainState.steps[nextStepIndex].writeResult = { 
          successCount: 0, 
          errorCount: 0,
          isChat: true
        };
        
        Logger.log('[TaskChain] Chat response length: ' + (chatResult.response || '').length + ' chars');
        saveChainState(chainState);
        
        Logger.log('[TaskChain] ✅ Chat/Analyze step completed (no cells written)');
        
        // Execute next step immediately
        executeNextStep(chainState.chainId, chainState);
        return;
      } catch (chatError) {
        Logger.log('[TaskChain] ❌ Chat/Analyze step failed: ' + chatError.message);
        chainState.steps[nextStepIndex].status = 'completed'; // Still mark as completed
        chainState.steps[nextStepIndex].chatResponse = 'Analysis could not be completed: ' + chatError.message;
        chainState.steps[nextStepIndex].writeResult = { 
          successCount: 0, 
          errorCount: 0,
          isChat: true,
          error: chatError.message
        };
        saveChainState(chainState);
        executeNextStep(chainState.chainId, chainState);
        return;
      }
    }
    
    // === EXECUTE USING THE SAME executeAgentPlan FUNCTION ===
    Logger.log('[TaskChain] Calling executeAgentPlan with full plan...');
    Logger.log('[TaskChain] Full plan JSON: ' + JSON.stringify(plan).substring(0, 500));
    var result;
    try {
      result = executeAgentPlan(plan);
      Logger.log('[TaskChain] executeAgentPlan returned: ' + JSON.stringify({
        success: result && result.success,
        jobCount: result && result.jobs && result.jobs.length,
        firstJobId: result && result.jobs && result.jobs[0] && result.jobs[0].jobId,
        firstJobStatus: result && result.jobs && result.jobs[0] && result.jobs[0].status
      }));
    } catch (planError) {
      Logger.log('[TaskChain] ❌ executeAgentPlan threw error: ' + planError.message);
      throw planError;
    }
    
    if (!result || !result.jobs || result.jobs.length === 0) {
      Logger.log('[TaskChain] ❌ No jobs in result!');
      throw new Error('No jobs created for step');
    }
    
    // Store job IDs in chain state
    // Note: executeAgentPlan returns jobs with 'jobId' property (not 'id')
    var jobId = result.jobs[0].jobId;
    if (!jobId) {
      Logger.log('[TaskChain] ❌ Job object missing jobId! Full job: ' + JSON.stringify(result.jobs[0]));
      throw new Error('Job created but missing jobId property');
    }
    Logger.log('[TaskChain] 📝 Storing jobId: ' + jobId);
    chainState.steps[nextStepIndex].jobId = jobId;
    chainState.steps[nextStepIndex].allJobIds = result.jobs.map(function(j) { return j.jobId; }).filter(Boolean);
    
    // CRITICAL: Store multi-aspect metadata for result splitting
    chainState.steps[nextStepIndex].outputColumns = plan.outputColumns;
    chainState.steps[nextStepIndex].outputFormat = step.outputFormat;
    var isMultiAspect = plan.outputColumns.length > 1 && step.outputFormat && step.outputFormat.indexOf('|') !== -1;
    if (isMultiAspect) {
      Logger.log('[TaskChain] 📝 Storing multi-aspect metadata: ' + plan.outputColumns.length + ' columns, format: ' + step.outputFormat);
    }
    
    // Calculate output range
    // For single column: G8:G15
    // For multi-column (aspect analysis): G8:J15 (e.g., 4 aspects)
    var rowNums = plan.inputRange.match(/\d+/g);
    var startRow = rowNums ? rowNums[0] : '1';
    var endRow = rowNums && rowNums.length > 1 ? rowNums[rowNums.length - 1] : startRow;
    var firstCol = plan.outputColumns[0];
    var lastCol = plan.outputColumns[plan.outputColumns.length - 1];
    chainState.steps[nextStepIndex].outputRange = firstCol + startRow + ':' + lastCol + endRow;
    
    Logger.log('[TaskChain] Output range for step: ' + chainState.steps[nextStepIndex].outputRange);
    saveChainState(chainState);
    
    Logger.log('[TaskChain] ✅ Step ' + (nextStepIndex + 1) + ' started with job: ' + jobId);
    
  } catch (e) {
    Logger.log('[TaskChain] ❌ Step execution failed: ' + e.message);
    Logger.log('[TaskChain] Failed step index: ' + nextStepIndex);
    Logger.log('[TaskChain] Failed step description: ' + step.description);
    Logger.log('[TaskChain] Failed step inputColumns: ' + JSON.stringify(step.inputColumns));
    Logger.log('[TaskChain] Stack: ' + (e.stack || 'N/A'));
    chainState.steps[nextStepIndex].status = 'failed';
    chainState.steps[nextStepIndex].error = e.message;
    // DON'T set chainState.status = 'failed' — let remaining steps execute
    saveChainState(chainState);
    
    // Continue to next step despite this failure
    Logger.log('[TaskChain] ⏩ Continuing chain after step failure...');
    executeNextStep(chainState.chainId, chainState);
  }
}

/**
 * Handle step completion - called when a job finishes
 * 
 * @param {string} chainId - Chain ID
 * @param {string} jobId - Completed job ID
 * @param {Array} results - Job results
 */
function onStepComplete(chainId, jobId, results) {
  var chainState = getChainState(chainId);
  if (!chainState) return;
  
  // Find the step with this job
  var stepIndex = chainState.steps.findIndex(function(s) {
    return s.jobId === jobId;
  });
  
  if (stepIndex === -1) return;
  
  Logger.log('[TaskChain] Step ' + (stepIndex + 1) + ' completed');
  
  // Update step status
  chainState.steps[stepIndex].status = 'completed';
  chainState.steps[stepIndex].result = results;
  saveChainState(chainState);
  
  // Execute next step
  executeNextStep(chainId, {});
}

// ============================================
// MULTI-SHEET SUPPORT
// ============================================

/**
 * Switch to a target sheet by name. Creates the sheet if it doesn't exist.
 * Returns the previous active sheet so callers can restore if needed.
 * 
 * @param {string} targetSheetName - Name of the sheet to switch to
 * @return {Sheet|null} The target sheet, or null if no switch was needed
 */
function _switchToTargetSheet(targetSheetName) {
  if (!targetSheetName) return null;
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var targetSheet = spreadsheet.getSheetByName(targetSheetName);
  if (!targetSheet) {
    targetSheet = spreadsheet.insertSheet(targetSheetName);
    Logger.log('[MultiSheet] Created new sheet: ' + targetSheetName);
  }
  spreadsheet.setActiveSheet(targetSheet);
  Logger.log('[MultiSheet] Switched to sheet: ' + targetSheetName);
  return targetSheet;
}

// ============================================
// UNIVERSAL CELL PROTECTION UTILITIES
// ============================================
// These functions enforce the golden rule: NEVER overwrite existing data with less useful data.
// They work regardless of model quality — strong models produce clean output that passes through,
// weak models get their mistakes caught and corrected.

/**
 * Safely write a header label to a cell, ONLY if the cell is empty.
 * This is the universal protection against overwriting seed values, writeData content,
 * or any other data that was placed by a previous step.
 * 
 * @param {Sheet} sheet - The active sheet
 * @param {string} column - Column letter (e.g., 'B')
 * @param {number} row - Row number for the header
 * @param {string} headerText - The header text to write
 * @param {boolean} copyFormatFromA - Whether to copy formatting from column A
 * @return {boolean} True if header was written, false if skipped
 */
function _safeWriteHeader(sheet, column, row, headerText, copyFormatFromA) {
  if (!column || row < 1 || !headerText) return false;
  
  var colNumber = column.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  var cell = sheet.getRange(row, colNumber);
  var existingValue = cell.getValue();
  
  // GOLDEN RULE: Never overwrite non-empty cells
  if (existingValue !== '' && existingValue !== null && existingValue !== undefined) {
    Logger.log('[CellProtection] ⏭️ Header skipped for ' + column + row + ': cell already has "' + String(existingValue).substring(0, 30) + '"');
    return false;
  }
  
  // Copy formatting from column A header for consistency
  if (copyFormatFromA) {
    try {
      var sourceCell = sheet.getRange(row, 1);
      sourceCell.copyFormatToRange(sheet, colNumber, colNumber, row, row);
    } catch (e) {
      // Non-fatal — formatting is nice-to-have
    }
  }
  
  cell.setValue(headerText);
  Logger.log('[CellProtection] 📝 Header written to ' + column + row + ': "' + headerText + '"');
  return true;
}

/**
 * Clean text values from a target column range BEFORE applying formulas.
 * When writeData runs first, weak AI models sometimes put text descriptions 
 * (e.g., "Monthly Revenue") into cells that should contain formulas.
 * If the formula step then fails, this text persists and causes #VALUE! cascades.
 * 
 * Only clears non-numeric strings — preserves numbers (seed values) and empty cells.
 * 
 * @param {Sheet} sheet - The active sheet
 * @param {string} column - Column letter
 * @param {number} startRow - First row
 * @param {number} endRow - Last row
 * @return {number} Count of cells cleaned
 */
function _cleanTextFromFormulaRange(sheet, column, startRow, endRow) {
  try {
    var range = sheet.getRange(column + startRow + ':' + column + endRow);
    var values = range.getValues();
    var formulas = range.getFormulas();
    var cleaned = 0;
    
    for (var i = 0; i < values.length; i++) {
      var val = values[i][0];
      var formula = formulas[i][0];
      if (formula && formula.length > 0) continue;
      // Only clear text strings — preserve numbers (seed values), dates, and empty cells.
      // Numbers in formula columns are typically seed values from writeData that other
      // formulas may reference; clearing them causes cascading $0.
      if (typeof val === 'string' && val !== '') {
        sheet.getRange(column + (startRow + i)).clearContent();
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      SpreadsheetApp.flush();
      Logger.log('[CellProtection] 🧹 Cleaned ' + cleaned + ' cells in ' + column + startRow + ':' + column + endRow);
    }
    return cleaned;
  } catch (e) {
    Logger.log('[CellProtection] ⚠️ Clean warning: ' + e.message);
    return 0;
  }
}

/**
 * Verify a formula was successfully applied and is computing.
 * Catches silent failures where setFormula() succeeds but the result is an error.
 * 
 * @param {Sheet} sheet - The active sheet
 * @param {string} cellRef - Cell reference like "B2"
 * @return {Object} { ok: boolean, formula: string, value: any, error: string|null }
 */
function _verifyFormula(sheet, cellRef) {
  try {
    var cell = sheet.getRange(cellRef);
    var formula = cell.getFormula();
    var value = cell.getValue();
    
    // No formula was set
    if (!formula || formula.length === 0) {
      return { ok: false, formula: '', value: value, error: 'No formula found in cell' };
    }
    
    // Check for common error values
    var strValue = String(value);
    if (strValue === '#VALUE!' || strValue === '#REF!' || strValue === '#DIV/0!' || 
        strValue === '#NAME?' || strValue === '#NULL!' || strValue === '#N/A' || strValue === '#ERROR!') {
      return { ok: false, formula: formula, value: value, error: 'Formula produces ' + strValue };
    }
    
    return { ok: true, formula: formula, value: value, error: null };
  } catch (e) {
    return { ok: false, formula: '', value: null, error: e.message };
  }
}

/**
 * Verify a formula range by sampling first, middle, and last cells.
 * Returns the first failing result so the fix loop can act on it.
 *
 * @param {Sheet} sheet
 * @param {string} column - Column letter, e.g. "B"
 * @param {number} startRow
 * @param {number} endRow
 * @return {Object} Same shape as _verifyFormula: { ok, formula, value, error }
 */
function _verifyFormulaRange(sheet, column, startRow, endRow) {
  var rows = [startRow];
  if (endRow > startRow + 1) {
    rows.push(Math.floor((startRow + endRow) / 2));
  }
  if (endRow > startRow) {
    rows.push(endRow);
  }

  for (var i = 0; i < rows.length; i++) {
    var result = _verifyFormula(sheet, column + rows[i]);
    if (!result.ok) {
      result.error = (result.error || 'Unknown error') + ' (row ' + rows[i] + ')';
      return result;
    }
  }
  return { ok: true, formula: '', value: null, error: null };
}

/**
 * Build deterministic, model-facing hints for common formula failures.
 * This does not mutate formulas; it only improves error feedback quality.
 */
function _buildFormulaFailureHint(sheet, formulaSource, startRow, errorMessage) {
  try {
    if (!formulaSource) return null;
    var formulaUpper = String(formulaSource).toUpperCase();
    var formulaBody = String(formulaSource).replace(/^=\s*/, '');
    
    // #NAME? with no cell references: model used a column header name as a formula.
    var hasAnyCellRef = /\$?[A-Z]+\$?\d+/i.test(formulaBody);
    if (!hasAnyCellRef && String(errorMessage || '').indexOf('#NAME?') >= 0) {
      return 'Formula "' + formulaBody + '" contains no cell references — this looks like a column name, not a valid formula. Use A1 notation to reference cells (e.g., =H2 for the value in column H row 2). Check the HEADERS row to find the correct column letter.';
    }
    
    // Cross-sheet reference using dot instead of "!" — e.g., Assumptions.$B$2 should be Assumptions!$B$2
    var dotSheetRef = formulaSource.match(/([A-Za-z_][\w\s]*)\.\$?[A-Z]+\$?\d+/);
    if (dotSheetRef && (String(errorMessage || '').indexOf('#ERROR!') >= 0 || String(errorMessage || '').indexOf('#REF!') >= 0 || String(errorMessage || '').indexOf('#NAME?') >= 0)) {
      var badSheet = dotSheetRef[1].trim();
      return 'Cross-sheet reference uses "." instead of "!" — "' + badSheet + '.$B$2" should be "' + badSheet + '!$B$2". Google Sheets requires "!" to separate sheet name from cell reference.';
    }

    // "$" prefix on sheet name — e.g., $Assumptions!$B$2 should be Assumptions!$B$2
    var dollarSheetRef = formulaSource.match(/\$([A-Za-z_][\w\s]*)!\$?[A-Z]+\$?\d+/);
    if (dollarSheetRef && (String(errorMessage || '').indexOf('#REF!') >= 0 || String(errorMessage || '').indexOf('#ERROR!') >= 0 || String(errorMessage || '').indexOf('#NAME?') >= 0)) {
      var badSheetName = dollarSheetRef[1].trim();
      return '"$" before sheet name is invalid — "$' + badSheetName + '!$B$2" should be "' + badSheetName + '!$B$2". The "$" sign only makes column/row references absolute (e.g., $B$2), not sheet names.';
    }
    
    // Date formulas (EDATE/EOMONTH/DATEVALUE) need a date-typed seed cell.
    if (formulaUpper.indexOf('EDATE(') >= 0 ||
        formulaUpper.indexOf('EOMONTH(') >= 0 ||
        formulaUpper.indexOf('DATEVALUE(') >= 0) {
      var firstArgMatch = formulaUpper.match(/(?:EDATE|EOMONTH|DATEVALUE)\(\s*([^,\)]+)\s*(?:,|\))/);
      if (firstArgMatch && firstArgMatch[1]) {
        var refToken = firstArgMatch[1].trim();
        var refCell = _extractA1Ref(refToken, startRow);
        if (refCell) {
          var refValue = sheet.getRange(refCell).getValue();
          var refDisplay = sheet.getRange(refCell).getDisplayValue();
          var isDateLike = Object.prototype.toString.call(refValue) === '[object Date]' && !isNaN(refValue.getTime());
          if (!isDateLike) {
            return 'Date formula anchor ' + refCell + ' is not a date (value="' + refDisplay + '"). Seed a real date first (e.g., 2026-01-01) or avoid EDATE.';
          }
        }
      }
    }
    
    // MATCH(TRUE, range>0, 0) requires ARRAYFORMULA in Google Sheets.
    // Produces #VALUE! or #N/A depending on context.
    var errStr = String(errorMessage || '');
    if (formulaUpper.indexOf('MATCH(TRUE') >= 0 && (errStr.indexOf('#N/A') >= 0 || errStr.indexOf('#VALUE!') >= 0)) {
      return 'MATCH(TRUE, range>0, 0) does not work in Google Sheets without array mode. Use MATCH(1, ARRAYFORMULA(range>0), 0) or an alternative like XMATCH.';
    }
    
    // Aggregate functions with range arithmetic produce #VALUE! without ARRAYFORMULA.
    var hasRangeArith = /[A-Z]+\d+:[A-Z]+\d+\s*[\+\-\*\/]\s*[A-Z]+\d+/i.test(formulaSource) ||
                        /[A-Z]+\d+\s*[\+\-\*\/]\s*[A-Z]+\d+:[A-Z]+\d+/i.test(formulaSource);
    if (hasRangeArith && errStr.indexOf('#VALUE!') >= 0) {
      return 'Formula uses range arithmetic (e.g., B3:B13-B2:B12) which requires ARRAYFORMULA() wrapper in Google Sheets.';
    }

    // Cell reference inspection: check if formula references header row or non-numeric cells.
    // Run this BEFORE the generic "math + text" check because it gives more actionable feedback.
    var refPattern = /\$?([A-Z]+)\$?(\d+)/gi;
    var checked = 0;
    var headerRefHit = null;
    var nonNumericRefHit = null;
    var match;
    while ((match = refPattern.exec(formulaSource)) !== null && checked < 6) {
      checked++;
      var refCol = match[1].toUpperCase();
      var refRow = parseInt(match[2], 10);
      // Skip cross-sheet prefixes that look like cell refs (e.g., "Projection" in Projection!K2)
      var beforeMatch = formulaSource.substring(0, match.index);
      if (beforeMatch.length > 0 && beforeMatch[beforeMatch.length - 1] === '!') continue;
      var refCellA1 = refCol + refRow;
      try {
        var refValue2 = sheet.getRange(refCellA1).getValue();
        var refDisplay2 = sheet.getRange(refCellA1).getDisplayValue();
        
        if (refRow === 1) {
          headerRefHit = refCellA1 + '="' + refDisplay2 + '"';
        }
        if (refDisplay2 !== '' && refDisplay2 !== null && refDisplay2 !== undefined) {
          var numericCandidate = String(refDisplay2).replace(/[$,%\s,]/g, '');
          var isNumericLike = numericCandidate !== '' && !isNaN(parseFloat(numericCandidate));
          if (!isNumericLike) {
            nonNumericRefHit = refCellA1 + '="' + refDisplay2 + '"';
          }
        }
      } catch (refErr) { /* cell out of range — skip */ }
    }
    
    if (headerRefHit) {
      return 'Formula references header row value (' + headerRefHit + '). For running totals / cumulative sums, the first data row should reference only the current row. Use a seed value via writeData and set formula startRow to one row after the seed.';
    }
    if (nonNumericRefHit) {
      return 'Formula references non-numeric cell ' + nonNumericRefHit + '. Ensure arithmetic operands point to numeric seed/data cells.';
    }

    // Generic: math formulas with text literals — last resort hint.
    if ((formulaUpper.indexOf('*') >= 0 || formulaUpper.indexOf('/') >= 0 || formulaUpper.indexOf('+') >= 0 || formulaUpper.indexOf('-') >= 0) &&
        formulaUpper.indexOf('"') >= 0) {
      return 'Arithmetic formula appears to mix text literals and numeric math; ensure referenced cells are numeric.';
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

function _extractA1Ref(token, rowFallback) {
  if (!token) return null;
  var normalized = String(token).replace(/\$/g, '').trim();
  if (normalized === 'ROW()') return 'A' + (rowFallback || 2);
  var direct = normalized.match(/^([A-Z]+)(\d+)$/i);
  if (direct) return direct[1].toUpperCase() + direct[2];
  return null;
}

/**
 * Request a formula fix from the AI model via the fix-formula backend endpoint.
 * Gathers sheet context (headers + sample data) and sends it with the failed formula.
 *
 * @param {string} formula - The formula that failed
 * @param {string} error - The error message (e.g., "Formula produces #VALUE!")
 * @param {string} column - Output column letter (e.g., "B")
 * @param {string} description - What the formula should do
 * @param {Sheet} sheet - The active sheet
 * @param {number} startRow - First data row
 * @param {number} endRow - Last data row
 * @param {Object} chainState - Chain state (for model/auth info)
 * @param {number} [retryNumber] - Which retry attempt this is (1-based)
 * @return {string|null} Corrected formula or null on failure
 */
function _requestFormulaFix(formula, error, column, description, sheet, startRow, endRow, chainState, retryNumber) {
  var headers = [];
  var sampleData = [];
  var crossSheetData = [];

  try {
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var headerRange = sheet.getRange(1, 1, 1, Math.min(lastCol, 30));
      var headerValues = headerRange.getValues()[0];
      headers = headerValues.map(function(h) { return String(h); }).filter(function(h) { return h !== ''; });
    }

    var sampleRows = Math.min(3, endRow - startRow + 1);
    if (sampleRows > 0 && lastCol > 0) {
      var dataRange = sheet.getRange(startRow, 1, sampleRows, Math.min(lastCol, 30));
      var dataValues = dataRange.getValues();
      for (var r = 0; r < dataValues.length; r++) {
        sampleData.push(dataValues[r].map(function(v) { return String(v); }));
      }
    }

    // Detect cross-sheet references and include context from those sheets
    var crossSheetRefs = formula.match(/([A-Za-z_][\w\s]*)!\$?[A-Z]+\$?\d+/g) || [];
    var seenCrossSheets = {};
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    for (var csi = 0; csi < crossSheetRefs.length; csi++) {
      var refSheetName = crossSheetRefs[csi].split('!')[0].replace(/'/g, '').trim();
      if (seenCrossSheets[refSheetName]) continue;
      seenCrossSheets[refSheetName] = true;
      var refSheet = spreadsheet.getSheetByName(refSheetName);
      if (!refSheet) continue;
      var refLastRow = Math.min(refSheet.getLastRow(), 20);
      var refLastCol = Math.min(refSheet.getLastColumn(), 10);
      if (refLastRow === 0 || refLastCol === 0) continue;
      var refHeaders = refSheet.getRange(1, 1, 1, refLastCol).getDisplayValues()[0];
      var refRows = [];
      if (refLastRow > 1) {
        var refData = refSheet.getRange(2, 1, Math.min(refLastRow - 1, 10), refLastCol).getDisplayValues();
        for (var rr = 0; rr < refData.length; rr++) {
          refRows.push(refData[rr].map(function(v) { return String(v); }));
        }
      }
      crossSheetData.push({
        sheetName: refSheetName,
        headers: refHeaders.map(function(h) { return String(h); }),
        rows: refRows
      });
      Logger.log('[TaskChain] Cross-sheet context added for: ' + refSheetName + ' (' + refRows.length + ' rows)');
    }
  } catch (ctxErr) {
    Logger.log('[TaskChain] ⚠️ Could not gather sheet context for fix: ' + ctxErr.message);
  }

  var modelSelection = chainState.model || getAgentModel();
  var parsedModel = parseModelSelection(modelSelection);
  var isManagedMode = parsedModel.provider === 'MANAGED';
  var provider = isManagedMode ? 'GEMINI' : parsedModel.provider;
  var specificModel = chainState.specificModel || parsedModel.specificModel;

  var fixData = {
    formula: formula,
    error: error,
    column: column,
    description: description,
    retryNumber: retryNumber || 1,
    sheetContext: {
      headers: headers,
      sampleData: sampleData,
      crossSheetData: crossSheetData.length > 0 ? crossSheetData : undefined
    }
  };

  var payload;
  if (isManagedMode) {
    payload = SecureRequest.buildManagedPayload(fixData, specificModel);
  } else {
    payload = SecureRequest.buildPayloadWithModel(provider, fixData, specificModel);
  }

  var result = ApiClient.post('AGENT_FIX_FORMULA', payload);

  if (result && result.formula) {
    return result.formula;
  }

  Logger.log('[TaskChain] ⚠️ Fix-formula endpoint returned no formula: ' + JSON.stringify(result));
  return null;
}

/**
 * Return true if formula text references a given column in common forms:
 * - A1-style cells: C2, $C$2
 * - Whole-column/range refs: C:C, C2:C, C:C20, C2:C20
 */
function _formulaReferencesColumn(formulaSource, columnLetter) {
  if (!formulaSource || !columnLetter) return false;
  var col = String(columnLetter).toUpperCase().replace(/[^A-Z]/g, '');
  if (!col) return false;
  var escaped = col.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
  var patterns = [
    new RegExp('\\$?' + escaped + '\\$?\\d+', 'i'),
    new RegExp('\\$?' + escaped + '\\s*:\\s*\\$?' + escaped + '(?:\\$?\\d+)?', 'i'),
    new RegExp('\\$?' + escaped + '\\$?\\d+\\s*:\\s*\\$?' + escaped + '\\$?\\d+', 'i')
  ];
  for (var i = 0; i < patterns.length; i++) {
    if (patterns[i].test(formulaSource)) return true;
  }
  return false;
}

/**
 * Collect degraded formula outcomes from already-finished steps.
 */
function _collectFormulaHealthIssues(chainState) {
  var issues = [];
  var steps = (chainState && chainState.steps) || [];
  for (var i = 0; i < steps.length; i++) {
    var step = steps[i];
    if (!step) continue;
    var isFormulaStep = step.action === 'formula' || step.outputFormat === 'formula';
    if (!isFormulaStep) continue;
    if (step.status === 'error' || step.status === 'failed') {
      var errMsg = step.error || (step.writeResult && step.writeResult.formulaHealth) || 'Formula failed';
      issues.push('Step ' + (i + 1) + ': ' + errMsg);
    } else if (step.writeResult && step.writeResult.formulaHealth && step.writeResult.formulaHealth !== 'ok') {
      issues.push('Step ' + (i + 1) + ': ' + step.writeResult.formulaHealth);
    }
  }
  return issues;
}

/**
 * Summarize step results for chain completion status.
 * Used to determine if chain is 'completed', 'completed_with_errors', or 'failed'.
 * 
 * @param {Object} chainState - Chain state
 * @return {Object} { completedCount, failedCount, skippedCount, total, errors[] }
 */
function _summarizeStepResults(chainState) {
  var steps = chainState.steps || [];
  var completedCount = 0;
  var failedCount = 0;
  var skippedCount = 0;
  var errors = [];
  
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    if (s.status === 'completed' || s.status === 'skipped') {
      completedCount++;
      if (s.status === 'skipped') skippedCount++;
    } else if (s.status === 'error' || s.status === 'failed') {
      failedCount++;
      errors.push({
        step: i + 1,
        action: s.action,
        description: s.description,
        error: s.error || 'Unknown error'
      });
    }
  }
  
  return {
    completedCount: completedCount,
    failedCount: failedCount,
    skippedCount: skippedCount,
    total: steps.length,
    errors: errors
  };
}

/**
 * Report execution outcome to backend for self-learning.
 * Records whether each step succeeded, failed, or had errors.
 */
function _reportExecutionOutcome(chainState) {
  try {
    var steps = chainState.steps || [];
    var successCount = steps.filter(function(s) { return s.status === 'completed' || s.status === 'skipped'; }).length;
    var failCount = steps.filter(function(s) { return s.status === 'error' || s.status === 'failed'; }).length;
    
    var executionStatus = failCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed');
    var errors = steps.filter(function(s) { return s.error; }).map(function(s) {
      return s.action + ': ' + s.error;
    });
    
    var payload = {
      command: chainState.originalCommand || chainState.steps[0].description || '',
      workflow: { steps: steps.map(function(s) { return { action: s.action, description: s.description || '' }; }) },
      wasAccepted: executionStatus !== 'failed',
      wasModified: false,
      executionSuccess: executionStatus === 'success',
      executionStatus: executionStatus,
      errorDetails: errors.length > 0 ? errors.join('; ') : null
    };
    
    callApi(CONFIG.ENDPOINTS.AGENT_WORKFLOW_FEEDBACK, payload);
    Logger.log('[TaskChain] Reported execution outcome: ' + executionStatus + ' (' + successCount + '/' + steps.length + ' steps)');
  } catch (e) {
    Logger.log('[TaskChain] Outcome reporting error (non-fatal): ' + e.message);
  }
}

/**
 * Record implicit positive feedback for completed analysis steps.
 * A completed chain = user accepted the analysis without re-running.
 * This data feeds into user_analysis_preferences over time.
 */
function _recordImplicitFeedback(chainState) {
  try {
    var analyzeSteps = (chainState.steps || []).filter(function(s) {
      return s.status === 'completed' && 
             (s.action === 'analyze' || s.action === 'chat');
    });
    
    if (analyzeSteps.length === 0) return;
    
    for (var i = 0; i < analyzeSteps.length; i++) {
      var step = analyzeSteps[i];
      var queryText = step.question || step.prompt || step.description || '';
      if (!queryText) continue;
      
      submitAnalysisFeedback(queryText, 'up', null, null);
    }
    
    Logger.log('[TaskChain] Recorded implicit positive feedback for ' + analyzeSteps.length + ' analysis step(s)');
  } catch (e) {
    Logger.log('[TaskChain] Implicit feedback error (non-fatal): ' + e.message);
  }
}

// ============================================
// RETRY FAILED STEPS
// ============================================

/**
 * Retry all failed/error steps in a completed_with_errors chain.
 * Resets failed steps to 'pending' and restarts execution.
 * 
 * @param {string} chainId - Chain ID to retry
 * @return {Object} { success, chainId, error }
 */
function retryFailedChainSteps(chainId) {
  try {
    var chainState = getChainState(chainId);
    if (!chainState) {
      return { success: false, error: 'Chain not found' };
    }
    
    // Only allow retry on completed_with_errors or failed chains
    if (chainState.status !== 'completed_with_errors' && chainState.status !== 'failed') {
      return { success: false, error: 'Chain is not in a retryable state (status: ' + chainState.status + ')' };
    }
    
    // Reset failed/error steps to pending
    var resetCount = 0;
    for (var i = 0; i < chainState.steps.length; i++) {
      var step = chainState.steps[i];
      if (step.status === 'error' || step.status === 'failed') {
        step.status = 'pending';
        step.error = null;
        step.jobId = null;
        step._retryAttempt = (step._retryAttempt || 0) + 1;
        resetCount++;
        Logger.log('[TaskChain] 🔁 Reset step ' + (i + 1) + ' for retry (attempt ' + step._retryAttempt + ')');
      }
    }
    
    if (resetCount === 0) {
      return { success: false, error: 'No failed steps to retry' };
    }
    
    // Reset chain status to running
    chainState.status = 'running';
    chainState.completedAt = null;
    chainState._stepSummary = null;
    saveChainState(chainState);
    
    Logger.log('[TaskChain] 🔁 Retrying ' + resetCount + ' failed steps for chain ' + chainId);
    
    // Start execution from the first pending step
    executeNextStep(chainId, chainState);
    
    return { success: true, chainId: chainId };
  } catch (e) {
    Logger.log('[TaskChain] Retry error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ============================================
// LARGE DATASET BULK PROCESSING
// ============================================

/**
 * Execute a writeData step via chunked bulk jobs for large datasets.
 * Instead of one-shot AI generation (which degrades at >50 rows),
 * this creates multiple parallel bulk jobs that each process a chunk
 * of rows with full per-row AI attention.
 * 
 * The worker system processes PARALLEL_JOBS=5 concurrently, so splitting
 * 200 rows into 4 chunks of 50 means 4x faster than a single job.
 * 
 * @param {Object} step - The writeData step with bulkProcessing=true
 * @param {Object} chainState - Current chain state
 * @param {number} stepIndex - Index of this step in chain
 */
function _executeBulkWriteData(step, chainState, stepIndex) {
  var CHUNK_SIZE = step.bulkChunkSize || 50;
  
  // 1. Read ALL data from the sheet (we need every row for input context)
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(chainState.sheetName) ||
              SpreadsheetApp.getActiveSheet();
  var fullDataRange = sheet.getDataRange();
  var allData = fullDataRange.getValues();
  var headers = allData[0] || [];
  var dataRows = allData.slice(1);
  var rowCount = dataRows.length;
  
  Logger.log('[BulkWriteData] Sheet: ' + sheet.getName() + ', rows: ' + rowCount + ', headers: ' + headers.length);
  
  if (rowCount === 0) {
    throw new Error('No data rows found in sheet');
  }
  
  // Update chainState.rowCount with actual count from sheet (may be 0 or wrong from init)
  if (!chainState.rowCount || chainState.rowCount !== rowCount) {
    Logger.log('[BulkWriteData] Updating chainState.rowCount: ' + chainState.rowCount + ' → ' + rowCount);
    chainState.rowCount = rowCount;
  }
  
  // 2. Build per-row input data (concatenate all columns for context)
  var inputData = [];
  for (var r = 0; r < dataRows.length; r++) {
    var rowParts = [];
    for (var c = 0; c < headers.length; c++) {
      var cellValue = dataRows[r][c];
      if (cellValue !== '' && cellValue !== null && cellValue !== undefined) {
        var headerName = headers[c] || String.fromCharCode(65 + c);
        rowParts.push(headerName + ': ' + cellValue);
      }
    }
    inputData.push(rowParts.join('; '));
  }
  
  // 3. Determine output column placement
  var outputHeaders = step.bulkOutputHeaders || [];
  var startCell = step.startCell || '';
  var startMatch = startCell.match(/([A-Z]+)(\d+)/i);
  var startColLetter = startMatch ? startMatch[1].toUpperCase() : '';
  var headerRowNum = startMatch ? parseInt(startMatch[2]) : 1;
  
  // If no startCell from AI, find the first empty column
  if (!startColLetter) {
    var lastCol = sheet.getLastColumn();
    startColLetter = String.fromCharCode(65 + lastCol); // Next empty column
    headerRowNum = 1;
    Logger.log('[BulkWriteData] No startCell from AI, using first empty column: ' + startColLetter);
  }
  
  // Calculate output column letters
  var outputColumns = [];
  var startColIndex = startColLetter.charCodeAt(0) - 65;
  for (var h = 0; h < Math.max(outputHeaders.length, 1); h++) {
    outputColumns.push(String.fromCharCode(65 + startColIndex + h));
  }
  
  // 4. Write output column headers to the sheet
  for (var h = 0; h < outputHeaders.length; h++) {
    var colNum = startColIndex + h + 1;
    sheet.getRange(headerRowNum, colNum).setValue(outputHeaders[h]);
    
    // Copy formatting from existing header row for consistency
    if (headers.length > 0) {
      try {
        sheet.getRange(headerRowNum, 1).copyFormatToRange(sheet, colNum, colNum, headerRowNum, headerRowNum);
      } catch (fmtErr) {
        // Non-critical — formatting copy can fail if source has merged cells, etc.
      }
    }
  }
  Logger.log('[BulkWriteData] Wrote ' + outputHeaders.length + ' output headers at row ' + headerRowNum);
  
  // 5. Build the per-row prompt
  var bulkPrompt = step.bulkPrompt || step.prompt || step.description || '';
  if (outputHeaders.length > 1) {
    bulkPrompt += '\n\nReturn EXACTLY ' + outputHeaders.length + ' values separated by ||| (triple pipe):\n' +
                  outputHeaders.join(' ||| ');
  }
  
  // 6. Split input into chunks and create parallel jobs
  var chunks = [];
  for (var i = 0; i < inputData.length; i += CHUNK_SIZE) {
    chunks.push({
      startIdx: i,
      data: inputData.slice(i, Math.min(i + CHUNK_SIZE, inputData.length))
    });
  }
  
  Logger.log('[BulkWriteData] Creating ' + chunks.length + ' chunk jobs (' + CHUNK_SIZE + ' rows each) for ' + rowCount + ' total rows');
  
  var modelSelection = chainState.model || getAgentModel();
  var parsedModel = parseModelSelection(modelSelection);
  var model = parsedModel.provider;
  var specificModel = chainState.specificModel || parsedModel.specificModel;
  
  var allJobIds = [];
  var jobChunkMap = {}; // Maps jobId → { startIdx, rowCount }
  
  for (var c = 0; c < chunks.length; c++) {
    try {
      var job = createBulkJob(chunks[c].data, bulkPrompt, model, specificModel);
      allJobIds.push(job.id);
      jobChunkMap[job.id] = {
        startIdx: chunks[c].startIdx,
        rowCount: chunks[c].data.length,
        chunkIndex: c
      };
      Logger.log('[BulkWriteData] Chunk ' + (c + 1) + '/' + chunks.length + ': job ' + job.id + 
                 ' (' + chunks[c].data.length + ' rows, starting at index ' + chunks[c].startIdx + ')');
    } catch (jobError) {
      Logger.log('[BulkWriteData] ❌ Chunk ' + (c + 1) + ' job creation failed: ' + jobError.message);
    }
  }
  
  if (allJobIds.length === 0) {
    throw new Error('Failed to create any chunk jobs for bulk processing');
  }
  
  // 7. Store job tracking info in chain state
  var dataStartRow = headerRowNum + 1; // Data starts row below headers
  chainState.steps[stepIndex].jobId = allJobIds[0];
  chainState.steps[stepIndex].allJobIds = allJobIds;
  chainState.steps[stepIndex]._chunkedJob = true;
  chainState.steps[stepIndex]._totalChunks = chunks.length;
  chainState.steps[stepIndex]._completedChunkIds = [];
  chainState.steps[stepIndex]._jobChunkMap = jobChunkMap;
  chainState.steps[stepIndex].outputColumns = outputColumns;
  chainState.steps[stepIndex].outputFormat = outputHeaders.join('|');
  chainState.steps[stepIndex].outputRange = outputColumns[0] + dataStartRow + ':' + 
                                             outputColumns[outputColumns.length - 1] + (dataStartRow + rowCount - 1);
  chainState.steps[stepIndex]._bulkDataStartRow = dataStartRow;
  
  saveChainState(chainState);
  
  // 8. Trigger all workers (worker processes up to PARALLEL_JOBS=5 concurrently)
  triggerWorkerAsync(allJobIds);
  
  Logger.log('[BulkWriteData] ✅ ' + allJobIds.length + ' chunk jobs created and triggered. ' +
             'Output: ' + outputColumns.join(',') + ' starting at row ' + dataStartRow);
}

// ============================================
// POST-EXECUTION REPAIR PASS
// ============================================

/**
 * After all steps complete, if the holistic scan finds formula errors,
 * call the SAME agent (via AGENT_PARSE_CHAIN) with a repair prompt.
 * The agent sees the full system prompt, same tools, and CURRENT sheet state,
 * so it can reason about what went wrong with full context.
 *
 * @param {Object} chainState - Chain state with model/auth info
 * @param {Object} holisticScan - Result from _scanSheetForErrors
 * @return {Object|null} Updated scan result after repair, or null on failure
 */
function _requestChainRepair(chainState, holisticScan) {
  var errorCount = holisticScan.totalErrors || 0;
  var suspiciousCount = holisticScan.totalSuspicious || 0;
  Logger.log('[RepairPass] Starting repair pass for ' + errorCount + ' errors, ' + suspiciousCount + ' suspicious columns');

  var errorDetails = [];
  var errorTypes = Object.keys(holisticScan.errorSummary || {});
  for (var i = 0; i < errorTypes.length; i++) {
    var errType = errorTypes[i];
    var info = holisticScan.errorSummary[errType];
    for (var j = 0; j < info.locations.length; j++) {
      var loc = info.locations[j];
      errorDetails.push(loc.cell + ': ' + errType + ' (formula: ' + loc.formula + ')');
    }
  }

  var suspiciousDetails = [];
  var suspiciousZeros = holisticScan.suspiciousZeros || [];
  for (var sz = 0; sz < suspiciousZeros.length; sz++) {
    var szInfo = suspiciousZeros[sz];
    suspiciousDetails.push(szInfo.sheet + '!' + szInfo.column + ' ("' + szInfo.header + 
      '"): all ' + szInfo.formulaCount + ' formula rows produce $0 or blank. ' +
      'Sample formula: ' + szInfo.sampleFormula);
  }

  if (errorDetails.length === 0 && suspiciousDetails.length === 0) {
    Logger.log('[RepairPass] No issues to send — skipping');
    return null;
  }

  var sheetSnapshots = _buildSheetSnapshots(chainState);

  var originalCommand = chainState.steps[0].prompt || '';
  var problemLines = [];
  if (errorDetails.length > 0) {
    problemLines.push('These formulas produce errors:');
    problemLines.push(errorDetails.join('\n'));
  }
  if (suspiciousDetails.length > 0) {
    problemLines.push('These formula columns produce all-zero or blank values (likely wrong cell references):');
    problemLines.push(suspiciousDetails.join('\n'));
  }

  var repairCommand = 'REPAIR MODE — fix formula issues from my previous request.\n\n' +
    'Original request: ' + originalCommand + '\n\n' +
    problemLines.join('\n\n') + '\n\n' +
    'Current sheet state:\n' + sheetSnapshots + '\n\n' +
    'Use the formula tool to fix ONLY the broken formulas. ' +
    'Common cause: referencing a cell on the current sheet (e.g., =$B$2) when you meant another sheet (e.g., =Assumptions!$B$2). ' +
    'Cross-check every cell reference against the sheet snapshots above. ' +
    'Do not re-create data or restructure the sheet.';

  Logger.log('[RepairPass] Repair command length: ' + repairCommand.length);

  var modelSelection = chainState.model || getAgentModel();
  var parsedModel = parseModelSelection(modelSelection);
  var isManagedMode = parsedModel.provider === 'MANAGED';
  var provider = isManagedMode ? 'GEMINI' : parsedModel.provider;
  var specificModel = chainState.specificModel || parsedModel.specificModel;

  var context = getAgentContext();

  var payload;
  if (isManagedMode) {
    payload = SecureRequest.buildManagedPayload({
      command: repairCommand,
      context: context || {}
    }, specificModel);
  } else {
    payload = SecureRequest.buildPayloadWithModel(provider, {
      command: repairCommand,
      context: context || {}
    }, specificModel);
  }

  var response;
  try {
    response = ApiClient.post('AGENT_PARSE_CHAIN', payload);
  } catch (err) {
    Logger.log('[RepairPass] API call failed: ' + err.message);
    return null;
  }

  if (!response || !response.steps || response.steps.length === 0) {
    Logger.log('[RepairPass] No corrective steps returned');
    return null;
  }

  Logger.log('[RepairPass] Received ' + response.steps.length + ' corrective steps');

  // Apply only formula steps from the repair response
  var fixesApplied = 0;
  for (var si = 0; si < response.steps.length; si++) {
    var step = response.steps[si];
    var formulaSource = step.formula || null;
    if (!formulaSource) continue;

    if (!formulaSource.startsWith('=')) formulaSource = '=' + formulaSource;
    formulaSource = _normalizeFormulaSyntax(formulaSource);
    var targetSheetName = step.targetSheet || (step.config && step.config.targetSheet) || null;

    Logger.log('[RepairPass] Applying fix: ' + formulaSource.substring(0, 60) + ' → col ' + step.outputColumn +
               (targetSheetName ? ' on sheet ' + targetSheetName : ''));

    try {
      if (targetSheetName) {
        _switchToTargetSheet(targetSheetName);
      }
      var sheet = SpreadsheetApp.getActiveSheet();
      var startRow = step.startRow || 2;
      var endRow = step.endRow || null;

      if (!endRow) {
        try {
          var colAValues = sheet.getRange('A1:A' + sheet.getLastRow()).getValues();
          var lastContiguous = 1;
          for (var ri = 1; ri < colAValues.length; ri++) {
            if (colAValues[ri][0] === '' || colAValues[ri][0] === null) break;
            lastContiguous = ri + 1;
          }
          endRow = lastContiguous > startRow ? lastContiguous : startRow + 11;
        } catch (e) {
          endRow = startRow + 11;
        }
      }

      var firstCell = sheet.getRange(step.outputColumn + startRow);
      firstCell.setFormula(formulaSource);
      if (endRow > startRow) {
        var destRange = sheet.getRange(step.outputColumn + (startRow + 1) + ':' + step.outputColumn + endRow);
        firstCell.copyTo(destRange);
      }
      fixesApplied++;
      Logger.log('[RepairPass] ✅ Fix applied to col ' + step.outputColumn);
    } catch (applyErr) {
      Logger.log('[RepairPass] ❌ Failed to apply fix for col ' + step.outputColumn + ': ' + applyErr.message);
    }
  }

  Logger.log('[RepairPass] Applied ' + fixesApplied + '/' + response.steps.length + ' fixes');

  if (fixesApplied === 0) return null;

  SpreadsheetApp.flush();
  return _scanSheetForErrors(chainState);
}

/**
 * Build a text snapshot of all sheets the chain touched, for the repair prompt.
 * Includes headers + first few data rows + all formula cells with their values.
 */
function _buildSheetSnapshots(chainState) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var seenSheets = {};
  var sheetsToSnapshot = [];
  var steps = chainState.steps || [];

  for (var i = 0; i < steps.length; i++) {
    var ts = steps[i].targetSheet || (steps[i].config && steps[i].config.targetSheet) || '';
    if (ts && !seenSheets[ts]) {
      seenSheets[ts] = true;
      var s = spreadsheet.getSheetByName(ts);
      if (s) sheetsToSnapshot.push(s);
    }
  }
  var activeSheet = spreadsheet.getActiveSheet();
  var activeFound = false;
  for (var j = 0; j < sheetsToSnapshot.length; j++) {
    if (sheetsToSnapshot[j].getName() === activeSheet.getName()) { activeFound = true; break; }
  }
  if (!activeFound) sheetsToSnapshot.unshift(activeSheet);

  var snapshots = [];
  for (var si = 0; si < sheetsToSnapshot.length; si++) {
    var sheet = sheetsToSnapshot[si];
    var sheetName = sheet.getName();
    var lastRow = Math.min(sheet.getLastRow(), 30);
    var lastCol = Math.min(sheet.getLastColumn(), 20);
    if (lastRow === 0 || lastCol === 0) continue;

    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var colLetters = [];
    for (var c = 0; c < lastCol; c++) {
      var letter = String.fromCharCode(65 + (c % 26));
      if (c >= 26) letter = String.fromCharCode(64 + Math.floor(c / 26)) + letter;
      colLetters.push(letter);
    }

    var lines = ['--- Sheet: ' + sheetName + ' ---'];
    lines.push('Headers: ' + colLetters.map(function(l, idx) { return l + '=' + (headers[idx] || ''); }).join(' | '));

    var dataRows = Math.min(lastRow - 1, 5);
    if (dataRows > 0) {
      var values = sheet.getRange(2, 1, dataRows, lastCol).getDisplayValues();
      var formulas = sheet.getRange(2, 1, dataRows, lastCol).getFormulas();
      for (var r = 0; r < dataRows; r++) {
        var cells = [];
        for (var ci = 0; ci < lastCol; ci++) {
          var cellVal = values[r][ci];
          var cellFormula = formulas[r][ci];
          if (cellFormula) {
            cells.push(colLetters[ci] + (r + 2) + '=' + cellFormula + ' → ' + cellVal);
          } else {
            cells.push(colLetters[ci] + (r + 2) + '=' + cellVal);
          }
        }
        lines.push('Row ' + (r + 2) + ': ' + cells.join(' | '));
      }
    }
    snapshots.push(lines.join('\n'));
  }
  return snapshots.join('\n\n');
}

// ============================================
// HOLISTIC ERROR SCAN
// ============================================

/**
 * Scan all cells in the active sheet(s) for formula errors after chain execution.
 * Returns a summary like recalc.py: { totalFormulas, totalErrors, errorSummary }.
 * 
 * @param {Object} chainState - Chain state (used to identify sheets touched)
 * @return {Object|null} Scan result or null if scan failed
 */
function _scanSheetForErrors(chainState) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var totalFormulas = 0;
    var totalErrors = 0;
    var errorSummary = {};
    var ERROR_TYPES = ['#NAME?', '#VALUE!', '#DIV/0!', '#REF!', '#N/A', '#ERROR!', '#NULL!'];
    
    // Determine which sheets to scan: collect unique targetSheet values from steps
    var sheetsToScan = [];
    var seenSheets = {};
    var steps = chainState.steps || [];
    for (var i = 0; i < steps.length; i++) {
      var ts = steps[i].targetSheet || (steps[i].config && steps[i].config.targetSheet) || '';
      if (ts && !seenSheets[ts]) {
        seenSheets[ts] = true;
        var s = spreadsheet.getSheetByName(ts);
        if (s) sheetsToScan.push(s);
      }
    }
    // Always include the active sheet (default target)
    var activeSheet = spreadsheet.getActiveSheet();
    var activeFound = false;
    for (var j = 0; j < sheetsToScan.length; j++) {
      if (sheetsToScan[j].getName() === activeSheet.getName()) { activeFound = true; break; }
    }
    if (!activeFound) sheetsToScan.unshift(activeSheet);
    
    for (var si = 0; si < sheetsToScan.length; si++) {
      var sheet = sheetsToScan[si];
      var sheetName = sheet.getName();
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow === 0 || lastCol === 0) continue;
      
      var formulas = sheet.getRange(1, 1, lastRow, lastCol).getFormulas();
      var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
      
      for (var r = 0; r < lastRow; r++) {
        for (var c = 0; c < lastCol; c++) {
          if (formulas[r][c]) {
            totalFormulas++;
            var displayVal = values[r][c];
            for (var e = 0; e < ERROR_TYPES.length; e++) {
              if (displayVal === ERROR_TYPES[e]) {
                totalErrors++;
                var errType = ERROR_TYPES[e];
                if (!errorSummary[errType]) errorSummary[errType] = { count: 0, locations: [] };
                errorSummary[errType].count++;
                var colLetter = String.fromCharCode(65 + (c % 26));
                if (c >= 26) colLetter = String.fromCharCode(64 + Math.floor(c / 26)) + colLetter;
                var cellRef = sheetName + '!' + colLetter + (r + 1);
                if (errorSummary[errType].locations.length < 10) {
                  errorSummary[errType].locations.push({
                    cell: cellRef,
                    formula: formulas[r][c]
                  });
                }
                break;
              }
            }
          }
        }
      }
    }
    
    // Detect formula columns where every value is zero/empty — a strong signal
    // of broken references (e.g., =$B$2 instead of =Assumptions!$B$2).
    // Only flag columns with 3+ formula rows that ALL produce 0 or blank.
    var suspiciousZeros = [];
    for (var szi = 0; szi < sheetsToScan.length; szi++) {
      var szSheet = sheetsToScan[szi];
      var szName = szSheet.getName();
      var szLastRow = szSheet.getLastRow();
      var szLastCol = szSheet.getLastColumn();
      if (szLastRow < 3 || szLastCol === 0) continue;
      
      var szFormulas = szSheet.getRange(1, 1, szLastRow, szLastCol).getFormulas();
      var szValues = szSheet.getRange(1, 1, szLastRow, szLastCol).getValues();
      
      for (var szc = 0; szc < szLastCol; szc++) {
        var formulaCount = 0;
        var allZeroOrEmpty = true;
        var sampleFormula = '';
        for (var szr = 1; szr < szLastRow; szr++) {
          if (szFormulas[szr][szc]) {
            formulaCount++;
            if (!sampleFormula) sampleFormula = szFormulas[szr][szc];
            var v = szValues[szr][szc];
            if (v !== 0 && v !== '' && v !== null && v !== undefined) {
              allZeroOrEmpty = false;
              break;
            }
          }
        }
        if (formulaCount >= 3 && allZeroOrEmpty) {
          var szColLetter = String.fromCharCode(65 + (szc % 26));
          if (szc >= 26) szColLetter = String.fromCharCode(64 + Math.floor(szc / 26)) + szColLetter;
          var headerLabel = szSheet.getRange(1, szc + 1).getDisplayValue() || szColLetter;
          suspiciousZeros.push({
            sheet: szName,
            column: szColLetter,
            header: headerLabel,
            formulaCount: formulaCount,
            sampleFormula: sampleFormula
          });
        }
      }
    }
    
    var totalSuspicious = suspiciousZeros.length;
    if (totalSuspicious > 0 && totalErrors === 0) {
      Logger.log('[HolisticScan] ⚠️ ' + totalSuspicious + ' formula column(s) produce all-zero values: ' + 
                 JSON.stringify(suspiciousZeros));
    }
    
    return {
      status: totalErrors > 0 ? 'errors_found' : (totalSuspicious > 0 ? 'suspicious_zeros' : 'success'),
      totalFormulas: totalFormulas,
      totalErrors: totalErrors,
      totalSuspicious: totalSuspicious,
      sheetsScanned: sheetsToScan.map(function(s) { return s.getName(); }),
      errorSummary: totalErrors > 0 ? errorSummary : undefined,
      suspiciousZeros: totalSuspicious > 0 ? suspiciousZeros : undefined
    };
  } catch (e) {
    Logger.log('[HolisticScan] Error during scan: ' + e.message);
    return null;
  }
}

// ============================================
// MODULE LOADED
// ============================================

Logger.log('📦 AgentTaskChain_Execute module loaded');
