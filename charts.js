/* ==========================================================================
   Project Unified Finance: Custom SVG Charting Engine (Pie & Line Charts - Globals)
   ========================================================================== */

// Quiet Luxury Palette for Chart Slices & Lines
const CHART_PALETTE = [
  '#1E352F', // Deep Pine
  '#4A5D4E', // Sage/Olive
  '#8A9A86', // Light Sage
  '#6E6560', // Soft Earth
  '#A37B73', // Terracotta
  '#8B9B9C', // Soft Slate
  '#D4CBB5', // Warm Ochre
  '#A34843'  // Crimson Glow
];

/**
 * Generates an SVG Pie Chart inside a container as a Doughnut (outline cutout)
 * @param {HTMLElement} containerElement
 * @param {Array<{label: string, value: number}>} data
 * @param {string} activeSegment
 */
function renderPieChart(containerElement, data, activeSegment = 'expense') {
  containerElement.innerHTML = '';
  let textTotal = null;
  let labelTotal = null;
  let activePath = null;
  
  const filteredData = data.filter(d => d.value > 0);
  if (filteredData.length === 0) {
    containerElement.innerHTML = `
      <div style="color: var(--color-font-secondary); font-size: 11px; font-style: italic; text-align: center; padding-top: 40px;">
        No category breakdown data recorded.
      </div>`;
    return;
  }
  
  const total = filteredData.reduce((sum, d) => sum + d.value, 0);
  
  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 320');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.overflow = 'visible';

  const cx = 160;
  const cy = 160;
  const r = 135;
  let startAngle = 0;

  // Group paths
  const gCharts = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(gCharts);

  const DEFAULT_PALETTE = ['#1E352F', '#4A5D4E', '#8A9A86', '#6E6560', '#A37B73', '#8B9B9C', '#D4CBB5', '#A34843'];
  let palette = DEFAULT_PALETTE;
  if (activeSegment === 'income') {
    palette = ['#1E352F', '#2d6a4f', '#4e9f50', '#8A9A86', '#a2d2a4', '#bce3bd'];
  } else if (activeSegment === 'expense') {
    palette = ['#4a1c1c', '#a8201a', '#ff7d7d', '#A37B73', '#6E6560', '#8b6e60'];
  } else if (activeSegment === 'savings') {
    palette = ['#b38f2d', '#8c7333', '#D4CBB5', '#ffcc00', '#6E6560', '#b5a176'];
  } else if (activeSegment === 'avg-spent') {
    palette = ['#1f4068', '#2b4c7e', '#4A5D4E', '#8B9B9C', '#6E6560', '#D4CBB5'];
  }

  filteredData.forEach((item, index) => {
    const percentage = item.value / total;
    const angleSweep = percentage * 360;
    const endAngle = startAngle + angleSweep;
    const color = palette[index % palette.length];

    // Convert polar coordinates to Cartesian
    const rad = Math.PI / 180;
    const x1 = cx + r * Math.cos(startAngle * rad);
    const y1 = cy + r * Math.sin(startAngle * rad);
    const x2 = cx + r * Math.cos(endAngle * rad);
    const y2 = cy + r * Math.sin(endAngle * rad);

    const largeArcFlag = angleSweep > 180 ? 1 : 0;

    // Create path
    let dPath;
    if (angleSweep >= 360) {
      dPath = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    } else {
      dPath = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dPath);
    path.setAttribute('fill', color);
    path.setAttribute('stroke', 'var(--color-surface-card)');
    path.setAttribute('stroke-width', '1.5');
    path.style.transition = 'transform 0.2s ease, opacity 0.2s';
    path.style.cursor = 'pointer';
    path.style.transformOrigin = `${cx}px ${cy}px`;

    // Tooltip
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${item.label}: ${window.formatCurrency(item.value)} (${(percentage * 100).toFixed(1)}%)`;
    path.appendChild(title);

    path.addEventListener('mouseenter', () => {
      if (activePath) return; // Ignore hover if we have a locked selection
      path.style.transform = 'scale(1.05)';
      path.style.opacity = '0.9';
      
      // Update center text dynamically
      if (typeof textTotal !== 'undefined' && textTotal) {
        textTotal.textContent = window.formatCurrency(item.value);
      }
      if (typeof labelTotal !== 'undefined' && labelTotal) {
        labelTotal.textContent = `${item.label} (${(percentage * 100).toFixed(1)}%)`;
        labelTotal.setAttribute('fill', color);
      }
    });

    path.addEventListener('mouseleave', () => {
      if (activePath) return; // Ignore hover if we have a locked selection
      path.style.transform = 'scale(1)';
      path.style.opacity = '1';
      
      // Restore overall total
      if (typeof textTotal !== 'undefined' && textTotal) {
        textTotal.textContent = window.formatCurrency(total);
      }
      if (typeof labelTotal !== 'undefined' && labelTotal) {
        labelTotal.textContent = centerLabel;
        labelTotal.setAttribute('fill', 'var(--color-font-secondary)');
      }
    });

    path.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (activePath && activePath !== path) {
        activePath.style.transform = 'scale(1)';
        activePath.style.opacity = '1';
      }
      
      if (activePath === path) {
        // Toggle selection off
        path.style.transform = 'scale(1)';
        path.style.opacity = '1';
        activePath = null;
        
        // Restore overall total
        if (typeof textTotal !== 'undefined' && textTotal) {
          textTotal.textContent = window.formatCurrency(total);
        }
        if (typeof labelTotal !== 'undefined' && labelTotal) {
          labelTotal.textContent = centerLabel;
          labelTotal.setAttribute('fill', 'var(--color-font-secondary)');
        }
      } else {
        // Lock selection
        path.style.transform = 'scale(1.05)';
        path.style.opacity = '0.9';
        activePath = path;
        
        // Update center text
        if (typeof textTotal !== 'undefined' && textTotal) {
          textTotal.textContent = window.formatCurrency(item.value);
        }
        if (typeof labelTotal !== 'undefined' && labelTotal) {
          labelTotal.textContent = `${item.label} (${(percentage * 100).toFixed(1)}%)`;
          labelTotal.setAttribute('fill', color);
        }

        // Add global listener to clear selection when clicking anywhere off this slice
        setTimeout(() => {
          const dismissSelection = (evt) => {
            if (activePath && !activePath.contains(evt.target)) {
              activePath.style.transform = 'scale(1)';
              activePath.style.opacity = '1';
              activePath = null;
              if (textTotal) {
                textTotal.textContent = window.formatCurrency(total);
              }
              if (labelTotal) {
                labelTotal.textContent = centerLabel;
                labelTotal.setAttribute('fill', 'var(--color-font-secondary)');
              }
              document.removeEventListener('click', dismissSelection);
            }
          };
          document.addEventListener('click', dismissSelection);
        }, 0);
      }
    });

    gCharts.appendChild(path);
    startAngle = endAngle;
  });

  // Cutout circle for Doughnut effect
  const cutout = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  cutout.setAttribute('cx', cx);
  cutout.setAttribute('cy', cy);
  cutout.setAttribute('r', r * 0.70); // 70% cutout radius
  cutout.setAttribute('fill', 'var(--color-surface-card)');
  svg.appendChild(cutout);

  // Absolute total text inside the cutout
  textTotal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textTotal.setAttribute('x', cx);
  textTotal.setAttribute('y', cy - 2);
  textTotal.setAttribute('text-anchor', 'middle');
  textTotal.setAttribute('font-size', '24px');
  textTotal.setAttribute('font-weight', '700');
  textTotal.setAttribute('font-family', 'Inter, sans-serif');
  textTotal.setAttribute('fill', 'var(--color-font-primary)');
  textTotal.setAttribute('class', 'tabular-nums');
  textTotal.textContent = window.formatCurrency(total);
  svg.appendChild(textTotal);

  // Label inside cutout
  let centerLabel = 'Total Expenses';
  if (activeSegment === 'income') centerLabel = 'Total Income';
  else if (activeSegment === 'savings') centerLabel = 'Total Savings';
  else if (activeSegment === 'net') centerLabel = 'Net Balance';

  labelTotal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  labelTotal.setAttribute('x', cx);
  labelTotal.setAttribute('y', cy + 18);
  labelTotal.setAttribute('text-anchor', 'middle');
  labelTotal.setAttribute('font-size', '10px');
  labelTotal.setAttribute('font-weight', '600');
  labelTotal.setAttribute('font-family', 'Inter, sans-serif');
  labelTotal.setAttribute('fill', 'var(--color-font-secondary)');
  labelTotal.setAttribute('text-transform', 'uppercase');
  labelTotal.setAttribute('letter-spacing', '0.05em');
  labelTotal.textContent = centerLabel;
  svg.appendChild(labelTotal);

  containerElement.appendChild(svg);
}

/**
 * Generates/updates an SVG Line Chart inside a container representing history vs goals.
 * Reuses existing DOM nodes and uses CSS Transitions for smooth flowing animations.
 * @param {HTMLElement} containerElement
 * @param {Array<{label: string, actual: number, goal: number, rawMonthYear?: string}>} dataset
 * @param {Function} onMonthClick
 * @param {number|null} selectedMonthIndex
 * @param {string} activeSegment
 */
function renderLineChart(containerElement, dataset, onMonthClick = null, selectedMonthIndex = null, activeSegment = 'expense') {
  // Cold Start Exception Logic
  const isColdStart = !dataset || dataset.length === 0;
  const chartData = isColdStart ? [
    { label: "Month 1", actual: 0, goal: 0 },
    { label: "Month 2", actual: 0, goal: 0 },
    { label: "Month 3", actual: 0, goal: 0 },
    { label: "Month 4", actual: 0, goal: 0 }
  ] : dataset;

  const width = 540;
  const height = 260;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Helper to format Y-axis labels with professional minus sign placement (e.g. -$150)
  const formatYLabel = (val) => {
    const isNeg = val < 0;
    const absVal = Math.abs(val);
    const text = absVal >= 1000 ? `${(absVal / 1000).toFixed(1)}k` : `${absVal.toFixed(0)}`;
    return (isNeg ? '-' : '') + '$' + text;
  };

  // Find min and max value in dataset to scale Y Axis
  const rawMin = Math.min(...chartData.map(d => Math.min(d.actual || 0, d.goal || 0)), 0);
  const minVal = rawMin < 0 ? rawMin * 1.15 : 0; // 15% padding below min if negative

  const rawMax = Math.max(...chartData.map(d => Math.max(d.actual || 0, d.goal || 0)), 100);
  const maxVal = rawMax * 1.15; // 15% padding above max

  const range = maxVal - minVal;

  const scaleX = (index) => paddingLeft + (index / (chartData.length - 1)) * chartWidth;
  const scaleY = (val) => paddingTop + chartHeight - ((val - minVal) / range) * chartHeight;

  // Calculate segment colors
  let activeColor = 'var(--color-primary-accent)';
  if (activeSegment === 'income') activeColor = '#2d6a4f';
  else if (activeSegment === 'expense') activeColor = '#a8201a';
  else if (activeSegment === 'savings') activeColor = '#b38f2d';
  else if (activeSegment === 'avg-spent') activeColor = '#1f4068';
  else if (activeSegment === 'net') activeColor = 'var(--color-net-purple)';

  const getDotColor = (val) => {
    return activeColor;
  };

  const yZero = scaleY(0);
  const pctZero = Math.max(0, Math.min(100, ((yZero - paddingTop) / chartHeight) * 100));

  // Helper to update gradients definitions
  const updateGradients = (defsElement) => {
    defsElement.innerHTML = ''; // clear old gradients
    
    const strokeGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    strokeGrad.setAttribute('id', 'stroke-gradient');
    strokeGrad.setAttribute('x1', '0');
    strokeGrad.setAttribute('y1', '0');
    strokeGrad.setAttribute('x2', '0');
    strokeGrad.setAttribute('y2', '1');

    const fillGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    fillGrad.setAttribute('id', 'actual-gradient');
    fillGrad.setAttribute('x1', '0');
    fillGrad.setAttribute('y1', '0');
    fillGrad.setAttribute('x2', '0');
    fillGrad.setAttribute('y2', '1');

    // Standard solid color gradient (used for all now to keep Net tracker streamlined)
    const sStop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    sStop.setAttribute('offset', '0%');
    sStop.setAttribute('stop-color', activeColor);
    sStop.setAttribute('stop-opacity', '1.0');
    strokeGrad.appendChild(sStop);

    const fStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    fStop1.setAttribute('offset', '0%');
    fStop1.setAttribute('stop-color', activeColor);
    fStop1.setAttribute('stop-opacity', '0.30'); // Slightly more noticeable glow

    const fStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    fStop2.setAttribute('offset', '100%');
    fStop2.setAttribute('stop-color', activeColor);
    fStop2.setAttribute('stop-opacity', '0.00');

    fillGrad.appendChild(fStop1);
    fillGrad.appendChild(fStop2);

    defsElement.appendChild(strokeGrad);
    defsElement.appendChild(fillGrad);
  };

  // Calculate mathematical average for actual line, excluding null/undefined values
  const actualValues = chartData.map(d => d.actual).filter(v => v !== null && v !== undefined);
  const avgActual = actualValues.length > 0 ? (actualValues.reduce((a, b) => a + b, 0) / actualValues.length) : 0;
  const yAvg = scaleY(avgActual);

  // Check if we can reuse the existing SVG in the container
  const existingSvg = containerElement.querySelector('svg');
  const canReuse = existingSvg && 
                    !isColdStart && 
                    existingSvg.getAttribute('data-points') === String(chartData.length);

  if (canReuse) {
    // ------------------- REUSE PATHWAY (SMOOTH TRANSITIONS) -------------------
    existingSvg.setAttribute('data-max', maxVal);

    // Update Gradients dynamically
    const defs = existingSvg.querySelector('defs');
    if (defs) updateGradients(defs);

    // 1. Update Grid Line Labels & Positions
    const gridCount = 4;
    const yAxisLabels = existingSvg.querySelectorAll('.y-axis-label');
    yAxisLabels.forEach((label, i) => {
      const gridVal = minVal + (range / gridCount) * i;
      label.textContent = formatYLabel(gridVal);
    });

    const gridLines = existingSvg.querySelectorAll('.chart-grid-line');
    gridLines.forEach((line, i) => {
      const gridVal = minVal + (range / gridCount) * i;
      const y = scaleY(gridVal);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
    });

    // 2. Update Zero Baseline Line
    const zeroLine = existingSvg.querySelector('.chart-line-zero');
    if (zeroLine) {
      zeroLine.setAttribute('y1', yZero);
      zeroLine.setAttribute('y2', yZero);
      zeroLine.setAttribute('opacity', minVal < 0 ? '1' : '0');
    }

    // 3. Update Average Line & Text
    const avgLine = existingSvg.querySelector('.chart-line-avg');
    const avgText = existingSvg.querySelector('.chart-text-avg');
    if (avgLine && avgText) {
      if (avgActual !== 0) {
        avgLine.setAttribute('y1', yAvg);
        avgLine.setAttribute('y2', yAvg);
        avgLine.setAttribute('stroke', 'var(--color-alert)'); // Crimson Glow
        avgLine.setAttribute('opacity', '1');
        avgText.setAttribute('y', yAvg - 4);
        avgText.textContent = `Avg: $${avgActual.toFixed(0)}`;
        avgText.setAttribute('opacity', '1');
      } else {
        avgLine.setAttribute('opacity', '0');
        avgText.setAttribute('opacity', '0');
      }
    }

    // 4. Update Goal Path
    let dGoalPath = '';
    chartData.forEach((d, i) => {
      const x = scaleX(i);
      const y = scaleY(d.goal || 0);
      dGoalPath += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
    });
    const hasGoals = chartData.some(d => (d.goal || 0) > 0);
    const goalPath = existingSvg.querySelector('.chart-line-goal');
    if (goalPath) {
      goalPath.setAttribute('d', dGoalPath);
      goalPath.setAttribute('opacity', hasGoals ? '0.75' : '0');
    }

    // 5. Update Actual Path
    let dActualPath = '';
    chartData.forEach((d, i) => {
      if (d.actual !== null && d.actual !== undefined) {
        const x = scaleX(i);
        const y = scaleY(d.actual);
        dActualPath += (dActualPath === '' ? 'M' : 'L') + ` ${x} ${y}`;
      }
    });
    const actualPath = existingSvg.querySelector('.chart-line-actual');
    if (actualPath) {
      actualPath.setAttribute('d', dActualPath);
      actualPath.setAttribute('stroke', 'url(#stroke-gradient)');
    }

    // Update Area Path
    let dAreaPath = '';
    if (dActualPath !== '') {
      const validIndices = [];
      chartData.forEach((d, idx) => {
        if (d.actual !== null && d.actual !== undefined) validIndices.push(idx);
      });
      if (validIndices.length > 0) {
        const firstIdx = validIndices[0];
        const lastIdx = validIndices[validIndices.length - 1];
        dAreaPath = dActualPath + ` L ${scaleX(lastIdx)} ${height - paddingBottom} L ${scaleX(firstIdx)} ${height - paddingBottom} Z`;
      }
    }
    const areaPath = existingSvg.querySelector('.chart-area-fill');
    if (areaPath) areaPath.setAttribute('d', dAreaPath);

    // 6. Update Guideline
    const guideLine = existingSvg.querySelector('.chart-guideline');
    if (guideLine) {
      if (selectedMonthIndex !== null && selectedMonthIndex >= 0 && selectedMonthIndex < chartData.length) {
        const x = scaleX(selectedMonthIndex);
        guideLine.setAttribute('x1', x);
        guideLine.setAttribute('x2', x);
        guideLine.setAttribute('opacity', '0.4');
      } else {
        guideLine.setAttribute('opacity', '0');
      }
    }

    // 7. Update Dots (cx, cy, callbacks, tooltips) using catcher groups
    const groups = existingSvg.querySelectorAll('.chart-dot-group');
    groups.forEach((group, i) => {
      const d = chartData[i];
      if (d.actual === null || d.actual === undefined) {
        group.style.display = 'none';
        return;
      }
      group.style.display = '';

      const x = scaleX(i);
      const y = scaleY(d.actual);

      const circle = group.querySelector('.chart-dot');
      const catcher = group.querySelector('.chart-dot-catcher');

      if (circle) {
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);

        // Visual feedback: make the selected dot stand out
        if (selectedMonthIndex === i) {
          circle.setAttribute('r', '7');
          circle.setAttribute('fill', 'var(--color-secondary-accent)');
        } else {
          circle.setAttribute('r', '5');
          circle.setAttribute('fill', getDotColor(d.actual));
        }
      }

      if (catcher) {
        catcher.setAttribute('cx', x);
        catcher.setAttribute('cy', y);

        const title = catcher.querySelector('title');
        if (title) {
          title.textContent = `${d.label} - Actual: ${window.formatCurrency(d.actual)} (Goal: ${window.formatCurrency(d.goal)})`;
        }

        // Re-bind click and hover handlers on catcher to scale the visible dot stably
        catcher.onclick = (e) => {
          e.stopPropagation();
          if (onMonthClick) onMonthClick(d, i);
        };

        catcher.onmouseenter = () => {
          if (circle) circle.setAttribute('r', selectedMonthIndex === i ? '9' : '8');
        };

        catcher.onmouseleave = () => {
          if (circle) circle.setAttribute('r', selectedMonthIndex === i ? '7' : '5');
        };
      }
    });

    // 8. Update X Axis labels text
    const xAxisLabels = existingSvg.querySelectorAll('.x-axis-label');
    xAxisLabels.forEach((label, i) => {
      const d = chartData[i];
      label.textContent = d.label;
      
      // Visual feedback for selected text
      if (selectedMonthIndex === i) {
        label.setAttribute('fill', 'var(--color-primary-accent)');
        label.setAttribute('font-weight', '700');
      } else {
        label.setAttribute('fill', 'var(--color-font-secondary)');
        label.setAttribute('font-weight', '500');
      }

      label.onclick = (e) => {
        e.stopPropagation();
        if (onMonthClick) onMonthClick(d, i);
      };
    });

    return;
  }

  // ------------------- INITIALIZE/RECREATE PATHWAY -------------------
  containerElement.innerHTML = '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('data-points', chartData.length);
  svg.setAttribute('data-max', maxVal);
  svg.style.overflow = 'visible';

  // Add Gradients / Definitions
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  updateGradients(defs);
  svg.appendChild(defs);

  // 1. Render Grid Lines & Y Axis Labels
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const gridVal = minVal + (range / gridCount) * i;
    const y = scaleY(gridVal);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'chart-grid-line');
    line.setAttribute('x1', paddingLeft);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width - paddingRight);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'var(--color-border)');
    line.setAttribute('stroke-width', '1');
    if (i > 0) line.setAttribute('stroke-dasharray', '2,4');
    svg.appendChild(line);

    // Y Axis Text
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', paddingLeft - 8);
    label.setAttribute('y', y + 3);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '9px');
    label.setAttribute('font-family', 'Inter, sans-serif');
    label.setAttribute('fill', 'var(--color-font-secondary)');
    label.setAttribute('class', 'y-axis-label tabular-nums');
    label.textContent = formatYLabel(gridVal);
    svg.appendChild(label);
  }

  // 2. Render X Axis labels
  chartData.forEach((d, i) => {
    const x = scaleX(i);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', height - paddingBottom + 18);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '9px');
    label.setAttribute('font-family', 'Inter, sans-serif');
    label.style.cursor = 'pointer';
    label.setAttribute('class', 'x-axis-label');
    label.textContent = d.label;

    if (selectedMonthIndex === i) {
      label.setAttribute('fill', 'var(--color-primary-accent)');
      label.setAttribute('font-weight', '700');
    } else {
      label.setAttribute('fill', 'var(--color-font-secondary)');
      label.setAttribute('font-weight', '500');
    }
    
    label.onclick = (e) => {
      e.stopPropagation();
      if (onMonthClick) onMonthClick(d, i);
    };

    svg.appendChild(label);
  });

  // 3. Render Zero Baseline Line (Always created, visible when minVal < 0)
  const zeroLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  zeroLine.setAttribute('class', 'chart-line-zero');
  zeroLine.setAttribute('x1', paddingLeft);
  zeroLine.setAttribute('y1', yZero);
  zeroLine.setAttribute('x2', width - paddingRight);
  zeroLine.setAttribute('y2', yZero);
  zeroLine.setAttribute('stroke', 'var(--color-font-secondary)');
  zeroLine.setAttribute('stroke-width', '1.5');
  zeroLine.setAttribute('opacity', minVal < 0 ? '1' : '0');
  svg.appendChild(zeroLine);

  // 4. Render Vertical Guideline (Dashed line)
  const guideLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  guideLine.setAttribute('class', 'chart-guideline');
  guideLine.setAttribute('y1', paddingTop);
  guideLine.setAttribute('y2', height - paddingBottom);
  guideLine.setAttribute('stroke', 'var(--color-secondary-accent)');
  guideLine.setAttribute('stroke-width', '1');
  guideLine.setAttribute('stroke-dasharray', '3,3');
  
  if (selectedMonthIndex !== null && selectedMonthIndex >= 0 && selectedMonthIndex < chartData.length) {
    const x = scaleX(selectedMonthIndex);
    guideLine.setAttribute('x1', x);
    guideLine.setAttribute('x2', x);
    guideLine.setAttribute('opacity', '0.4');
  } else {
    guideLine.setAttribute('opacity', '0');
  }
  svg.appendChild(guideLine);

  // 5. Render Average horizontal overlay line (dotted)
  const avgLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  avgLine.setAttribute('class', 'chart-line-avg');
  avgLine.setAttribute('x1', paddingLeft);
  avgLine.setAttribute('x2', width - paddingRight);
  
  const avgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  avgText.setAttribute('class', 'chart-text-avg');
  avgText.setAttribute('x', width - paddingRight - 4);
  avgText.setAttribute('text-anchor', 'end');
  avgText.setAttribute('font-size', '8px');
  avgText.setAttribute('font-family', 'Inter, sans-serif');
  avgText.setAttribute('fill', 'var(--color-alert)');

  if (!isColdStart && avgActual !== 0) {
    avgLine.setAttribute('y1', yAvg);
    avgLine.setAttribute('y2', yAvg);
    avgLine.setAttribute('stroke', 'var(--color-alert)');
    avgLine.setAttribute('stroke-width', '1.2');
    avgLine.setAttribute('stroke-dasharray', '3,3');
    avgLine.setAttribute('opacity', '1');

    avgText.setAttribute('y', yAvg - 4);
    avgText.textContent = `Avg: $${avgActual.toFixed(0)}`;
    avgText.setAttribute('opacity', '1');
  } else {
    avgLine.setAttribute('opacity', '0');
    avgText.setAttribute('opacity', '0');
  }
  svg.appendChild(avgLine);
  svg.appendChild(avgText);

  // 6. Draw Goal Line (Dashed Sage/Olive)
  let dGoalPath = '';
  chartData.forEach((d, i) => {
    const x = scaleX(i);
    const y = scaleY(d.goal || 0);
    dGoalPath += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
  });

  const hasGoals = chartData.some(d => (d.goal || 0) > 0);
  const goalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  goalPath.setAttribute('class', 'chart-line-goal');
  goalPath.setAttribute('d', dGoalPath);
  goalPath.setAttribute('fill', 'none');
  goalPath.setAttribute('stroke', 'var(--color-secondary-accent)');
  goalPath.setAttribute('stroke-width', '1.5');
  goalPath.setAttribute('stroke-dasharray', '5,5');
  goalPath.setAttribute('opacity', hasGoals ? '0.75' : '0');
  svg.appendChild(goalPath);

  // 7. Draw Gradient Area Fill under Actual Line
  let dActualPath = '';
  chartData.forEach((d, i) => {
    if (d.actual !== null && d.actual !== undefined) {
      const x = scaleX(i);
      const y = scaleY(d.actual);
      dActualPath += (dActualPath === '' ? 'M' : 'L') + ` ${x} ${y}`;
    }
  });

  let dAreaPath = '';
  if (dActualPath !== '') {
    const validIndices = [];
    chartData.forEach((d, idx) => {
      if (d.actual !== null && d.actual !== undefined) validIndices.push(idx);
    });
    if (validIndices.length > 0) {
      const firstIdx = validIndices[0];
      const lastIdx = validIndices[validIndices.length - 1];
      dAreaPath = dActualPath + ` L ${scaleX(lastIdx)} ${height - paddingBottom} L ${scaleX(firstIdx)} ${height - paddingBottom} Z`;
    }
  }
  const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  areaPath.setAttribute('class', 'chart-area-fill');
  areaPath.setAttribute('d', dAreaPath);
  areaPath.setAttribute('fill', 'url(#actual-gradient)');
  svg.appendChild(areaPath);

  // 8. Draw Actual Line (Solid Deep Pine)
  const actualPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  actualPath.setAttribute('class', 'chart-line-actual');
  actualPath.setAttribute('d', dActualPath);
  actualPath.setAttribute('fill', 'none');
  actualPath.setAttribute('stroke', 'url(#stroke-gradient)');
  actualPath.setAttribute('stroke-width', '3');
  actualPath.setAttribute('stroke-linecap', 'round');
  actualPath.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(actualPath);

  // 9. Draw Dots on Hover for Actual Points (using group with invisible catcher)
  chartData.forEach((d, i) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'chart-dot-group');
    group.style.cursor = 'pointer';

    const hasNoData = d.actual === null || d.actual === undefined;
    group.style.display = hasNoData ? 'none' : '';

    const x = scaleX(i);
    const y = scaleY(hasNoData ? 0 : d.actual);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('class', 'chart-dot');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    
    if (selectedMonthIndex === i) {
      circle.setAttribute('r', '7');
      circle.setAttribute('fill', 'var(--color-secondary-accent)');
    } else {
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', getDotColor(hasNoData ? 0 : d.actual));
    }
    
    circle.setAttribute('stroke', 'var(--color-base-canvas)');
    circle.setAttribute('stroke-width', '2');
    circle.style.transition = 'r 0.15s ease, cx 0.4s var(--transition-glide), cy 0.4s var(--transition-glide)';
    group.appendChild(circle);

    // Large invisible hover & click target
    const catcher = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    catcher.setAttribute('class', 'chart-dot-catcher');
    catcher.setAttribute('cx', x);
    catcher.setAttribute('cy', y);
    catcher.setAttribute('r', '15');
    catcher.setAttribute('fill', 'transparent');
    catcher.setAttribute('opacity', '0');
    catcher.style.cursor = 'pointer';

    // Tooltip on catcher
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${d.label} - Actual: ${window.formatCurrency(hasNoData ? 0 : d.actual)} (Goal: ${window.formatCurrency(d.goal)})`;
    catcher.appendChild(title);

    catcher.onclick = (e) => {
      e.stopPropagation();
      if (onMonthClick) onMonthClick(d, i);
    };

    catcher.addEventListener('mouseenter', () => {
      circle.setAttribute('r', selectedMonthIndex === i ? '9' : '8');
    });

    catcher.addEventListener('mouseleave', () => {
      circle.setAttribute('r', selectedMonthIndex === i ? '7' : '5');
    });

    group.appendChild(catcher);
    svg.appendChild(group);
  });

  // Cold Start watermark
  if (isColdStart) {
    const watermark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    watermark.setAttribute('x', paddingLeft + chartWidth / 2);
    watermark.setAttribute('y', paddingTop + chartHeight / 2 + 5);
    watermark.setAttribute('text-anchor', 'middle');
    watermark.setAttribute('font-size', '10px');
    watermark.setAttribute('font-weight', '500');
    watermark.setAttribute('font-family', 'Inter, sans-serif');
    watermark.setAttribute('fill', 'var(--color-alert)');
    watermark.setAttribute('opacity', '0.85');
    watermark.textContent = "Cold Start: No history parsed. Defaulting to empty nodes.";
    svg.appendChild(watermark);
  }

  containerElement.appendChild(svg);
}

// Expose functions globally
window.renderPieChart = renderPieChart;
window.renderLineChart = renderLineChart;
