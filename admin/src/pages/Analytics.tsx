import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { dateRange, number } from "../api";
import { useResource } from "../hooks";
import type { AnalyticsData } from "../types";
import { Breakdown, TrendChart } from "../components/Charts";
import {
  ErrorNotice,
  Loading,
  Notice,
  PageHeading,
  Panel,
} from "../components/UI";

export function RangeControls({
  start,
  end,
  setRange,
  compare,
  setCompare,
  maxDays = 90,
}: {
  start: string;
  end: string;
  setRange: (range: { start: string; end: string }) => void;
  compare?: boolean;
  setCompare?: (value: boolean) => void;
  maxDays?: number;
}) {
  const [from, setFrom] = useState(start),
    [through, setThrough] = useState(
      new Date(Date.parse(end) - 86400000).toISOString().slice(0, 10),
    );
  return (
    <form
      className="range-controls"
      onSubmit={(event) => {
        event.preventDefault();
        const until = new Date(`${through}T00:00:00Z`);
        if (Number.isFinite(until.valueOf()))
          setRange({
            start: from,
            end: new Date(until.valueOf() + 86400000)
              .toISOString()
              .slice(0, 10),
          });
      }}
    >
      <div className="presets">
        {[1, 7, 30, 90]
          .filter((days) => days <= maxDays)
          .map((days) => (
            <button
              type="button"
              key={days}
              onClick={() => {
                const range = dateRange(days);
                setFrom(range.start);
                setThrough(
                  new Date(Date.parse(range.end) - 86400000)
                    .toISOString()
                    .slice(0, 10),
                );
                setRange(range);
              }}
            >
              {days === 1 ? "Today" : `${days} days`}
            </button>
          ))}
      </div>
      <label>
        From
        <input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          required
        />
      </label>
      <label>
        Through
        <input
          type="date"
          value={through}
          onChange={(event) => setThrough(event.target.value)}
          required
        />
      </label>
      <button className="button ghost" type="submit">
        Apply
      </button>
      {setCompare && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={compare}
            onChange={(event) => setCompare(event.target.checked)}
          />
          Compare previous period
        </label>
      )}
      <span className="range-note">UTC dates</span>
    </form>
  );
}
export function Metrics({ data }: { data: AnalyticsData }) {
  const total = data.rum.totals[0],
    visits = total?.sum.visits ?? 0,
    views = total?.count ?? 0;
  const change = (current: number, previous: number | undefined) =>
    previous === undefined
      ? ""
      : previous === 0
        ? current
          ? "No previous activity"
          : "No change"
        : `${current >= previous ? "+" : ""}${Math.round(((current - previous) / previous) * 100)}% vs previous period`;
  return (
    <div className="metrics">
      <div className="metric">
        <span>Browser page views</span>
        <strong>{number(views)}</strong>
        <small>
          {change(views, data.previous?.pageViews)}
          <span>Cloudflare Web Analytics</span>
        </small>
      </div>
      <div className="metric">
        <span>Visits</span>
        <strong>{number(visits)}</strong>
        <small>
          {change(visits, data.previous?.visits)}
          <span>External-referrer arrivals</span>
        </small>
      </div>
      <div className="metric">
        <span>HTTP requests</span>
        <strong>
          {number(data.edge.reduce((sum, row) => sum + row.sum.requests, 0))}
        </strong>
        <small>All zone traffic, including bots & assets</small>
      </div>
      <div className="metric">
        <span>Unique people</span>
        <strong className="unavailable-value">Unavailable</strong>
        <small>No visitor identifiers are collected</small>
      </div>
    </div>
  );
}
export default function Analytics() {
  const [range, setRange] = useState(dateRange(7)),
    [compare, setCompare] = useState(false),
    [metric, setMetric] = useState("pageviews");
  const resource = useResource<AnalyticsData>(
    `/analytics?start=${range.start}&end=${range.end}&compare=${compare}`,
  );
  const data = resource.data;
  const points = data
    ? metric === "requests"
      ? data.edge.map((row) => ({
          date: row.dimensions.date,
          value: row.sum.requests,
        }))
      : data.rum.daily.map((row) => ({
          date: String(row.dimensions?.date ?? ""),
          value: metric === "visits" ? row.sum.visits : row.count,
        }))
    : [];
  const breakdown = (rows: AnalyticsData["rum"]["pages"], key: string) =>
    rows.map((row) => ({
      name: String(row.dimensions?.[key] ?? ""),
      value: row.count,
    }));
  const statuses = new Map<string, number>();
  data?.edge.forEach((row) =>
    row.sum.responseStatusMap.forEach((status) =>
      statuses.set(
        String(status.edgeResponseStatus),
        (statuses.get(String(status.edgeResponseStatus)) ?? 0) +
          status.requests,
      ),
    ),
  );
  return (
    <>
      <PageHeading
        eyebrow="OBSERVABILITY / ANALYTICS"
        title="The view from here."
        description="Browser activity and edge traffic, each measured on its own terms."
        action={
          <button className="button ghost" onClick={resource.refresh}>
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />
      <RangeControls
        {...range}
        setRange={setRange}
        compare={compare}
        setCompare={setCompare}
      />
      {resource.error && (
        <ErrorNotice message={resource.error} onRetry={resource.refresh} />
      )}{" "}
      {resource.loading && <Loading text="Querying Cloudflare analytics…" />}
      {data && (
        <>
          <Metrics data={data} />
          <Panel
            title="Traffic over time"
            description="Real observations from the selected period. Missing rows indicate no recorded events."
            action={
              <select
                aria-label="Chart metric"
                value={metric}
                onChange={(event) => setMetric(event.target.value)}
              >
                <option value="pageviews">Browser page views</option>
                <option value="visits">Visits</option>
                <option value="requests">HTTP requests</option>
              </select>
            }
          >
            <TrendChart
              points={points}
              label={
                metric === "requests"
                  ? "HTTP requests"
                  : metric === "visits"
                    ? "Visits"
                    : "Browser page views"
              }
            />
          </Panel>
          <div className="panel-grid">
            <Panel
              title="Popular pages"
              description="Top 30 paths · browser page views"
            >
              <Breakdown
                rows={breakdown(data.rum.pages, "requestPath")}
                label="Popular pages"
              />
            </Panel>
            <Panel
              title="Blog readership"
              description="Blog paths among the top 30 recorded pages"
            >
              <Breakdown
                rows={breakdown(
                  data.rum.pages.filter((row) =>
                    String(row.dimensions?.requestPath).startsWith("/blog"),
                  ),
                  "requestPath",
                )}
                label="Blog readership"
              />
            </Panel>
            <Panel
              title="Referrers"
              description="Page views grouped by referring host"
            >
              <Breakdown
                rows={breakdown(data.rum.referrers, "refererHost")}
                label="Referrers"
              />
            </Panel>
            <Panel
              title="Geography"
              description="Country codes from browser telemetry"
            >
              <Breakdown
                rows={breakdown(data.rum.countries, "countryName")}
                label="Countries"
              />
            </Panel>
            <Panel
              title="Browsers"
              description="Browser families reported by the beacon"
            >
              <Breakdown
                rows={breakdown(data.rum.browsers, "userAgentBrowser")}
                label="Browsers"
              />
            </Panel>
            <Panel
              title="Devices"
              description="Device categories from browser telemetry"
            >
              <Breakdown
                rows={breakdown(data.rum.devices, "deviceType")}
                label="Devices"
              />
            </Panel>
            <Panel
              title="Response status codes"
              description="Raw HTTP requests, including assets and automation"
            >
              <Breakdown
                rows={[...statuses]
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value)}
                label="Response statuses"
              />
            </Panel>
            <Panel
              title="Bot classification"
              description="Browser beacon classification; not a complete measure of bot traffic"
            >
              <Breakdown
                rows={data.rum.bots.map((row) => ({
                  name: `Cloudflare bot flag: ${row.dimensions?.bot}`,
                  value: row.count,
                }))}
                label="Bot classifications"
              />
            </Panel>
          </div>
          <Panel
            title="About these measurements"
            description={`Fetched ${new Date(data.fetchedAt).toLocaleTimeString()} · source: Cloudflare GraphQL Analytics`}
          >
            <div className="measurement-notes">
              {data.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
              <p>
                Web Analytics retention:{" "}
                {Math.floor(data.settings.rum.notOlderThan / 86400)} days.
                Maximum query:{" "}
                {Math.floor(data.settings.rum.maxDuration / 86400)} days.
                Observed sampling interval:{" "}
                {data.rum.totals[0]?.avg?.sampleInterval ?? "not returned"}.
              </p>
              <p>
                Daily unique IP observations:{" "}
                {data.edge
                  .map(
                    (row) =>
                      `${row.dimensions.date}: ${number(row.uniq.uniques)}`,
                  )
                  .join(" · ") || "No observations"}
                . These are not visitor totals.
              </p>
            </div>
          </Panel>
        </>
      )}
      {!data && !resource.loading && !resource.error && (
        <Notice>Analytics have not returned any data.</Notice>
      )}
    </>
  );
}
