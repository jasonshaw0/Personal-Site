import { useMemo, useState } from "react";
import ipaddr from "ipaddr.js";
import { ShieldCheck } from "lucide-react";
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
    [ipAction, setIPAction] = useState("block"),
    [blockSearch, setBlockSearch] = useState(""),
    [busy, setBusy] = useState(false);
  const events = useResource<EventsData>(
      tab === "events"
        ? `/security/events?start=${range.start}&end=${range.end}&action=${action}&country=${country}`
        : null,
    ),
    blocks = useResource<BlocksData>("/security/blocks", 30000);
  const managedByAddress = useMemo(() => {
    const entries = new Map<string, BlocksData["blocks"][number]>();
    for (const item of blocks.data?.blocks ?? []) {
      try {
        entries.set(ipaddr.process(item.ip).toString(), item);
      } catch {
        /* Unsupported entries remain visible in the managed list. */
      }
    }
    return entries;
  }, [blocks.data]);
  const managedBlock = (address: string) => {
    try {
      const normalized = ipaddr.process(address.trim()).toString();
      return managedByAddress.get(normalized);
    } catch {
      return undefined;
    }
  };
  const visibleBlocks =
    blocks.data?.blocks.filter((item) =>
      `${item.ip} ${item.comment ?? ""}`
        .toLowerCase()
        .includes(blockSearch.trim().toLowerCase()),
    ) ?? [];
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
          ? removeId
            ? `${address} unblocked from the managed IP list. Other Cloudflare rules still apply.`
            : `${address} added to the managed IP list.`
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
      value = value.trim();
      if (!ipaddr.isValid(value) || value.includes("/") || value.includes("%"))
        throw new Error("Enter one IPv4 or IPv6 address.");
      const normalized = ipaddr.process(value).toString();
      confirm({
        title: removeId ? "Unblock this IP address?" : "Block this IP address?",
        description: removeId
          ? `Remove ${normalized} from the dedicated website block list. Other Cloudflare rules will continue to apply.`
          : `Block ${normalized} on the public portfolio and blog. The admin hostname is excluded, and your current administrative IP cannot be blocked.`,
        label: removeId ? "Unblock IP" : "Block address",
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
                                  className={`inline-button ${managedBlock(item.clientIP) ? "" : "danger-text"}`}
                                  aria-label={`${managedBlock(item.clientIP) ? "Unblock" : "Block"} IP ${item.clientIP}`}
                                  disabled={
                                    busy || !item.clientIP || !blocks.data
                                  }
                                  onClick={() =>
                                    askBlock(
                                      item.clientIP,
                                      managedBlock(item.clientIP)?.id,
                                    )
                                  }
                                >
                                  {managedBlock(item.clientIP)
                                    ? "Unblock IP"
                                    : "Block IP"}
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
            title="Block or unblock an IP"
            description="Manage one public IPv4 or IPv6 address in the dedicated list"
          >
            <form
              className="block-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (ipAction === "unblock") {
                  const item = managedBlock(ip);
                  if (!item) {
                    notify(
                      "This address has no manual block in the managed list. Other Cloudflare rules may still block its requests.",
                      true,
                    );
                    return;
                  }
                  askBlock(item.ip, item.id);
                } else askBlock(ip);
              }}
            >
              <label>
                Action
                <select
                  value={ipAction}
                  onChange={(event) => setIPAction(event.target.value)}
                  disabled={busy}
                >
                  <option value="block">Block IP</option>
                  <option value="unblock">Unblock IP</option>
                </select>
              </label>
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
              {ipAction === "block" && (
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
              )}
              <button
                className={`button ${ipAction === "unblock" ? "primary" : "danger"}`}
                disabled={busy || !blocks.data}
              >
                {busy
                  ? "Applying…"
                  : ipAction === "unblock"
                    ? "Review unblock"
                    : "Review block"}
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
            description="Unblock IP removes a manual block from this list. Other Cloudflare rules continue to apply."
            action={
              <button className="inline-button" onClick={blocks.refresh}>
                Refresh
              </button>
            }
          >
            <div className="list-controls">
              <input
                aria-label="Search managed IP blocks"
                placeholder="Search blocked IPs or reasons…"
                value={blockSearch}
                onChange={(event) => setBlockSearch(event.target.value)}
              />
            </div>
            {blocks.loading ? (
              <Loading />
            ) : !visibleBlocks.length ? (
              <Empty
                title={
                  blockSearch
                    ? "No matching blocked addresses."
                    : "No manually blocked addresses."
                }
              />
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
                    {visibleBlocks.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <code>{item.ip}</code>
                        </td>
                        <td>{item.comment || "No reason supplied"}</td>
                        <td>{dateTime(item.created_on)}</td>
                        <td>
                          <button
                            className="inline-button"
                            aria-label={`Unblock IP ${item.ip}`}
                            disabled={busy}
                            onClick={() => askBlock(item.ip, item.id)}
                          >
                            <ShieldCheck size={13} />
                            Unblock IP
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
