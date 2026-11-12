import { formatDate, t } from "@/lib/texts.sk";

export type TrendChartPoint = {
  label: string;
  date: string;
  /** Null = no value for this round (below the threshold or no fixed question). */
  value: number | null;
};

// Geometry in SVG user units; the chart scales to the width of its container.
const WIDTH = 360;
const HEIGHT = 220;
const PAD = { top: 22, right: 16, bottom: 30, left: 26 };
const MIN = 1;
const MAX = 5;

/**
 * One series over time: the team's score on the fixed question per closed
 * round (IT-08). A single series needs no legend; the heading names it. A
 * round without a value breaks the line instead of being interpolated, so a
 * gap never looks like a measurement. The table under the chart carries the
 * same numbers for everyone who cannot or does not want to read a chart.
 */
export function TrendChart({ points, title }: { points: TrendChartPoint[]; title: string }) {
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + ((MAX - value) / (MAX - MIN)) * plotHeight;

  // Consecutive rounds with a value form one segment; a gap starts a new one.
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ index, value: point.value });
    }
  });
  if (current.length) segments.push(current);

  const number = (value: number) =>
    value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  // Label only the last measured point; every value is in the table below.
  const lastMeasured = segments.at(-1)?.at(-1);

  return (
    <figure className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={title}
        className="h-auto w-full max-w-xl"
      >
        {/* Recessive grid: one line per scale point. */}
        {[1, 2, 3, 4, 5].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-slate-200"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-500 text-[14px]"
            >
              {tick}
            </text>
          </g>
        ))}

        {segments.map((segment, index) => (
          <polyline
            key={index}
            fill="none"
            className="stroke-teal-700"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={segment.map((item) => `${x(item.index)},${y(item.value)}`).join(" ")}
          />
        ))}

        {points.map((point, index) => (
          <g key={index}>
            {point.value !== null ? (
              <>
                {/* White ring keeps the marker readable where it sits on the line. */}
                <circle cx={x(index)} cy={y(point.value)} r={5} className="fill-teal-700 stroke-white" strokeWidth={2} />
                {/* Larger invisible target carrying the tooltip. */}
                <circle cx={x(index)} cy={y(point.value)} r={14} fill="transparent">
                  <title>{`${point.label} (${formatDate(point.date)}): ${number(point.value)}`}</title>
                </circle>
              </>
            ) : (
              <g>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={PAD.top}
                  y2={HEIGHT - PAD.bottom}
                  className="stroke-slate-300"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
                <rect x={x(index) - 14} y={PAD.top} width={28} height={plotHeight} fill="transparent">
                  <title>{`${point.label} (${formatDate(point.date)}): ${t.trend.noValue}`}</title>
                </rect>
              </g>
            )}
            {(index === 0 || index === points.length - 1) && (
            <text
              x={x(index)}
              y={HEIGHT - PAD.bottom + 18}
              textAnchor={index === 0 && points.length > 1 ? "start" : index === points.length - 1 && points.length > 1 ? "end" : "middle"}
              className="fill-slate-500 text-[14px]"
            >
              {formatDate(point.date)}
            </text>
            )}
          </g>
        ))}

        {lastMeasured && (
          <text
            x={x(lastMeasured.index)}
            y={y(lastMeasured.value) - 12}
            textAnchor={lastMeasured.index === points.length - 1 && points.length > 1 ? "end" : "middle"}
            className="fill-slate-900 text-[15px] font-semibold"
          >
            {number(lastMeasured.value)}
          </text>
        )}
      </svg>
      <figcaption className="mt-2 text-xs text-slate-600">{t.trend.chartCaption}</figcaption>
    </figure>
  );
}
