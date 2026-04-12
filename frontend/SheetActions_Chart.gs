/**
 * @file SheetActions_Chart.gs
 * @version 1.0.0
 * @created 2026-01-30
 * @author AISheeter Team
 * 
 * ============================================
 * SHEET ACTIONS - Chart Creation
 * ============================================
 * 
 * Creates charts from data with comprehensive configuration options.
 * Supports: bar, column, line, pie, area, scatter, combo, histogram.
 */

var SheetActions_Chart = (function() {
  
  // ============================================
  // MAIN CHART CREATION
  // ============================================
  
  /**
   * Create a chart from data with full configuration
   * @param {Object} step - { chartType, dataRange, config }
   * @return {Object} Result with chart details
   * 
   * ============================================
   * COMPREHENSIVE CONFIG OPTIONS
   * ============================================
   * 
   * COMMON OPTIONS (all chart types):
   * - title: Chart title text
   * - seriesNames: Array of legend labels for each data series
   * - colors: Array of hex colors for each series (or use defaults)
   * - legendPosition: 'right', 'bottom', 'top', 'left', 'in', 'none'
   * - width, height: Chart dimensions in pixels (default 600x400)
   * - backgroundColor: Chart background color
   * - fontName: Font family for all text
   * 
   * BAR/COLUMN CHART OPTIONS:
   * - stacked: boolean - Stack bars/columns
   * - stackedPercent: boolean - Stack as 100% (percentage)
   * - showDataLabels: boolean - Show values on bars
   * - barGroupWidth: string - Width of bar groups (e.g., '75%')
   * 
   * LINE CHART OPTIONS:
   * - curveType: 'none' (straight) or 'function' (smooth curves)
   * - lineWidth: number - Thickness of lines (default 2)
   * - pointSize: number - Size of data points (0 = no points)
   * - pointShape: 'circle', 'triangle', 'square', 'diamond', 'star', 'polygon'
   * - interpolateNulls: boolean - Connect line through null points
   * - lineDashStyle: Array - Dash pattern e.g., [4, 4] for dashed
   * 
   * AREA CHART OPTIONS:
   * - areaOpacity: number 0-1 - Transparency of fill (default 0.3)
   * - stacked: boolean - Stack areas
   * - lineWidth: number - Border line thickness
   * 
   * PIE/DONUT CHART OPTIONS:
   * - pieHole: number 0-1 - Size of hole for donut (0 = pie, 0.4 = donut)
   * - pieSliceText: 'percentage', 'value', 'label', 'none'
   * - pieSliceBorderColor: Slice border color
   * - pieStartAngle: number - Starting angle in degrees
   * - is3D: boolean - 3D pie chart
   * - sliceVisibilityThreshold: number - Hide slices below this %
   * 
   * SCATTER CHART OPTIONS:
   * - pointSize: number - Size of points (default 7)
   * - pointShape: 'circle', 'triangle', 'square', 'diamond', 'star'
   * - trendlines: boolean - Add linear trendline
   * - trendlineColor: Trendline color
   * - trendlineOpacity: number 0-1
   * - annotationColumn: string - Column letter with text labels for data points (e.g., company names)
   * 
   * AXIS OPTIONS (bar, column, line, area, scatter):
   * - xAxisTitle: Title for X-axis
   * - yAxisTitle: Title for Y-axis
   * - xAxisFormat: Number format for X-axis
   * - yAxisFormat: Number format for Y-axis
   * - xAxisMin, xAxisMax: Axis range
   * - yAxisMin, yAxisMax: Axis range
   * - gridlines: boolean - Show gridlines (default true)
   * - gridlineColor: Color of gridlines
   * - logScale: boolean - Use logarithmic scale for Y-axis
   * - secondaryAxis: Array of series indices to use secondary Y-axis
   */
  function createChart(step) {
    var sheet = SpreadsheetApp.getActiveSheet();
    var config = step.config || {};
    
    Logger.log('[SheetActions_Chart] Config: ' + JSON.stringify(config).substring(0, 500));
    
    // CRITICAL: Flush before chart creation to ensure all prior formula calculations
    // and data writes are committed.
    SpreadsheetApp.flush();
    
    // Resolve chart ranges from AI-provided column config
    var chartRanges = _resolveChartRanges(sheet, config, step);
    
    var chartType = (config.chartType || step.chartType || 'column').toLowerCase();
    var chartWidth = config.width || (chartType === 'pie' ? 500 : 600);
    var chartHeight = config.height || 400;
    var posRow = config.positionRow || 2;
    var posCol = config.positionColumn || (sheet.getLastColumn() + 2);
    
    // ============================================
    // PHASE 1: Build minimal chart (type + ranges + position)
    // ============================================
    var chartBuilder = sheet.newChart()
      .setChartType(SheetActions_Utils.getChartType(chartType))
      .setPosition(posRow, posCol, 0, 0)
      .setOption('width', chartWidth)
      .setOption('height', chartHeight);
    
    // For domainColumn+dataColumns charts (multiple separate ranges),
    // we must use MERGE_COLUMNS + setNumHeaders so the chart knows which
    // column is the domain. For single-range (contiguous columns), the chart
    // auto-detects text columns as domain — no MERGE_COLUMNS needed.
    var hasDomainColumn = !!(config.domainColumn || config.xAxisColumn || config.labelsColumn);
    
    if (chartRanges.length > 1) {
      // Non-adjacent columns: need MERGE_COLUMNS to combine separate ranges
      chartBuilder.setMergeStrategy(Charts.ChartMergeStrategy.MERGE_COLUMNS);
      chartBuilder.setNumHeaders(1);
      chartBuilder.setOption('useFirstColumnAsDomain', true);
    } else if (hasDomainColumn) {
      // Single contiguous range from adjacent domain+data columns:
      // Explicitly tell the chart to use the first column as domain labels
      // and setNumHeaders(1) so the header row isn't plotted as data.
      chartBuilder.setNumHeaders(1);
      chartBuilder.setOption('useFirstColumnAsDomain', true);
    }
    
    // Add ranges. For MERGE_COLUMNS, domain is added first.
    // DIAGNOSTIC: Log actual cell values AND types to verify the data
    // is numeric (not text strings that look like numbers).
    var dataRange;
    for (var ri = 0; ri < chartRanges.length; ri++) {
      var r = sheet.getRange(chartRanges[ri]);
      Logger.log('[SheetActions_Chart] addRange[' + ri + ']: ' + chartRanges[ri] + (ri === 0 ? ' (DOMAIN)' : ' (DATA)'));
      
      try {
        var vals = r.getValues();
        // Log both values and their JavaScript types
        var typeInfo = vals.map(function(row) {
          return row.map(function(cell) {
            return typeof cell + ':' + String(cell).substring(0, 20);
          });
        });
        Logger.log('[SheetActions_Chart] Values: ' + JSON.stringify(vals).substring(0, 300));
        Logger.log('[SheetActions_Chart] Types:  ' + JSON.stringify(typeInfo).substring(0, 300));
        
        // FIX: Auto-convert text-as-number values in DATA columns (not domain)
        // Common issue: cells contain "$ 19.4" or "19.4%" as text strings
        // instead of actual numbers. Google Charts can't plot these.
        if (ri > 0 || (chartRanges.length === 1 && hasDomainColumn)) {
          var needsFixing = false;
          var startDataRow = 1; // Skip header row (index 0)
          
          // For single contiguous range, data columns start after domain
          var dataColStart = (chartRanges.length === 1 && hasDomainColumn) ? 1 : 0;
          
          for (var rowIdx = startDataRow; rowIdx < vals.length; rowIdx++) {
            for (var colIdx = dataColStart; colIdx < vals[rowIdx].length; colIdx++) {
              var cellVal = vals[rowIdx][colIdx];
              if (typeof cellVal === 'string' && cellVal.length > 0) {
                // Strip currency symbols, commas, %, spaces and try to parse
                var cleaned = cellVal.replace(/[$€£¥,\s%]/g, '').trim();
                if (cleaned.length > 0 && !isNaN(Number(cleaned))) {
                  needsFixing = true;
                  break;
                }
              }
            }
            if (needsFixing) break;
          }
          
          if (needsFixing) {
            Logger.log('[SheetActions_Chart] ⚠️ Data column has text-as-number values, converting...');
            var fixedVals = vals.map(function(row, rIdx) {
              if (rIdx === 0) return row; // Keep headers as-is
              return row.map(function(cell, cIdx) {
                if (cIdx < dataColStart) return cell; // Keep domain column as-is
                if (typeof cell === 'string' && cell.length > 0) {
                  var stripped = cell.replace(/[$€£¥,\s%]/g, '').trim();
                  var num = Number(stripped);
                  if (!isNaN(num)) return num;
                }
                return cell;
              });
            });
            r.setValues(fixedVals);
            SpreadsheetApp.flush();
            Logger.log('[SheetActions_Chart] ✅ Converted text-as-number values to actual numbers');
            // Re-get range reference after flush
            r = sheet.getRange(chartRanges[ri]);
          }
        }
      } catch (e) {
        Logger.log('[SheetActions_Chart] Could not read values: ' + e.message);
      }
      
      chartBuilder.addRange(r);
      if (ri === 0) dataRange = r;
    }
    
    // ============================================
    // PHASE 2: Title only (safest option)
    // ============================================
    if (config.title) {
      chartBuilder.setOption('title', config.title);
    }
    
    // ============================================
    // PHASE 3: Chart-type specific options + axes
    // ============================================
    if (chartType === 'pie') {
      _applyPieChartOptions(chartBuilder, config);
    } else if (chartType === 'bar' || chartType === 'column') {
      _applyBarColumnChartOptions(chartBuilder, config, chartType);
    } else if (chartType === 'line') {
      _applyLineChartOptions(chartBuilder, config, dataRange);
    } else if (chartType === 'area') {
      _applyAreaChartOptions(chartBuilder, config);
    } else if (chartType === 'scatter') {
      _applyScatterChartOptions(chartBuilder, config);
    } else if (chartType === 'combo') {
      _applyComboChartOptions(chartBuilder, config);
    }
    
    if (config.secondaryAxis && config.secondaryAxis.length > 0) {
      _applyDualAxisOptions(chartBuilder, config);
    }
    
    _applyAxisOptions(chartBuilder, config, dataRange);
    
    // Build and insert chart
    var chart = chartBuilder.build();
    sheet.insertChart(chart);
    
    Logger.log('[SheetActions_Chart] ' + chartType.toUpperCase() + ' chart created (minimal config)');
    Logger.log('[SheetActions_Chart] Ranges: ' + chartRanges.join(', '));
    
    return { 
      chartType: chartType, 
      ranges: chartRanges,
      title: config.title || 'Chart',
      series: config.seriesNames || [],
      dimensions: { width: chartWidth, height: chartHeight }
    };
  }
  
  // ============================================
  // CHART-TYPE SPECIFIC OPTIONS
  // ============================================
  
  /**
   * Apply PIE/DONUT chart specific options
   */
  function _applyPieChartOptions(chartBuilder, config) {
    // Donut hole (0 = pie, 0.4 = nice donut)
    if (config.pieHole !== undefined) {
      chartBuilder.setOption('pieHole', config.pieHole);
    } else if (config.donut) {
      chartBuilder.setOption('pieHole', 0.4);
    }
    
    // Slice text
    if (config.pieSliceText) {
      chartBuilder.setOption('pieSliceText', config.pieSliceText);
    }
    chartBuilder.setOption('pieSliceTextStyle', {
      fontSize: 12,
      color: config.pieSliceTextColor || '#ffffff',
      bold: true
    });
    
    // Slice border
    if (config.pieSliceBorderColor) {
      chartBuilder.setOption('pieSliceBorderColor', config.pieSliceBorderColor);
    }
    
    // Starting angle
    if (config.pieStartAngle !== undefined) {
      chartBuilder.setOption('pieStartAngle', config.pieStartAngle);
    }
    
    // 3D effect
    if (config.is3D) {
      chartBuilder.setOption('is3D', true);
    }
    
    // Hide small slices
    if (config.sliceVisibilityThreshold) {
      chartBuilder.setOption('sliceVisibilityThreshold', config.sliceVisibilityThreshold);
    }
    
    // Individual slice configuration
    if (config.slices) {
      chartBuilder.setOption('slices', config.slices);
    }
    
    Logger.log('[SheetActions_Chart] Pie options applied: hole=' + (config.pieHole || 0));
  }
  
  /**
   * Apply LINE chart specific options
   */
  function _applyLineChartOptions(chartBuilder, config, dataRange) {
    // Curve type
    var curveType = config.curveType || 'none';
    if (curveType === 'smooth' || curveType === 'curved' || curveType === 'spline') {
      curveType = 'function';
    }
    chartBuilder.setOption('curveType', curveType);
    
    // Line width
    var lineWidth = config.lineWidth !== undefined ? config.lineWidth : 2;
    chartBuilder.setOption('lineWidth', lineWidth);
    
    // Point size
    var pointSize = config.pointSize !== undefined ? config.pointSize : 5;
    chartBuilder.setOption('pointSize', pointSize);
    
    // Point shape
    if (config.pointShape) {
      chartBuilder.setOption('pointShape', config.pointShape);
    }
    
    // Handle null values
    if (config.interpolateNulls) {
      chartBuilder.setOption('interpolateNulls', true);
    }
    
    // Line dash style
    if (config.lineDashStyle) {
      var numSeries = config.dataColumns ? config.dataColumns.length : (dataRange.getNumColumns() - 1);
      var seriesConfig = {};
      for (var i = 0; i < numSeries; i++) {
        seriesConfig[i] = { lineDashStyle: config.lineDashStyle };
      }
      chartBuilder.setOption('series', seriesConfig);
    }
    
    // Focus target
    chartBuilder.setOption('focusTarget', config.focusTarget || 'datum');
    
    // Crosshair
    if (config.crosshair) {
      chartBuilder.setOption('crosshair', {
        trigger: 'both',
        orientation: 'both',
        color: '#cccccc',
        opacity: 0.7
      });
    }
    
    Logger.log('[SheetActions_Chart] Line options: curve=' + curveType + ', lineWidth=' + lineWidth);
  }
  
  /**
   * Apply AREA chart specific options
   */
  function _applyAreaChartOptions(chartBuilder, config) {
    // Area opacity
    var areaOpacity = config.areaOpacity !== undefined ? config.areaOpacity : 0.3;
    chartBuilder.setOption('areaOpacity', areaOpacity);
    
    // Stacked area
    if (config.stacked) {
      chartBuilder.setOption('isStacked', true);
    }
    if (config.stackedPercent) {
      chartBuilder.setOption('isStacked', 'percent');
    }
    
    // Line width
    var lineWidth = config.lineWidth !== undefined ? config.lineWidth : 2;
    chartBuilder.setOption('lineWidth', lineWidth);
    
    // Point size
    if (config.pointSize !== undefined) {
      chartBuilder.setOption('pointSize', config.pointSize);
    }
    
    chartBuilder.setOption('focusTarget', config.focusTarget || 'category');
    
    Logger.log('[SheetActions_Chart] Area options: opacity=' + areaOpacity);
  }
  
  /**
   * Apply SCATTER chart specific options
   */
  function _applyScatterChartOptions(chartBuilder, config) {
    // Point size
    var pointSize = config.pointSize !== undefined ? config.pointSize : 7;
    chartBuilder.setOption('pointSize', pointSize);
    
    // Point shape
    var pointShape = config.pointShape || 'circle';
    chartBuilder.setOption('pointShape', pointShape);
    
    // No lines
    chartBuilder.setOption('lineWidth', 0);
    
    // Trendlines
    if (config.trendlines || config.trendline) {
      var trendlineConfig = {};
      
      if (Array.isArray(config.trendlines)) {
        config.trendlines.forEach(function(tl, idx) {
          var seriesIndex = tl.series !== undefined ? tl.series : idx;
          trendlineConfig[seriesIndex] = {
            type: tl.type || 'linear',
            color: tl.color || SheetActions_Utils.DEFAULT_COLORS[seriesIndex % SheetActions_Utils.DEFAULT_COLORS.length],
            lineWidth: tl.lineWidth || 2,
            opacity: tl.opacity || 0.6,
            showR2: tl.showR2 || false,
            visibleInLegend: tl.visibleInLegend !== false,
            labelInLegend: tl.labelInLegend
          };
        });
      } else {
        trendlineConfig = {
          0: {
            type: config.trendlineType || 'linear',
            color: config.trendlineColor || '#888888',
            lineWidth: config.trendlineWidth || 2,
            opacity: config.trendlineOpacity || 0.5,
            showR2: config.showR2 || false,
            visibleInLegend: config.trendlineInLegend !== false
          }
        };
      }
      chartBuilder.setOption('trendlines', trendlineConfig);
    }
    
    // Aggregate duplicate points
    if (config.aggregationTarget) {
      chartBuilder.setOption('aggregationTarget', config.aggregationTarget);
    }
    
    // Crosshair
    if (config.crosshair !== false) {
      chartBuilder.setOption('crosshair', {
        trigger: 'both',
        orientation: 'both',
        color: '#dddddd',
        opacity: 0.5
      });
    }
    
    // CRITICAL: Tell chart to use first column (domain) as X-axis
    // Only needed when annotations or other options require explicit declaration
    
    // Point labels / annotations (e.g., company names on data points)
    if (config.annotationColumn || config.pointLabelsColumn) {
      chartBuilder.setOption('annotations', {
        textStyle: { 
          fontSize: config.annotationFontSize || 9,
          color: config.annotationColor || '#333333',
          auraColor: 'none'
        },
        stem: { 
          color: '#999999', 
          length: config.annotationStemLength !== undefined ? config.annotationStemLength : 5 
        },
        alwaysOutside: false
      });
      Logger.log('[SheetActions_Chart] Scatter annotations enabled for column: ' + (config.annotationColumn || config.pointLabelsColumn));
    }
    
    Logger.log('[SheetActions_Chart] Scatter options: pointSize=' + pointSize);
  }
  
  /**
   * Apply BAR/COLUMN chart specific options
   */
  function _applyBarColumnChartOptions(chartBuilder, config, chartType) {
    // Stacked
    if (config.stacked) {
      chartBuilder.setOption('isStacked', true);
    }
    if (config.stackedPercent) {
      chartBuilder.setOption('isStacked', 'percent');
    }
    
    // Bar width
    var barWidth = config.barGroupWidth || '75%';
    chartBuilder.setOption('bar', { groupWidth: barWidth });
    
    // Data labels
    if (config.showDataLabels) {
      chartBuilder.setOption('annotations', {
        alwaysOutside: true,
        textStyle: { 
          fontSize: 10,
          color: '#333333',
          auraColor: 'none'
        },
        stem: { color: 'transparent', length: 0 }
      });
    }
    
    chartBuilder.setOption('focusTarget', config.focusTarget || 'category');
    
    Logger.log('[SheetActions_Chart] ' + chartType + ' options: stacked=' + (config.stacked || false));
  }
  
  /**
   * Apply COMBO chart specific options (NEW)
   */
  function _applyComboChartOptions(chartBuilder, config) {
    // Series types for combo charts
    if (config.seriesTypes) {
      var seriesConfig = {};
      config.seriesTypes.forEach(function(type, idx) {
        seriesConfig[idx] = seriesConfig[idx] || {};
        seriesConfig[idx].type = type; // 'line', 'bars', 'area'
      });
      chartBuilder.setOption('series', seriesConfig);
    }
    
    chartBuilder.setOption('focusTarget', config.focusTarget || 'category');
    
    Logger.log('[SheetActions_Chart] Combo chart options applied');
  }
  
  /**
   * Apply dual axis support (NEW)
   */
  function _applyDualAxisOptions(chartBuilder, config) {
    var seriesConfig = {};
    config.secondaryAxis.forEach(function(seriesIndex) {
      seriesConfig[seriesIndex] = seriesConfig[seriesIndex] || {};
      seriesConfig[seriesIndex].targetAxisIndex = 1;
    });
    chartBuilder.setOption('series', seriesConfig);
    
    // Configure secondary axis
    chartBuilder.setOption('vAxes', {
      0: { title: config.yAxisTitle || '' },
      1: { title: config.secondaryAxisTitle || '' }
    });
    
    Logger.log('[SheetActions_Chart] Dual axis configured: secondary series=' + config.secondaryAxis.join(','));
  }
  
  /**
   * Apply AXIS options (common for bar, column, line, area, scatter)
   * 
   * IMPORTANT: In bar charts (horizontal), axes are SWAPPED:
   * - hAxis = value axis (numbers) ← receives yAxis* config
   * - vAxis = category axis (labels) ← receives xAxis* config
   * For all other chart types, hAxis = category, vAxis = value (standard).
   */
  function _applyAxisOptions(chartBuilder, config, dataRange) {
    var chartType = (config.chartType || '').toLowerCase();
    var isBarChart = (chartType === 'bar');
    
    var hasCategoryConfig = !!(config.xAxisTitle || config.xAxisFormat || 
      config.xAxisMin !== undefined || config.xAxisMax !== undefined || 
      config.xAxisLogScale || config.slantedTextAngle);
    
    var hasValueConfig = !!(config.yAxisTitle || config.yAxisFormat || config.valueFormat ||
      config.yAxisMin !== undefined || config.yAxisMax !== undefined ||
      config.logScale || config.yAxisLogScale || config.baseline !== undefined);
    
    if (!hasCategoryConfig && !hasValueConfig) {
      Logger.log('[SheetActions_Chart] No axis config provided — preserving auto-scale');
      return;
    }
    
    if (hasCategoryConfig) {
      var categoryAxisConfig = {};
      
      if (config.xAxisTitle) {
        categoryAxisConfig.title = config.xAxisTitle;
        categoryAxisConfig.titleTextStyle = { fontSize: 12, italic: true, color: '#333333' };
      }
      
      if (config.xAxisFormat) {
        categoryAxisConfig.format = config.xAxisFormat;
      }
      
      if (config.xAxisMin !== undefined) {
        categoryAxisConfig.minValue = config.xAxisMin;
      }
      if (config.xAxisMax !== undefined) {
        categoryAxisConfig.maxValue = config.xAxisMax;
      }
      
      if (config.xAxisLogScale) {
        categoryAxisConfig.logScale = true;
      }
      
      if (config.slantedTextAngle) {
        categoryAxisConfig.slantedText = true;
        categoryAxisConfig.slantedTextAngle = config.slantedTextAngle;
      }
      
      var categoryKey = isBarChart ? 'vAxis' : 'hAxis';
      chartBuilder.setOption(categoryKey, categoryAxisConfig);
      Logger.log('[SheetActions_Chart] Category axis (' + categoryKey + ') configured');
    }
    
    if (hasValueConfig) {
      var valueAxisConfig = {};
      
      if (config.yAxisTitle) {
        valueAxisConfig.title = config.yAxisTitle;
        valueAxisConfig.titleTextStyle = { fontSize: 12, italic: true, color: '#333333' };
      }
      
      if (config.yAxisFormat || config.valueFormat) {
        var fmt = config.yAxisFormat || config.valueFormat;
        if (fmt === 'currency') {
          valueAxisConfig.format = '$#,##0';
        } else if (fmt === 'percent') {
          valueAxisConfig.format = '0.0%';
        } else if (fmt === 'decimal') {
          valueAxisConfig.format = '#,##0.00';
        } else if (fmt === 'short') {
          valueAxisConfig.format = 'short';
        } else {
          valueAxisConfig.format = fmt;
        }
      }
      
      if (config.yAxisMin !== undefined) {
        valueAxisConfig.minValue = config.yAxisMin;
      }
      if (config.yAxisMax !== undefined) {
        valueAxisConfig.maxValue = config.yAxisMax;
      }
      
      if (config.logScale || config.yAxisLogScale) {
        valueAxisConfig.logScale = true;
      }
      
      if (config.baseline !== undefined) {
        valueAxisConfig.baseline = config.baseline;
      }
      
      var valueKey = isBarChart ? 'hAxis' : 'vAxis';
      chartBuilder.setOption(valueKey, valueAxisConfig);
      Logger.log('[SheetActions_Chart] Value axis (' + valueKey + ') configured');
    }
  }
  
  // ============================================
  // RANGE BUILDING
  // ============================================

  /**
   * Resolve chart ranges from AI-provided column config.
   * 
   * Returns either a single contiguous range (for adjacent columns with domain first)
   * or separate per-column ranges (for non-adjacent columns, requiring MERGE_COLUMNS).
   * 
   * For adjacent columns (e.g., domain=G, data=H), returns ["G1:H4"].
   * For non-adjacent columns (e.g., domain=A, data=D), returns ["A1:A4", "D1:D4"].
   * The domain column is always first.
   * 
   * @param {Sheet} sheet
   * @param {Object} config - AI chart config (domainColumn, dataColumns)
   * @param {Object} step - Step config (inputRange fallback)
   * @return {string[]} Array of A1-notation range strings (domain first)
   */
  function _resolveChartRanges(sheet, config, step) {
    var domainColumn = config.domainColumn || config.xAxisColumn || config.labelsColumn;
    var dataColumns = config.dataColumns;
    if (!dataColumns && config.valuesColumn) {
      dataColumns = [config.valuesColumn];
    }
    
    if (domainColumn && dataColumns && dataColumns.length > 0) {
      // Use DOMAIN column for row boundary detection.
      // In aggregation workflows (writeData + formula + chart), the formula step may
      // apply formulas beyond the writeData rows (returning 0/blank for rows without
      // domain values). Using the domain column ensures the chart only includes rows
      // with actual category labels.
      var domainColIdx = SheetActions_Utils.letterToColumn(domainColumn);
      var dataInfo = SheetActions_Utils.detectDataBoundaries(sheet, domainColIdx, domainColIdx);
      var startRow = dataInfo.startRow;
      var endRow = dataInfo.endRow;
      
      Logger.log('[SheetActions_Chart] Domain boundaries: rows ' + startRow + '-' + endRow);
      
      // Check if domain + all data columns are contiguous (adjacent).
      // If so, use a SINGLE contiguous range (e.g., "G1:H4") instead of
      // separate addRange calls. A single range lets Google Charts
      // auto-detect the text column as domain, avoiding phantom data series
      // that can occur with MERGE_COLUMNS + separate ranges.
      var allColumns = [domainColumn].concat(dataColumns);
      var colNumbers = allColumns.map(function(col) {
        return SheetActions_Utils.letterToColumn(col);
      });
      
      // Sort and check for gaps
      var sorted = colNumbers.slice().sort(function(a, b) { return a - b; });
      var isContiguous = true;
      for (var ci = 1; ci < sorted.length; ci++) {
        if (sorted[ci] !== sorted[ci - 1] + 1) {
          isContiguous = false;
          break;
        }
      }
      
      // Only use single range if domain is the leftmost column
      // (so useFirstColumnAsDomain works correctly)
      var domainIsFirst = (sorted[0] === domainColIdx);
      
      if (isContiguous && domainIsFirst) {
        // Single contiguous range — no MERGE_COLUMNS needed
        var firstCol = SheetActions_Utils.columnToLetter(sorted[0]);
        var lastCol = SheetActions_Utils.columnToLetter(sorted[sorted.length - 1]);
        var singleRange = firstCol + startRow + ':' + lastCol + endRow;
        Logger.log('[SheetActions_Chart] Contiguous columns → single range: ' + singleRange);
        return [singleRange];
      }
      
      // Non-adjacent or domain not first: separate per-column ranges with MERGE_COLUMNS
      var ranges = [domainColumn + startRow + ':' + domainColumn + endRow];
      for (var di = 0; di < dataColumns.length; di++) {
        ranges.push(dataColumns[di] + startRow + ':' + dataColumns[di] + endRow);
      }
      Logger.log('[SheetActions_Chart] Non-adjacent columns → ranges: ' + ranges.join(', '));
      return ranges;
    }
    
    // Fallback: use inputRange as a single range
    var rangeStr = config.dataRange || step.dataRange || step.inputRange;
    if (rangeStr) {
      Logger.log('[SheetActions_Chart] Fallback range: ' + rangeStr);
      return [rangeStr];
    }
    
    var detected = SheetActions_Utils.detectDataRange(sheet);
    Logger.log('[SheetActions_Chart] Detected range: ' + detected);
    return [detected];
  }
  
  // ============================================
  // PUBLIC API
  // ============================================
  
  return {
    createChart: createChart
  };
  
})();
