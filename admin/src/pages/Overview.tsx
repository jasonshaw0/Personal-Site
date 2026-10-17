import { ArrowUpRight, FilePlus2 } from "lucide-react";
import { dateRange, dateTime } from "../api";
import { useResource } from "../hooks";
import type { AnalyticsData, AuditItem, Deployment, PostData } from "../types";
import { Metrics } from "./Analytics";
import { TrendChart } from "../components/Charts";
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  PageHeading,
  Panel,
} from "../components/UI";
export default function Overview({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const range = dateRange(7),
    analytics = useResource<AnalyticsData>(
      `/analytics?start=${range.start}&end=${range.end}`,
    ),
    posts = useResource<PostData>("/posts"),
    builds = useResource<Deployment[]>("/deployments", 30000),
    audit = useResource<AuditItem[]>("/audit");
  return (
    <>
      <PageHeading
        eyebrow="SITE / OVERVIEW"
        title="Everything in view."
        description="Writing, readership, and the health of your website."
        action={
          <button
            className="button primary"
            onClick={() => navigate("writing/new")}
          >
            <FilePlus2 size={15} />
            New article
          </button>
        }
      />
      <div className="section-line">
        <span className="eyebrow">THE LAST SEVEN DAYS</span>
        <button className="inline-button" onClick={() => navigate("analytics")}>
          Explore analytics <ArrowUpRight size={13} />
        </button>
      </div>
      {analytics.loading ? (
        <Loading text="Loading readership…" />
      ) : analytics.error ? (
        <ErrorNotice message={analytics.error} onRetry={analytics.refresh} />
      ) : (
        analytics.data && <Metrics data={analytics.data} />
      )}
      <div className="overview-grid">
        <Panel
          title="Readership"
          description="Browser page views · past seven days"
          action={
            <button
              className="inline-button"
              onClick={() => navigate("analytics")}
            >
              Details ↗
            </button>
          }
        >
          {analytics.data ? (
            <TrendChart
              label="Browser page views"
              points={analytics.data.rum.daily.map((row) => ({
                date: String(row.dimensions?.date ?? ""),
                value: row.count,
              }))}
            />
          ) : (
            <p className="quiet-empty">
              Readership data is currently unavailable.
            </p>
          )}
        </Panel>
        <Panel
          title="Your writing"
          description="Published content and private working copies"
          action={
            <button
              className="inline-button"
              onClick={() => navigate("writing")}
            >
              Manage ↗
            </button>
          }
        >
          {posts.error ? (
            <ErrorNotice message={posts.error} />
          ) : posts.loading ? (
            <Loading />
          ) : (
            <>
              <div className="writing-counts">
                <div>
                  <strong>
                    {posts.data?.repository.available
                      ? posts.data.repository.data?.filter(
                          (post) => post.status === "published",
                        ).length
                      : "—"}
                  </strong>
                  <span>published</span>
                </div>
                <div>
                  <strong>{posts.data?.drafts.length ?? 0}</strong>
                  <span>private working copies</span>
                </div>
              </div>
              {posts.data?.drafts.slice(0, 3).map((draft) => (
                <button
                  className="recent-draft"
                  key={draft.id}
                  onClick={() => navigate(`writing/${draft.id}`)}
                >
                  <span>{draft.metadata.title}</span>
                  <small>{dateTime(draft.updatedAt)}</small>
                </button>
              ))}
              {!posts.data?.drafts.length && (
                <p className="quiet-empty">
                  A quiet desk. Start your next note when you’re ready.
                </p>
              )}
              {posts.data?.repository.error && (
                <ErrorNotice message={posts.data.repository.error} />
              )}
            </>
          )}
        </Panel>
      </div>
      <div className="panel-grid">
        <Panel
          title="Latest deployments"
          description="Public website · refreshed every 30 seconds"
          action={
            <button className="inline-button" onClick={builds.refresh}>
              Refresh
            </button>
          }
        >
          {builds.error ? (
            <ErrorNotice message={builds.error} onRetry={builds.refresh} />
          ) : builds.loading ? (
            <Loading />
          ) : !builds.data?.length ? (
            <Empty title="No deployments returned" />
          ) : (
            <div className="deployment-list">
              {builds.data.slice(0, 4).map((build) => (
                <div key={build.id}>
                  <div>
                    <Badge
                      tone={
                        build.outcome === "success"
                          ? "good"
                          : build.outcome === "fail"
                            ? "bad"
                            : "pending"
                      }
                    >
                      {build.outcome ?? build.status}
                    </Badge>
                    <code>{build.commit?.slice(0, 7) ?? "—"}</code>
                    <time>{dateTime(build.createdAt)}</time>
                  </div>
                  <p>{build.message || "Build in progress"}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel
          title="Recent activity"
          description="Administrative changes recorded by this application"
          action={
            <button className="inline-button" onClick={() => navigate("audit")}>
              Audit log ↗
            </button>
          }
        >
          {audit.error ? (
            <ErrorNotice message={audit.error} />
          ) : audit.loading ? (
            <Loading />
          ) : !audit.data?.length ? (
            <Empty title="No administrative changes yet" />
          ) : (
            <div className="activity-list">
              {audit.data.slice(0, 5).map((item) => (
                <div key={item.id}>
                  <span
                    className={`activity-dot ${item.outcome === "failed" ? "bad" : ""}`}
                  />
                  <div>
                    <strong>{item.action.replaceAll(".", " / ")}</strong>
                    <p>{item.actor}</p>
                  </div>
                  <time>{dateTime(item.created_at)}</time>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
