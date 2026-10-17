import { useId, useState } from "react";
import { number } from "../api";
type Point = { date: string; value: number };
export function TrendChart({
  points,
  label,
}: {
  points: Point[];
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null),
    [table, setTable] = useState(false);
  const fillId = useId();
  const activePoint = active === null ? null : points[active];
  const width = 900,
    height = 220,
    gutter = 25,
    max = Math.max(2, ...points.map((point) => point.value));
  const x = (i: number) =>
    gutter + (i * (width - gutter * 2)) / Math.max(1, points.length - 1);
  const y = (value: number) =>
    height - gutter - (value / max) * (height - gutter * 2);
  const d = points
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`)
    .join(" ");
  return (
    <div className="trend-chart">
      <div className="chart-legend">
        <span>
          <i />
          {label}
        </span>
        <span className="chart-value" aria-live="polite">
          {!activePoint
            ? `${number(points.reduce((sum, point) => sum + point.value, 0))} in period`
            : `${activePoint.date} · ${number(activePoint.value)}`}
        </span>
        <button className="inline-button" onClick={() => setTable(!table)}>
          {table ? "Show chart" : "View data"}
        </button>
      </div>
      {table ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>{label}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{number(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label={`${label} by day. Use View data for a table.`}
          >
            {[0, 0.5, 1].map((value) => (
              <g key={value}>
                <path
                  d={`M${gutter} ${y(max * value)}H${width - gutter}`}
                  stroke="var(--line)"
                  strokeDasharray="3 7"
                />
                <text
                  x={width - gutter}
                  y={y(max * value) - 7}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize="10"
                >
                  {number(max * value)}
                </text>
              </g>
            ))}
            {points.length > 0 && (
              <>
                <path
                  d={`${d}L${x(points.length - 1)},${height - gutter}L${x(0)},${height - gutter}Z`}
                  fill={`url(#${fillId})`}
                />
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#bfd4cd" stopOpacity=".13" />
                    <stop offset="1" stopColor="#bfd4cd" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={d}
                  stroke="var(--accent)"
                  strokeWidth="2"
                  fill="none"
                />
                {points.map((point, index) => (
                  <g key={point.date}>
                    <circle
                      cx={x(index)}
                      cy={y(point.value)}
                      r={active === index ? 5 : 3}
                      fill="var(--accent)"
                    />
                    <circle
                      cx={x(index)}
                      cy={y(point.value)}
                      r="15"
                      fill="transparent"
                      tabIndex={0}
                      role="button"
                      aria-label={`${point.date}: ${number(point.value)} ${label}`}
                      onMouseEnter={() => setActive(index)}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                      onClick={() => setActive(index)}
                      onKeyDown={(event) => {
                        const next =
                          event.key === "ArrowRight"
                            ? Math.min(points.length - 1, index + 1)
                            : event.key === "ArrowLeft"
                              ? Math.max(0, index - 1)
                              : event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? points.length - 1
                                  : null;
                        if (next !== null) {
                          event.preventDefault();
                          event.currentTarget.ownerSVGElement
                            ?.querySelectorAll<SVGCircleElement>(
                              'circle[role="button"]',
                            )
                            [next]?.focus();
                        } else if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActive(index);
                        }
                      }}
                    />
                  </g>
                ))}
              </>
            )}
          </svg>
          <div className="chart-axis">
            <span>{points[0]?.date}</span>
            <span>{points.at(-1)?.date}</span>
          </div>
        </>
      )}
    </div>
  );
}
export function Breakdown({
  rows,
  label,
}: {
  rows: { name: string; value: number }[];
  label: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return rows.length ? (
    <div className="breakdown" aria-label={label}>
      {rows.map((row) => (
        <div className="breakdown-row" key={row.name}>
          <div>
            <span>{row.name || "Direct / unknown"}</span>
            <strong>{number(row.value)}</strong>
          </div>
          <span className="bar">
            <i style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  ) : (
    <p className="quiet-empty">No recorded data in this period.</p>
  );
}
