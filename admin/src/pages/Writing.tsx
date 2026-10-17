import { useState } from "react";
import { FilePlus2, Search } from "lucide-react";
import { api, dateTime, errorMessage } from "../api";
import { useResource } from "../hooks";
import type { PostData } from "../types";
import type { Draft } from "../../shared/content";
import { draftStatus } from "../../shared/content";
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  Notice,
  PageHeading,
} from "../components/UI";
export default function Writing({
  navigate,
  notify,
}: {
  navigate: (path: string) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const resource = useResource<PostData>("/posts"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("updated"),
    [busy, setBusy] = useState(false);
  const drafts = resource.data?.drafts ?? [],
    repository = resource.data?.repository.data ?? [];
  const rows = [
    ...drafts.map((draft) => ({
      id: draft.id,
      title: draft.metadata.title,
      description: draft.metadata.description,
      slug: draft.metadata.slug,
      date: draft.updatedAt,
      status: draftStatus(draft),
      format: draft.format,
      tags: draft.metadata.tags,
      path: draft.originPath,
    })),
    ...repository
      .filter((post) => !drafts.some((draft) => draft.originPath === post.path))
      .map((post) => ({
        id: post.path,
        title: post.title,
        description: post.description,
        slug: post.slug,
        date: post.date,
        status: post.status,
        format: post.format,
        tags: post.tags,
        path: post.path,
      })),
  ]
    .filter(
      (row) =>
        (filter === "all" ||
          (filter === "drafts" && row.status.includes("draft")) ||
          (filter === "published" && row.status.includes("published")) ||
          (filter === "scheduled" && row.status.startsWith("scheduled"))) &&
        `${row.title} ${row.description} ${row.tags.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : b.date.localeCompare(a.date),
    );
  const open = async (id: string) => {
    if (!id.startsWith("blog/")) {
      navigate(`writing/${id}`);
      return;
    }
    setBusy(true);
    try {
      const draft = await api<Draft>("/import", {
        method: "POST",
        body: { path: id },
      });
      navigate(`writing/${draft.id}`);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="CONTENT / WRITING"
        title="The working notebook."
        description="Private drafts stay here. Published articles live in GitHub."
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
      {resource.error && (
        <ErrorNotice message={resource.error} onRetry={resource.refresh} />
      )}{" "}
      {resource.data?.repository.error && (
        <Notice>
          <p>
            {resource.data.repository.error} Private drafts remain available.
          </p>
        </Notice>
      )}
      <div className="list-controls">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search articles"
            placeholder="Search titles, descriptions, tags…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          aria-label="Filter article status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All articles</option>
          <option value="drafts">Drafts</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <select
          aria-label="Sort articles"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="updated">Latest first</option>
          <option value="title">Title A–Z</option>
        </select>
        <button className="button ghost" onClick={resource.refresh}>
          Refresh
        </button>
      </div>
      {resource.loading ? (
        <Loading text="Opening the notebook…" />
      ) : !rows.length ? (
        <Empty
          title={
            search || filter !== "all"
              ? "No matching articles"
              : "A blank page is a good beginning."
          }
          action={
            <button
              className="button ghost"
              onClick={() => navigate("writing/new")}
            >
              Write a new note ↗
            </button>
          }
        >
          {search || filter !== "all"
            ? "Try a different search or status."
            : "Start privately, then publish when the writing is ready."}
        </Empty>
      ) : (
        <div className="article-list">
          {rows.map((row) => (
            <button
              className="article-row"
              key={row.id}
              onClick={() => void open(row.id)}
              disabled={busy}
            >
              <div className="article-row-main">
                <h2>{row.title}</h2>
                <p>{row.description}</p>
                <div className="row-tags">
                  {row.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                  <code>/blog/{row.slug}</code>
                </div>
              </div>
              <div className="article-row-meta">
                <Badge
                  tone={
                    row.status.startsWith("published")
                      ? "good"
                      : row.status.startsWith("scheduled")
                        ? "pending"
                        : ""
                  }
                >
                  {row.status}
                </Badge>
                <time>{dateTime(row.date)}</time>
                <span className="eyebrow">{row.format.toUpperCase()} ↗</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="footnote">
        Repository drafts are already visible in the public source. Unpublish
        them to retain a private working copy only. Scheduled posts need a
        deployment after their publication date.
      </p>
    </>
  );
}
