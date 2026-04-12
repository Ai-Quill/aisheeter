/**
 * @file FormulaGenerator.gs
 * @version 1.0.0
 * @updated 2026-01-16
 * @author AISheeter Team
 * 
 * ============================================
 * FORMULA GENERATOR - Native Spreadsheet Formulas
 * ============================================
 * 
 * Leverages Google Sheets' 500+ built-in functions to generate
 * native formulas instead of relying on AI for every operation.
 * 
 * Philosophy: AI teaches the rule ONCE → Native formula works FOREVER
 * 
 * Supported formula patterns:
 * - Threshold classification (IFS with numeric comparisons)
 * - Keyword classification (IFS with REGEXMATCH)
 * - Exact match lookup (XLOOKUP, SWITCH)
 * - Text extraction (REGEXEXTRACT)
 * - Data cleaning (TRIM, PROPER, SUBSTITUTE, REGEXREPLACE)
 * - Scoring formulas (LET with complex logic)
 * 
 * Excel compatibility notes included for each formula type.
 */

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Generate a native formula from a classification rule
 * 
 * @param {Object} rule - The classification rule from AI
 * @param {string} rule.type - Rule type: threshold, keyword, exact, contains, regex
 * @param {Array} rule.conditions - Array of conditions
 * @param {string} rule.inputColumn - Input column letter
 * @param {number} rule.startRow - First data row
 * @return {Object} Formula result with template and metadata
 */
function generateNativeFormula(rule) {
  if (!rule || !rule.type) {
    return { success: false, error: 'No rule provided' };
  }
  
  var inputRef = rule.inputColumn + rule.startRow;
  
  switch (rule.type) {
    case 'threshold':
      return generateThresholdFormula(rule.conditions, inputRef);
      
    case 'keyword':
      return generateKeywordFormula(rule.conditions, inputRef);
      
    case 'exact':
      return generateExactMatchFormula(rule.conditions, inputRef);
      
    case 'contains':
      return generateContainsFormula(rule.conditions, inputRef);
      
    case 'regex':
      return generateRegexFormula(rule.conditions, inputRef);
      
    case 'range':
      return generateRangeFormula(rule.conditions, inputRef);
      
    case 'length':
      return generateLengthFormula(rule.conditions, inputRef);
      
    case 'date':
      return generateDateFormula(rule.conditions, inputRef);
      
    default:
      return { success: false, error: 'Unknown rule type: ' + rule.type };
  }
}

// ============================================
// THRESHOLD FORMULAS (Numeric comparisons)
// ============================================

/**
 * Generate IFS formula for numeric thresholds
 * Example: =IFS(A2>=1000,"Large",A2>=100,"Medium",TRUE,"Small")
 * 
 * Excel compatible: Yes (IFS available in Excel 2019+)
 * 
 * @param {Array} conditions - [{threshold: 1000, result: "Large"}, ...]
 * @param {string} cellRef - Cell reference like "A2"
 */
function generateThresholdFormula(conditions, cellRef) {
  if (!conditions || conditions.length === 0) {
    return { success: false, error: 'No conditions provided' };
  }
  
  // Sort conditions by threshold descending (largest first)
  var sorted = conditions.slice().sort(function(a, b) {
    return (b.threshold || 0) - (a.threshold || 0);
  });
  
  var parts = [];
  
  sorted.forEach(function(cond, index) {
    if (cond.threshold !== undefined && cond.threshold !== null) {
      var operator = cond.operator || '>=';
      parts.push(cellRef + operator + cond.threshold + ',"' + escapeFormulaString(cond.result) + '"');
    }
  });
  
  // Add default case
  var defaultResult = sorted[sorted.length - 1]?.defaultResult || sorted[sorted.length - 1]?.result || 'Other';
  parts.push('TRUE,"' + escapeFormulaString(defaultResult) + '"');
  
  var formula = '=IFS(' + parts.join(',') + ')';
  
  return {
    success: true,
    formula: formula,
    formulaType: 'IFS',
    excelCompatible: true,
    description: 'Classifies based on numeric thresholds',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// KEYWORD FORMULAS (Text pattern matching)
// ============================================

/**
 * Generate IFS formula with REGEXMATCH for keyword classification
 * Example: =IFS(REGEXMATCH(LOWER(A2),"urgent|critical"),"High",REGEXMATCH(LOWER(A2),"normal"),"Medium",TRUE,"Low")
 * 
 * Excel note: Use SEARCH or nested IFs instead (REGEXMATCH not in Excel)
 * 
 * @param {Array} conditions - [{keywords: ["urgent", "critical"], result: "High"}, ...]
 * @param {string} cellRef - Cell reference
 */
function generateKeywordFormula(conditions, cellRef) {
  if (!conditions || conditions.length === 0) {
    return { success: false, error: 'No conditions provided' };
  }
  
  var parts = [];
  var lowerCell = 'LOWER(' + cellRef + ')';
  
  conditions.forEach(function(cond) {
    if (cond.keywords && cond.keywords.length > 0) {
      // Escape regex special chars and join with |
      var pattern = cond.keywords.map(escapeRegex).join('|');
      parts.push('REGEXMATCH(' + lowerCell + ',"' + pattern + '"),"' + escapeFormulaString(cond.result) + '"');
    }
  });
  
  // Default case
  var defaultResult = conditions[conditions.length - 1]?.defaultResult || 'Other';
  parts.push('TRUE,"' + escapeFormulaString(defaultResult) + '"');
  
  var formula = '=IFS(' + parts.join(',') + ')';
  
  // Also generate Excel-compatible version
  var excelFormula = generateExcelKeywordFormula(conditions, cellRef);
  
  return {
    success: true,
    formula: formula,
    formulaType: 'IFS+REGEXMATCH',
    excelCompatible: false,
    excelAlternative: excelFormula,
    description: 'Classifies based on keywords in text',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

/**
 * Generate Excel-compatible keyword formula using SEARCH
 * Less elegant but works in Excel
 */
function generateExcelKeywordFormula(conditions, cellRef) {
  var parts = [];
  
  conditions.forEach(function(cond) {
    if (cond.keywords && cond.keywords.length > 0) {
      // Use OR with ISNUMBER(SEARCH()) for each keyword
      var searches = cond.keywords.map(function(kw) {
        return 'ISNUMBER(SEARCH("' + escapeFormulaString(kw) + '",' + cellRef + '))';
      });
      
      if (searches.length === 1) {
        parts.push(searches[0] + ',"' + escapeFormulaString(cond.result) + '"');
      } else {
        parts.push('OR(' + searches.join(',') + '),"' + escapeFormulaString(cond.result) + '"');
      }
    }
  });
  
  var defaultResult = conditions[conditions.length - 1]?.defaultResult || 'Other';
  parts.push('TRUE,"' + escapeFormulaString(defaultResult) + '"');
  
  return '=IFS(' + parts.join(',') + ')';
}

// ============================================
// EXACT MATCH FORMULAS (XLOOKUP/SWITCH)
// ============================================

/**
 * Generate XLOOKUP or SWITCH for exact value matching
 * Example: =SWITCH(A2,"Active","✓ Active","Inactive","✗ Inactive","Unknown")
 * 
 * Excel compatible: SWITCH (2019+), XLOOKUP (365)
 * 
 * @param {Array} conditions - [{value: "Active", result: "✓ Active"}, ...]
 * @param {string} cellRef - Cell reference
 */
function generateExactMatchFormula(conditions, cellRef) {
  if (!conditions || conditions.length === 0) {
    return { success: false, error: 'No conditions provided' };
  }
  
  // Use SWITCH for small number of conditions (cleaner)
  if (conditions.length <= 10) {
    return generateSwitchFormula(conditions, cellRef);
  }
  
  // Use XLOOKUP for larger lookups (with inline array)
  return generateXlookupFormula(conditions, cellRef);
}

/**
 * Generate SWITCH formula
 * =SWITCH(A2,"val1","result1","val2","result2","default")
 */
function generateSwitchFormula(conditions, cellRef) {
  var parts = [cellRef];
  
  conditions.forEach(function(cond) {
    if (cond.value !== undefined) {
      var valueStr = typeof cond.value === 'string' 
        ? '"' + escapeFormulaString(cond.value) + '"' 
        : cond.value;
      parts.push(valueStr);
      parts.push('"' + escapeFormulaString(cond.result) + '"');
    }
  });
  
  // Default value
  var defaultResult = conditions[conditions.length - 1]?.defaultResult || '';
  parts.push('"' + escapeFormulaString(defaultResult) + '"');
  
  var formula = '=SWITCH(' + parts.join(',') + ')';
  
  return {
    success: true,
    formula: formula,
    formulaType: 'SWITCH',
    excelCompatible: true,
    description: 'Maps exact values to results',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

/**
 * Generate XLOOKUP formula with inline arrays
 * =XLOOKUP(A2,{"val1","val2"},{"result1","result2"},"default")
 */
function generateXlookupFormula(conditions, cellRef) {
  var lookupValues = [];
  var results = [];
  
  conditions.forEach(function(cond) {
    if (cond.value !== undefined) {
      lookupValues.push('"' + escapeFormulaString(String(cond.value)) + '"');
      results.push('"' + escapeFormulaString(cond.result) + '"');
    }
  });
  
  var defaultResult = conditions[conditions.length - 1]?.defaultResult || '';
  
  var formula = '=XLOOKUP(' + cellRef + ',{' + lookupValues.join(',') + '},{' + results.join(',') + '},"' + escapeFormulaString(defaultResult) + '")';
  
  return {
    success: true,
    formula: formula,
    formulaType: 'XLOOKUP',
    excelCompatible: true,
    description: 'Looks up exact value and returns mapped result',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// CONTAINS FORMULAS (Simple text search)
// ============================================

/**
 * Generate formula using SEARCH (case-insensitive contains)
 * Example: =IFS(ISNUMBER(SEARCH("urgent",A2)),"High",TRUE,"Normal")
 * 
 * Excel compatible: Yes
 */
function generateContainsFormula(conditions, cellRef) {
  var parts = [];
  
  conditions.forEach(function(cond) {
    if (cond.text) {
      parts.push('ISNUMBER(SEARCH("' + escapeFormulaString(cond.text) + '",' + cellRef + ')),"' + escapeFormulaString(cond.result) + '"');
    }
  });
  
  var defaultResult = conditions[conditions.length - 1]?.defaultResult || 'Other';
  parts.push('TRUE,"' + escapeFormulaString(defaultResult) + '"');
  
  var formula = '=IFS(' + parts.join(',') + ')';
  
  return {
    success: true,
    formula: formula,
    formulaType: 'IFS+SEARCH',
    excelCompatible: true,
    description: 'Classifies based on text containment',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// REGEX FORMULAS (Complex patterns)
// ============================================

/**
 * Generate REGEXEXTRACT formula for extraction
 * Example: =REGEXEXTRACT(A2,"[\w.-]+@[\w.-]+\.\w+")
 * 
 * Excel note: No direct equivalent, use Power Query or VBA
 */
function generateRegexFormula(conditions, cellRef) {
  if (!conditions || conditions.length === 0) {
    return { success: false, error: 'No regex pattern provided' };
  }
  
  var pattern = conditions[0].pattern;
  var action = conditions[0].action || 'extract';
  
  var formula;
  var formulaType;
  
  switch (action) {
    case 'extract':
      formula = '=IFERROR(REGEXEXTRACT(' + cellRef + ',"' + escapeFormulaString(pattern) + '"),"")';
      formulaType = 'REGEXEXTRACT';
      break;
      
    case 'match':
      formula = '=REGEXMATCH(' + cellRef + ',"' + escapeFormulaString(pattern) + '")';
      formulaType = 'REGEXMATCH';
      break;
      
    case 'replace':
      var replacement = conditions[0].replacement || '';
      formula = '=REGEXREPLACE(' + cellRef + ',"' + escapeFormulaString(pattern) + '","' + escapeFormulaString(replacement) + '")';
      formulaType = 'REGEXREPLACE';
      break;
      
    default:
      formula = '=REGEXMATCH(' + cellRef + ',"' + escapeFormulaString(pattern) + '")';
      formulaType = 'REGEXMATCH';
  }
  
  return {
    success: true,
    formula: formula,
    formulaType: formulaType,
    excelCompatible: false,
    description: 'Pattern-based text operation',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// RANGE FORMULAS (Between values)
// ============================================

/**
 * Generate formula for range-based classification
 * Example: =IFS(AND(A2>=0,A2<50),"Low",AND(A2>=50,A2<100),"Medium",TRUE,"High")
 */
function generateRangeFormula(conditions, cellRef) {
  var parts = [];
  
  conditions.forEach(function(cond) {
    if (cond.min !== undefined && cond.max !== undefined) {
      parts.push('AND(' + cellRef + '>=' + cond.min + ',' + cellRef + '<' + cond.max + '),"' + escapeFormulaString(cond.result) + '"');
    } else if (cond.min !== undefined) {
      parts.push(cellRef + '>=' + cond.min + ',"' + escapeFormulaString(cond.result) + '"');
    } else if (cond.max !== undefined) {
      parts.push(cellRef + '<' + cond.max + ',"' + escapeFormulaString(cond.result) + '"');
    }
  });
  
  var defaultResult = conditions[conditions.length - 1]?.defaultResult || 'Other';
  parts.push('TRUE,"' + escapeFormulaString(defaultResult) + '"');
  
  var formula = '=IFS(' + parts.join(',') + ')';
  
  return {
    success: true,
    formula: formula,
    formulaType: 'IFS+AND',
    excelCompatible: true,
    description: 'Classifies based on numeric ranges',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// LENGTH FORMULAS (Text length based)
// ============================================

/**
 * Generate formula based on text length
 * Example: =IFS(LEN(A2)>500,"Long",LEN(A2)>100,"Medium",TRUE,"Short")
 */
function generateLengthFormula(conditions, cellRef) {
  var parts = [];
  var lenCell = 'LEN(' + cellRef + ')';
  
  conditions.forEach(function(cond) {
    if (cond.minLength !== undefined) {
      parts.push(lenCell + '>=' + cond.minLength + ',"' + escapeFormulaString(cond.result) + '"');
    }
  });
  
  var defaultResult = conditions[conditions.length - 1]?.defaultResult || 'Short';
  parts.push('TRUE,"' + escapeFormulaString(defaultResult) + '"');
  
  var formula = '=IFS(' + parts.join(',') + ')';
  
  return {
    success: true,
    formula: formula,
    formulaType: 'IFS+LEN',
    excelCompatible: true,
    description: 'Classifies based on text length',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// DATE FORMULAS (Date-based classification)
// ============================================

/**
 * Generate formula for date-based classification
 * Uses TODAY(), DATEDIF, or date comparisons
 */
function generateDateFormula(conditions, cellRef) {
  var parts = [];
  
  conditions.forEach(function(cond) {
    if (cond.daysAgo !== undefined) {
      // Days since date
      parts.push('TODAY()-' + cellRef + '<=' + cond.daysAgo + ',"' + escapeFormulaString(cond.result) + '"');
    } else if (cond.beforeDate) {
      parts.push(cellRef + '<DATE(' + formatDateParts(cond.beforeDate) + '),"' + escapeFormulaString(cond.result) + '"');
    } else if (cond.afterDate) {
      parts.push(cellRef + '>DATE(' + formatDateParts(cond.afterDate) + '),"' + escapeFormulaString(cond.result) + '"');
    }
  });
  
  var defaultResult = conditions[conditions.length - 1]?.defaultResult || 'Other';
  parts.push('TRUE,"' + escapeFormulaString(defaultResult) + '"');
  
  var formula = '=IFS(' + parts.join(',') + ')';
  
  return {
    success: true,
    formula: formula,
    formulaType: 'IFS+DATE',
    excelCompatible: true,
    description: 'Classifies based on dates',
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// COMMON EXTRACTION FORMULAS
// ============================================

/**
 * Pre-built formulas for common extraction tasks
 * These don't need AI - just pattern matching
 */
var EXTRACTION_FORMULAS = {
  email: {
    formula: '=IFERROR(REGEXEXTRACT({cell},"[\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,}"),""))',
    description: 'Extract email address',
    excelCompatible: false
  },
  
  phone: {
    formula: '=IFERROR(REGEXEXTRACT({cell},"\\+?[\\d\\s\\-\\(\\)]{10,}"),""))',
    description: 'Extract phone number',
    excelCompatible: false
  },
  
  url: {
    formula: '=IFERROR(REGEXEXTRACT({cell},"https?://[^\\s]+"),""))',
    description: 'Extract URL',
    excelCompatible: false
  },
  
  number: {
    formula: '=IFERROR(VALUE(REGEXEXTRACT({cell},"[\\d,]+\\.?\\d*")),0)',
    description: 'Extract first number',
    excelCompatible: false
  },
  
  hashtag: {
    formula: '=IFERROR(REGEXEXTRACT({cell},"#\\w+"),""))',
    description: 'Extract hashtag',
    excelCompatible: false
  },
  
  firstName: {
    formula: '=IFERROR(TRIM(LEFT({cell},FIND(" ",{cell}&" ")-1)),{cell})',
    description: 'Extract first name (first word)',
    excelCompatible: true
  },
  
  lastName: {
    formula: '=IFERROR(TRIM(RIGHT({cell},LEN({cell})-FIND("*",SUBSTITUTE({cell}," ","*",LEN({cell})-LEN(SUBSTITUTE({cell}," ","")))))),"")',
    description: 'Extract last name (last word)',
    excelCompatible: true
  },
  
  domain: {
    formula: '=IFERROR(REGEXEXTRACT({cell},"@([\\w.-]+)"),""))',
    description: 'Extract email domain',
    excelCompatible: false
  }
};

/**
 * Get pre-built extraction formula
 */
function getExtractionFormula(type, cellRef) {
  var template = EXTRACTION_FORMULAS[type];
  if (!template) {
    return { success: false, error: 'Unknown extraction type: ' + type };
  }
  
  var formula = template.formula.replace(/\{cell\}/g, cellRef);
  
  return {
    success: true,
    formula: formula,
    formulaType: 'EXTRACTION',
    excelCompatible: template.excelCompatible,
    description: template.description,
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// CLEANING FORMULAS
// ============================================

/**
 * Pre-built formulas for data cleaning
 */
var CLEANING_FORMULAS = {
  trim: {
    formula: '=TRIM({cell})',
    description: 'Remove extra whitespace',
    excelCompatible: true
  },
  
  clean: {
    formula: '=CLEAN(TRIM({cell}))',
    description: 'Remove non-printable characters',
    excelCompatible: true
  },
  
  properCase: {
    formula: '=PROPER(TRIM({cell}))',
    description: 'Convert to Title Case',
    excelCompatible: true
  },
  
  upperCase: {
    formula: '=UPPER(TRIM({cell}))',
    description: 'Convert to UPPERCASE',
    excelCompatible: true
  },
  
  lowerCase: {
    formula: '=LOWER(TRIM({cell}))',
    description: 'Convert to lowercase',
    excelCompatible: true
  },
  
  removeNumbers: {
    formula: '=REGEXREPLACE({cell},"[0-9]","")',
    description: 'Remove all numbers',
    excelCompatible: false
  },
  
  onlyNumbers: {
    formula: '=REGEXREPLACE({cell},"[^0-9.]","")',
    description: 'Keep only numbers',
    excelCompatible: false
  },
  
  removeSpecialChars: {
    formula: '=REGEXREPLACE({cell},"[^a-zA-Z0-9\\s]","")',
    description: 'Remove special characters',
    excelCompatible: false
  }
};

/**
 * Get pre-built cleaning formula
 */
function getCleaningFormula(type, cellRef) {
  var template = CLEANING_FORMULAS[type];
  if (!template) {
    return { success: false, error: 'Unknown cleaning type: ' + type };
  }
  
  var formula = template.formula.replace(/\{cell\}/g, cellRef);
  
  return {
    success: true,
    formula: formula,
    formulaType: 'CLEANING',
    excelCompatible: template.excelCompatible,
    description: template.description,
    example: formula.replace(cellRef, cellRef.replace(/\d+/, 'N'))
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape string for use in formula
 */
function escapeFormulaString(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/"/g, '""');
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format date for DATE() function
 */
function formatDateParts(dateStr) {
  var date = new Date(dateStr);
  return date.getFullYear() + ',' + (date.getMonth() + 1) + ',' + date.getDate();
}

/**
 * Apply formula to a range
 * Creates the formula for the first row, which users can then drag down
 * or we apply to all rows
 * 
 * @param {string} formulaTemplate - Formula with cell reference
 * @param {string} outputColumn - Output column letter
 * @param {number} startRow - First data row
 * @param {number} endRow - Last data row
 * @return {Object} Result with success status
 */
function applyFormulaToColumnRange(formulaTemplate, outputColumn, startRow, endRow) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var formulas = [];
  
  // The template should have a cell reference like C2
  // We need to adjust for each row
  for (var row = startRow; row <= endRow; row++) {
    var rowFormula = formulaTemplate.replace(/([A-Z]+)\d+/g, function(match, col) {
      return col + row;
    });
    formulas.push([rowFormula]);
  }
  
  var range = sheet.getRange(outputColumn + startRow + ':' + outputColumn + endRow);
  range.setFormulas(formulas);
  
  return {
    success: true,
    rowCount: endRow - startRow + 1,
    formula: formulaTemplate
  };
}

/**
 * Apply a formula with {ROW} placeholder to a column range
 * Called from Sidebar_Agent_Execution.html for FormulaFirst results
 * 
 * @param {string} formulaTemplate - Formula with {ROW} placeholder (e.g., =IFS(D{ROW}>1000,"Hot",...))
 * @param {string} outputColumn - Output column letter (e.g., "E")
 * @param {number} startRow - First data row
 * @param {number} endRow - Last data row
 * @return {Object} Result with success status and rows affected
 */
function applyFormulaToColumn(formulaTemplate, outputColumn, startRow, endRow) {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var formulas = [];
    
    // Handle {ROW} placeholder format from FormulaFirst
    for (var row = startRow; row <= endRow; row++) {
      var rowFormula = formulaTemplate.replace(/\{ROW\}/g, row.toString());
      formulas.push([rowFormula]);
    }
    
    // Apply formulas to the output column
    var range = sheet.getRange(outputColumn + startRow + ':' + outputColumn + endRow);
    range.setFormulas(formulas);
    
    Logger.log('✅ Applied formula to ' + outputColumn + startRow + ':' + outputColumn + endRow);
    
    return {
      success: true,
      rowsAffected: endRow - startRow + 1,
      formula: formulaTemplate,
      range: outputColumn + startRow + ':' + outputColumn + endRow
    };
  } catch (e) {
    Logger.log('❌ applyFormulaToColumn error: ' + e.message);
    return {
      success: false,
      error: e.message,
      formula: formulaTemplate
    };
  }
}

// ============================================
// MODULE LOADED
// ============================================

Logger.log('📦 FormulaGenerator v1.1 loaded - Native formula generation');
