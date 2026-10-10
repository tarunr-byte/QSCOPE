import React, { useState } from 'react';

export default function TelemetryChart({
  data = [],
  values = null,
  dataKey = 'value',
  label = 'Signal',
  title = null,
  color = '#2563EB',
  secondaryData = null,
  secondaryKey = 'value',
  secondaryLabel = 'Reference',
  secondaryColor = '#64748B',
  threshold = null,
  thresholdLabel = 'Threshold',
  height = 180,
  unit = '',
  minVal = null,
  maxVal = null,
  min = null,
  max = null,
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const displayLabel = title || label;

  // Extract raw series array
  const seriesValues = values !== null 
    ? values 
    : (data || []).map((d) => (typeof d === 'number' ? d : d[dataKey] ?? 0));

  if (!seriesValues || seriesValues.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center bg-qarctic border border-dashed border-qborder text-qslate text-xs font-mono"
        style={{ height }}
      >
        Waiting for telemetry stream...
      </div>
    );
  }

  const secValues = secondaryData
    ? secondaryData.map((d) => (typeof d === 'number' ? d : d[secondaryKey] ?? 0))
    : [];

  const allVals = [...seriesValues, ...(secValues.length ? secValues : [])];
  if (threshold !== null) allVals.push(threshold);

  const effectiveMin = minVal !== null ? minVal : (min !== null ? min : Math.min(...allVals));
  const effectiveMax = maxVal !== null ? maxVal : (max !== null ? max : Math.max(...allVals));
  const range = effectiveMax - effectiveMin === 0 ? 1 : effectiveMax - effectiveMin;
  const padding = range * 0.08;
  const yMin = effectiveMin - padding;
  const yMax = effectiveMax + padding;
  const ySpan = yMax - yMin;

  const width = 600;
  const margin = { top: 12, right: 16, bottom: 24, left: 48 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const getX = (idx) => margin.left + (idx / Math.max(1, seriesValues.length - 1)) * innerW;
  const getY = (val) => margin.top + innerH - ((val - yMin) / ySpan) * innerH;

  const points = seriesValues.map((val, idx) => `${getX(idx).toFixed(1)},${getY(val).toFixed(1)}`).join(' ');
  const secPoints = secValues.length
    ? secValues.map((val, idx) => `${getX(idx).toFixed(1)},${getY(val).toFixed(1)}`).join(' ')
    : null;

  // Grid ticks
  const yTicks = [yMin, yMin + ySpan * 0.33, yMin + ySpan * 0.66, yMax];

  return (
    <div className="w-full relative select-none">
      <div className="flex items-center justify-between mb-1.5 px-1 font-mono text-xs">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-semibold text-qnavy tracking-wide uppercase">{displayLabel}</span>
          {hoverIndex !== null && seriesValues[hoverIndex] !== undefined && (
            <span className="text-[11px] font-semibold text-qblue bg-qarctic px-1.5 py-0.5 border border-qborder">
              #{hoverIndex}: {seriesValues[hoverIndex].toFixed(4)} {unit}
            </span>
          )}
        </div>
        {threshold !== null && (
          <span className="text-[10px] text-qred bg-qred-subtle px-1.5 py-0.5 border border-qred-border">
            {thresholdLabel}: {threshold.toFixed(4)}
          </span>
        )}
      </div>

      <div className="bg-qpure border border-qborder p-1 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            if (relX >= margin.left && relX <= width - margin.right) {
              const ratio = (relX - margin.left) / innerW;
              const idx = Math.min(seriesValues.length - 1, Math.max(0, Math.round(ratio * (seriesValues.length - 1))));
              setHoverIndex(idx);
            }
          }}
        >
          {/* Background Grid */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={margin.left}
                y1={getY(tick)}
                x2={width - margin.right}
                y2={getY(tick)}
                stroke="#EBF1F7"
                strokeWidth="1"
              />
              <text
                x={margin.left - 6}
                y={getY(tick) + 3}
                textAnchor="end"
                className="text-[9px] fill-qslate-light font-mono"
              >
                {tick.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Threshold reference line */}
          {threshold !== null && (
            <line
              x1={margin.left}
              y1={getY(threshold)}
              x2={width - margin.right}
              y2={getY(threshold)}
              stroke="#DC2626"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}

          {/* Secondary Line */}
          {secPoints && (
            <polyline
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1.5"
              strokeDasharray="3 3"
              points={secPoints}
              opacity="0.7"
            />
          )}

          {/* Main Line */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Hover indicator */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={margin.top}
                x2={getX(hoverIndex)}
                y2={height - margin.bottom}
                stroke="#94A3B8"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(seriesValues[hoverIndex])}
                r="4"
                fill={color}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X axis bottom border */}
          <line
            x1={margin.left}
            y1={height - margin.bottom}
            x2={width - margin.right}
            y2={height - margin.bottom}
            stroke="#DCE5F0"
            strokeWidth="1"
          />
          <text
            x={margin.left}
            y={height - 6}
            textAnchor="start"
            className="text-[9px] fill-qslate-light font-mono"
          >
            0
          </text>
          <text
            x={width - margin.right}
            y={height - 6}
            textAnchor="end"
            className="text-[9px] fill-qslate-light font-mono"
          >
            {seriesValues.length - 1} samples
          </text>
        </svg>
      </div>
    </div>
  );
}
