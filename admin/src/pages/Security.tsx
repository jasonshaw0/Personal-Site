import { useState } from "react";
import ipaddr from "ipaddr.js";
import { ShieldCheck, Trash2 } from "lucide-react";
import { api, dateRange, dateTime, errorMessage, number } from "../api";
import { useResource } from "../hooks";
import type { BlocksData, EventsData } from "../types";
import { RangeControls } from "./Analytics";
import { Breakdown, TrendChart } from "../components/Charts";
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  Notice,
  PageHeading,
  Panel,
  type Confirmation,
} from "../components/UI";
export default function Security({
  notify,
  confirm,
}: {
  notify: (message: string, error?: boolean) => void;
  confirm: (value: Confirmation) => void;
}) {
  const [tab, setTab] = useState("events"),
    [range, setRange] = useState(dateRange(1)),
    [action, setAction] = useState(""),
    [country, setCountry] = useState(""),
    [ip, setIP] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const events = useResource<EventsData>(
      tab === "events"
        ? `/security/events?start=${range.start}&end=${range.end}&action=${action}&country=${country}`
        : null,
    ),
    blocks = useResource<BlocksData>("/security/blocks", 30000);
  const changeBlock = async (address: string, removeId?: string) => {
    setBusy(true);
    try {
      const result = await api<{ operationId: string; ip: string }>(
        "/security/blocks",
        {
          method: removeId ? "DELETE" : "POST",
          body: {
            ip: address,
            id: removeId,
            reason,
            confirmation: `${removeId ? "unblock" : "block"}:${address}`,
          },
        },
      );
      notify(
        "Cloudflare accepted the change. Waiting for the IP list to update…",
      );
      let complete = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const status = await api<{ status: string; error?: string }>(
          `/security/operations/${result.operationId}`,
        );
        if (status.status === "failed")
          throw new Error(
            status.error ?? "Cloudflare could not apply the list update.",
          );
        if (status.status === "completed") {
          complete = true;
          break;
        }
      }
      notify(
        complete
          ? `${address} ${removeId ? "removed from" : "added to"} the managed IP list.`
          : "The update is still pending in Cloudflare. Refresh the list to confirm its final state.",
      );
      setIP("");
      setReason("");
      blocks.refresh();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const askBlock = (value: string, removeId?: string) => {
    try {
      if (!ipaddr.isValid(value) || value.includes("/") || value.includes("%"))
        throw new Error("Enter one IPv4 or IPv6 address.");
      const normalized = ipaddr.process(value).toString();
      confirm({
        title: removeId ? "Remove this IP block?" : "Block this IP address?",
        description: removeId
          ? `Remove ${normalized} from the dedicated website block list. Other Cloudflare rules will continue to apply.`
          : `Block ${normalized} on the public portfolio and blog. The admin hostname is excluded, and your current administrative IP cannot be blocked.`,
        label: removeId ? "Remove block" : "Block address",
        danger: !removeId,
        run: () => changeBlock(normalized, removeId),
      });
    } catch (error) {
      notify(errorMessage(error), true);
    }
  };
  const grouped = new Map<string, number>(),
    actions = new Map<string, number>();
  events.data?.trend?.forEach((row) => {
    grouped.set(
      row.dimensions.date,
      (grouped.get(row.dimensions.date) ?? 0) + row.count,
    );
    actions.set(
      row.dimensions.action,
      (actions.get(row.dimensions.action) ?? 0) + row.count,
    );
  });
  return (
    <>
      <PageHeading
        eyebrow="OPERATIONS / SECURITY"
        title="A measured watch."
        description="Cloudflare security events and deliberate, auditable IP management."
      />
      <div className="tabs" role="tablist" aria-label="Security views">
        <button
          role="tab"
          aria-selected={tab === "events"}
          onClick={() => setTab("events")}
        >
          Security events
        </button>
        <button
          role="tab"
          aria-selected={tab === "blocks"}
          onClick={() => setTab("blocks")}
        >
          Managed IP blocks{" "}
          <span>{blocks.data ? number(blocks.data.blocks.length) : "—"}</span>
        </button>
      </div>
      {tab === "events" ? (
        <>
          <RangeControls
            {...range}
            setRange={setRange}
            maxDays={Math.floor(
              (events.data?.settings.maxDuration ?? 2592000) / 86400,
            )}
          />
          <div className="list-controls">
            <label>
              Action
              <select
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="">All actions</option>
                {[
                  "block",
                  "managed_challenge",
                  "challenge",
                  "js_challenge",
                  "skip",
                  "allow",
                  "log",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Country code
              <input
                maxLength={2}
                value={country}
                onChange={(event) =>
                  setCountry(
                    event.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
                  )
                }
                placeholder="All"
                aria-label="Filter security country code"
              />
            </label>
            <button className="button ghost" onClick={events.refresh}>
              Refresh events
            </button>
          </div>
          {events.error && (
            <ErrorNotice message={events.error} onRetry={events.refresh} />
          )}{" "}
          {events.loading ? (
            <Loading text="Reading Cloudflare security events…" />
          ) : (
            events.data && (
              <>
                <div className="panel-grid">
                  <Panel
                    title="Security activity"
                    description={events.data.trendScope}
                  >
                    <TrendChart
                      label="Security events"
                      points={[...grouped].map(([date, value]) => ({
                        date,
                        value,
                      }))}
                    />
                  </Panel>
                  <Panel
                    title="Actions taken"
                    description="Actions among the returned events"
                  >
                    <Breakdown
                      rows={[...actions].map(([name, value]) => ({
                        name,
                        value,
                      }))}
                      label="Security actions"
                    />
                  </Panel>
                </div>
                <Panel
                  title="Recent events"
                  description={`Latest ${events.data.limit} events maximum · IPs are from security events, never from Web Analytics`}
                >
                  <Notice>
                    <p>
                      Security data may be sampled. A full page of{" "}
                      {events.data.limit} events may be truncated; narrow the
                      date range or filters. Account retention:{" "}
                      {Math.floor(events.data.settings.notOlderThan / 86400)}{" "}
                      days.
                    </p>
                  </Notice>
                  {!events.data.events?.length ? (
                    <Empty title="No recorded security events.">
                      No events were returned for these dates and filters.
                    </Empty>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Action</th>
                            <th>Source IP</th>
                            <th>Country</th>
                            <th>Request</th>
                            <th>Source</th>
                            <th>Sample interval</th>
                            <th>Manage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {events.data.events.map((item, index) => (
                            <tr key={`${item.rayName}-${index}`}>
                              <td className="nowrap">
                                {dateTime(item.datetime)}
                              </td>
                              <td>
                                <Badge
                                  tone={
                                    item.action === "block" ? "bad" : "pending"
                                  }
                                >
                                  {item.action}
                                </Badge>
                              </td>
                              <td>
                                <code>{item.clientIP || "Unavailable"}</code>
                              </td>
                              <td>{item.clientCountryName || "—"}</td>
                              <td className="request-cell">
                                <span>{item.clientRequestHTTPHost}</span>
                                <code>{item.clientRequestPath}</code>
                              </td>
                              <td>{item.source}</td>
                              <td>{item.sampleInterval}</td>
                              <td>
                                <button
                                  className="inline-button danger-text"
                                  disabled={
                                    busy || !item.clientIP || !blocks.data
                                  }
                                  onClick={() => askBlock(item.clientIP)}
                                >
                                  Block IP
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              </>
            )
          )}
        </>
      ) : (
        <>
          <Notice>
            <p>
              <ShieldCheck size={16} className="inline-icon" />
              The dedicated rule applies only to jason-shaw.com and
              www.jason-shaw.com. Administrative and contact hostnames are
              excluded. Addresses in this list do not alter unrelated rules.
            </p>
          </Notice>
          {blocks.error && (
            <ErrorNotice message={blocks.error} onRetry={blocks.refresh} />
          )}
          <Panel
            title="Add an IP block"
            description="One public IPv4 or IPv6 address; ranges and private addresses are rejected"
          >
            <form
              className="block-form"
              onSubmit={(event) => {
                event.preventDefault();
                askBlock(ip);
              }}
            >
              <label>
                IP address
                <input
                  value={ip}
                  onChange={(event) => setIP(event.target.value)}
                  placeholder="IPv4 or IPv6"
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Reason <span className="muted">(optional)</span>
                <input
                  value={reason}
                  maxLength={300}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why is this address being blocked?"
                  disabled={busy}
                />
              </label>
              <button className="button danger" disabled={busy || !blocks.data}>
                {busy ? "Applying…" : "Review block"}
              </button>
            </form>
            {blocks.data?.currentIP && (
              <p className="footnote">
                Your administrative address:{" "}
                <code>{blocks.data.currentIP}</code>. This address is protected
                from blocking.
              </p>
            )}
          </Panel>
          <Panel
            title="Managed addresses"
            description="Creation times and reasons are returned by Cloudflare"
            action={
              <button className="inline-button" onClick={blocks.refresh}>
                Refresh
              </button>
            }
          >
            {blocks.loading ? (
              <Loading />
            ) : !blocks.data?.blocks.length ? (
              <Empty title="No manually blocked addresses." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Reason</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.data.blocks.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <code>{item.ip}</code>
                        </td>
                        <td>{item.comment || "No reason supplied"}</td>
                        <td>{dateTime(item.created_on)}</td>
                        <td>
                          <button
                            className="inline-button"
                            disabled={busy}
                            onClick={() => askBlock(item.ip, item.id)}
                          >
                            <Trash2 size={13} />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
