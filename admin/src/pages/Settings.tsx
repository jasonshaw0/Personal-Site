import { useState } from "react";
import { api, dateTime, errorMessage } from "../api";
import { useResource } from "../hooks";
import type { AuditItem, SettingsData } from "../types";
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  PageHeading,
  Panel,
} from "../components/UI";
export default function Settings() {
  const resource = useResource<SettingsData>("/settings"),
    [wrap, setWrap] = useState(
      () => localStorage.getItem("admin.editor.wrap") !== "false",
    ),
    [font, setFont] = useState(
      () => localStorage.getItem("admin.editor.font") ?? "13",
    );
  const data = resource.data;
  return (
    <>
      <PageHeading
        eyebrow="SYSTEM / SETTINGS"
        title="Connections & controls."
        description="Integration health, deployment configuration, and your workspace preferences."
        action={
          <button className="button ghost" onClick={resource.refresh}>
            Recheck connections
          </button>
        }
      />
      {resource.error && (
        <ErrorNotice message={resource.error} onRetry={resource.refresh} />
      )}{" "}
      {resource.loading ? (
        <Loading text="Checking integration access…" />
      ) : (
        data && (
          <>
            <div className="panel-grid">
              <Panel
                title="GitHub"
                description="Source of truth for published content"
              >
                <div className="integration-heading">
                  <Badge tone={data.github.available ? "good" : "bad"}>
                    {data.github.available ? "Connected" : "Unavailable"}
                  </Badge>
                  <span>Server-side credential</span>
                </div>
                {data.github.error && (
                  <ErrorNotice message={data.github.error} />
                )}
                <dl>
                  <dt>Repository</dt>
                  <dd>{data.repository}</dd>
                  <dt>Publishing branch</dt>
                  <dd>
                    <code>{data.branch}</code>
                  </dd>
                  <dt>Content directory</dt>
                  <dd>
                    <code>blog/content/</code>
                  </dd>
                  <dt>Asset directory</dt>
                  <dd>
                    <code>public/blog/images/</code>
                  </dd>
                </dl>
              </Panel>
              <Panel
                title="Cloudflare Analytics"
                description="Web Analytics, edge traffic, and build status"
              >
                <Badge tone={data.analytics.available ? "good" : "bad"}>
                  {data.analytics.available ? "Connected" : "Unavailable"}
                </Badge>
                {data.analytics.error && (
                  <ErrorNotice message={data.analytics.error} />
                )}
                <dl>
                  <dt>Web Analytics</dt>
                  <dd>
                    {data.analytics.data?.rum.enabled
                      ? "Available"
                      : "Unavailable"}
                  </dd>
                  <dt>Security events</dt>
                  <dd>
                    {data.analytics.data?.events.enabled
                      ? "Available"
                      : "Unavailable"}
                  </dd>
                  <dt>Build reporting</dt>
                  <dd>
                    {data.deployments.available
                      ? "Available"
                      : (data.deployments.error ?? "Unavailable")}
                  </dd>
                  <dt>Credential</dt>
                  <dd>Read-only · separate from security changes</dd>
                </dl>
              </Panel>
              <Panel
                title="Security management"
                description="A dedicated IP list and scoped WAF rule"
              >
                <Badge tone={data.security.available ? "good" : "bad"}>
                  {data.security.available ? "Connected" : "Unavailable"}
                </Badge>
                {data.security.error && (
                  <ErrorNotice message={data.security.error} />
                )}
                <dl>
                  <dt>Managed addresses</dt>
                  <dd>{data.security.data?.blockCount ?? "—"}</dd>
                  <dt>Rule scope</dt>
                  <dd>jason-shaw.com and www.jason-shaw.com</dd>
                  <dt>Administrative access</dt>
                  <dd>Admin hostname excluded from the blocking rule</dd>
                  <dt>Credential</dt>
                  <dd>Dedicated list-management token</dd>
                </dl>
              </Panel>
              <Panel
                title="Authentication"
                description="Cloudflare Access, verified again in the Worker"
              >
                <Badge tone="good">Verified session</Badge>
                <dl>
                  <dt>Authorized identity</dt>
                  <dd>{data.email}</dd>
                  <dt>Issuer</dt>
                  <dd>{data.access.issuer}</dd>
                  <dt>Alternate endpoints</dt>
                  <dd>{data.access.alternateHosts}</dd>
                  <dt>Session controls</dt>
                  <dd>
                    CSRF token, same-origin mutations, no public registration
                  </dd>
                </dl>
                <a className="text-link" href="/cdn-cgi/access/logout">
                  Sign out of this application ↗
                </a>
              </Panel>
              <Panel
                title="Editor preferences"
                description="Saved in this browser; article content is not stored in local storage"
              >
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={wrap}
                    onChange={(event) => {
                      setWrap(event.target.checked);
                      localStorage.setItem(
                        "admin.editor.wrap",
                        String(event.target.checked),
                      );
                    }}
                  />
                  Wrap long lines
                </label>
                <label className="field">
                  Editor font size
                  <select
                    value={font}
                    onChange={(event) => {
                      setFont(event.target.value);
                      localStorage.setItem(
                        "admin.editor.font",
                        event.target.value,
                      );
                    }}
                  >
                    {["12", "13", "14", "16", "18"].map((value) => (
                      <option key={value} value={value}>
                        {value} px
                      </option>
                    ))}
                  </select>
                </label>
              </Panel>
              <Panel
                title="Application"
                description="Independent from the public website deployment"
              >
                <dl>
                  <dt>Version</dt>
                  <dd>{data.version}</dd>
                  <dt>Environment</dt>
                  <dd>{data.origin}</dd>
                  <dt>Private storage</dt>
                  <dd>Cloudflare D1</dd>
                  <dt>Image size limit</dt>
                  <dd>{data.limits.imageBytes / 1048576} MiB</dd>
                  <dt>Article size limit</dt>
                  <dd>
                    {data.limits.markdownCharacters.toLocaleString()} characters
                  </dd>
                </dl>
              </Panel>
            </div>
            <Panel
              title="Dataset capabilities"
              description="Live limits reported by Cloudflare for this account"
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dataset</th>
                      <th>Available</th>
                      <th>Retention</th>
                      <th>Maximum query</th>
                      <th>Maximum page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.analytics.data ?? {}).map(
                      ([name, value]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>{value.enabled ? "Yes" : "No"}</td>
                          <td>{Math.floor(value.notOlderThan / 86400)} days</td>
                          <td>{Math.floor(value.maxDuration / 86400)} days</td>
                          <td>{value.maxPageSize.toLocaleString()}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )
      )}
    </>
  );
}
export function AuditLog() {
  const resource = useResource<AuditItem[]>("/audit"),
    [filter, setFilter] = useState(""),
    [exportError, setExportError] = useState("");
  const rows =
    resource.data?.filter((item) =>
      `${item.action} ${item.target} ${item.actor} ${item.outcome}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ) ?? [];
  const download = () => {
    void api<AuditItem[]>("/audit")
      .then((items) => {
        const blob = new Blob([JSON.stringify(items, null, 2)], {
            type: "application/json",
          }),
          url = URL.createObjectURL(blob),
          anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "admin-audit.json";
        anchor.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => setExportError(errorMessage(error)));
  };
  return (
    <>
      <PageHeading
        eyebrow="SYSTEM / AUDIT"
        title="A record of changes."
        description="The latest 200 administrative actions. Logs are stored privately in D1."
        action={
          <button className="button ghost" onClick={download}>
            Export log
          </button>
        }
      />
      <div className="list-controls">
        <input
          aria-label="Filter audit log"
          placeholder="Search actions, targets, or identity…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <button className="button ghost" onClick={resource.refresh}>
          Refresh
        </button>
      </div>
      {exportError && <ErrorNotice message={exportError} />}{" "}
      {resource.error ? (
        <ErrorNotice message={resource.error} />
      ) : resource.loading ? (
        <Loading />
      ) : !rows.length ? (
        <Empty title="No matching activity" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Target</th>
                <th>Actor</th>
                <th>Result</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="nowrap">{dateTime(item.created_at)}</td>
                  <td>{item.action}</td>
                  <td>
                    <code>{item.target}</code>
                  </td>
                  <td>{item.actor}</td>
                  <td>
                    <Badge tone={item.outcome === "success" ? "good" : "bad"}>
                      {item.outcome}
                    </Badge>
                  </td>
                  <td className="audit-detail">{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
