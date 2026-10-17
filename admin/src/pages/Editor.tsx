import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  ArrowLeft,
  Bold,
  Check,
  Code2,
  Download,
  Heading2,
  History,
  ImagePlus,
  Italic,
  Link,
  List,
  Maximize2,
  Minimize2,
  Quote,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import type { Draft, Metadata } from "../../shared/content";
import {
  metadataSchema,
  readingMinutes,
  wordCount,
  draftStatus,
} from "../../shared/content";
import { api, dateTime, errorMessage, uploadImage } from "../api";
import MarkdownEditor, { type Insert } from "../components/MarkdownEditor";
import {
  Badge,
  ErrorNotice,
  Loading,
  Notice,
  type Confirmation,
} from "../components/UI";
const Preview = lazy(() => import("../components/Preview"));
type Revision = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string; name: string } };
};
type Props = {
  id: string;
  navigate: (path: string, replace?: boolean) => void;
  notify: (message: string, error?: boolean) => void;
  confirm: (value: Confirmation) => void;
  onDirty: (dirty: boolean) => void;
};
const fingerprint = (draft: Draft) =>
  JSON.stringify({ metadata: draft.metadata, body: draft.body });
export default function Editor({
  id,
  navigate,
  notify,
  confirm,
  onDirty,
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null),
    [error, setError] = useState(""),
    [saveState, setSaveState] = useState("Loading"),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState("split"),
    [fullscreen, setFullscreen] = useState(false),
    [history, setHistory] = useState<Revision[] | null>(null),
    [previewOpen, setPreviewOpen] = useState(false),
    [savedFingerprint, setSavedFingerprint] = useState(""),
    [tagsText, setTagsText] = useState("");
  const current = useRef(draft),
    saved = useRef(""),
    inFlight = useRef<Promise<Draft> | null>(null),
    insert = useRef<Insert>(() => {}),
    imageInput = useRef<HTMLInputElement>(null),
    coverInput = useRef<HTMLInputElement>(null),
    alive = useRef(true),
    previewDialog = useRef<HTMLDialogElement>(null);
  current.current = draft;
  const dirty = Boolean(draft && fingerprint(draft) !== savedFingerprint);
  const replace = (value: Draft) => {
    current.current = value;
    saved.current = fingerprint(value);
    setSavedFingerprint(saved.current);
    setDraft(value);
    setTagsText(value.metadata.tags.join(", "));
    setSaveState("Saved privately");
    setError("");
  };
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const load = async () => {
      try {
        let value: Draft;
        if (id === "new") {
          const today = new Date().toISOString().slice(0, 10);
          value = await api<Draft>("/drafts", {
            method: "POST",
            body: {
              metadata: {
                title: "Untitled note",
                description: "A new private draft.",
                slug: `untitled-${crypto.randomUUID().slice(0, 8)}`,
                date: today,
                tags: [],
                cover: "",
                coverAlt: "",
                coverCaption: "",
                featured: false,
                toc: true,
              },
              body: "",
            },
          });
        } else value = await api<Draft>(`/drafts/${id}`);
        if (!cancelled) {
          replace(value);
          if (id === "new") navigate(`writing/${value.id}`, true);
        }
      } catch (error) {
        if (!cancelled) setError(errorMessage(error));
      }
    };
    void load();
    return () => {
      cancelled = true;
      alive.current = false;
      onDirty(false);
    };
  }, [id]);
  const saveNow = async (): Promise<Draft> => {
    if (inFlight.current) {
      await inFlight.current;
      if (current.current && fingerprint(current.current) === saved.current)
        return current.current;
    }
    const value = current.current;
    if (!value) throw new Error("The draft has not loaded.");
    const validation = metadataSchema.safeParse(value.metadata);
    if (!validation.success) {
      const message = validation.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      setSaveState("Not saved");
      setError(message);
      throw new Error(message);
    }
    if (fingerprint(value) === saved.current) return value;
    const body = {
        metadata: value.metadata,
        body: value.body,
        version: value.version,
      },
      key = fingerprint(value);
    setSaveState("Saving…");
    const promise = api<Draft>(`/drafts/${value.id}`, { method: "PUT", body });
    inFlight.current = promise;
    try {
      const result = await promise;
      saved.current = key;
      if (alive.current) {
        setSavedFingerprint(key);
        setDraft((previous) =>
          previous
            ? {
                ...previous,
                version: result.version,
                updatedAt: result.updatedAt,
              }
            : result,
        );
        if (current.current)
          current.current = {
            ...current.current,
            version: result.version,
            updatedAt: result.updatedAt,
          };
        setSaveState("Saved privately");
        setError("");
      }
      return result;
    } catch (error) {
      if (alive.current) {
        setSaveState("Not saved");
        setError(errorMessage(error));
      }
      throw error;
    } finally {
      inFlight.current = null;
    }
  };
  const saveFunction = useRef(saveNow);
  saveFunction.current = saveNow;
  useEffect(() => {
    onDirty(dirty || saveState === "Saving…");
    if (!dirty || busy) return;
    setSaveState("Unsaved changes");
    const timer = setTimeout(() => {
      void saveFunction.current().catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [draft?.body, draft?.metadata, dirty, busy, onDirty]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        void saveFunction.current().catch(() => {});
      }
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", shortcut);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        current.current &&
        (fingerprint(current.current) !== saved.current || inFlight.current)
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);
  useEffect(() => {
    if (previewOpen) previewDialog.current?.showModal();
    else previewDialog.current?.close();
  }, [previewOpen]);
  const updateMetadata = <K extends keyof Metadata>(
    key: K,
    value: Metadata[K],
  ) =>
    setDraft((previous) =>
      previous
        ? { ...previous, metadata: { ...previous.metadata, [key]: value } }
        : previous,
    );
  const upload = async (files: File[], cover = false) => {
    setBusy(true);
    try {
      for (const file of files) {
        const result = await uploadImage(file);
        if (cover) {
          setDraft((previous) =>
            previous
              ? {
                  ...previous,
                  metadata: {
                    ...previous.metadata,
                    cover: result.url,
                    coverAlt:
                      previous.metadata.coverAlt ||
                      file.name.replace(/\.[^.]+$/, ""),
                  },
                }
              : previous,
          );
        } else
          insert.current(
            `\n![${file.name.replace(/\.[^.]+$/, "")}](${result.url})\n`,
            "",
            "",
            true,
          );
      }
      notify("Image uploaded privately.");
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
      if (imageInput.current) imageInput.current.value = "";
      if (coverInput.current) coverInput.current.value = "";
    }
  };
  const perform = async (action: "publish" | "unpublish" | "delete") => {
    setBusy(true);
    try {
      if (action === "delete" && inFlight.current)
        await inFlight.current.catch(() => {});
      const value =
        action === "delete"
          ? await api<Draft>(`/drafts/${current.current!.id}`)
          : await saveFunction.current();
      const result = await api<{
        draft?: Draft;
        commit?: string;
        message: string;
      }>(`/drafts/${value.id}${action === "delete" ? "" : `/${action}`}`, {
        method: action === "delete" ? "DELETE" : "POST",
        body: {
          version: value.version,
          confirmation: `${action}:${value.metadata.slug}`,
        },
      });
      notify(result.message);
      if (action === "delete") {
        onDirty(false);
        navigate("writing");
      } else if (result.draft) replace(result.draft);
    } catch (error) {
      notify(errorMessage(error), true);
      setError(errorMessage(error));
      if (current.current) {
        try {
          const latest = await api<Draft>(`/drafts/${current.current.id}`);
          setDraft((previous) =>
            previous && fingerprint(previous) === fingerprint(latest)
              ? {
                  ...previous,
                  version: latest.version,
                  originPath: latest.originPath,
                }
              : previous,
          );
        } catch {
          /* Leave the editable working copy available. */
        }
      }
    } finally {
      setBusy(false);
    }
  };
  const ask = (action: "publish" | "unpublish" | "delete") => {
    if (!draft) return;
    confirm({
      title:
        action === "publish"
          ? "Publish this article?"
          : action === "unpublish"
            ? "Unpublish this article?"
            : "Delete this article?",
      description:
        action === "publish"
          ? `“${draft.metadata.title}” and its referenced images will be committed to GitHub. Cloudflare will build the public page. Your private working copy remains here.`
          : action === "unpublish"
            ? "The article will be removed from GitHub and disappear after the next successful deployment. Its private working copy will be retained."
            : draft.baseSha
              ? "This removes the article from GitHub and deletes its private working copy. Previous published revisions remain in Git history."
              : "This permanently deletes the private draft. It has not been published.",
      label:
        action === "publish"
          ? "Publish to GitHub"
          : action === "unpublish"
            ? "Unpublish"
            : "Delete article",
      danger: action !== "publish",
      run: () => perform(action),
    });
  };
  const revisionAction = async (
    action: "restore" | "reload",
    revision?: string,
  ) => {
    if (!draft) return;
    setBusy(true);
    try {
      const result = await api<Draft>(`/drafts/${draft.id}/${action}`, {
        method: "POST",
        body: {
          version: draft.version,
          revision,
          confirmation: `${action}:${draft.metadata.slug}`,
        },
      });
      replace(result);
      setHistory(null);
      notify(
        action === "restore"
          ? "Revision restored into a private draft. Review it before publishing."
          : result.baseSha
            ? "Latest GitHub revision loaded."
            : "The repository file is absent. Your working copy is retained privately.",
      );
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    if (!draft) return;
    const text = `---\n${Object.entries(draft.metadata)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join("\n")}\nstatus: draft\n---\n\n${draft.body}`,
      url = URL.createObjectURL(new Blob([text], { type: "text/markdown" })),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.metadata.slug}.${draft.format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  if (!draft)
    return error ? (
      <ErrorNotice message={error} onRetry={() => window.location.reload()} />
    ) : (
      <Loading text="Opening your private working copy…" />
    );
  return (
    <div className={`editor-page ${fullscreen ? "editor-fullscreen" : ""}`}>
      <div className="editor-heading">
        <button className="inline-button" onClick={() => navigate("writing")}>
          <ArrowLeft size={14} />
          All writing
        </button>
        <div className="editor-save-status" role="status">
          <span
            className={
              saveState === "Not saved"
                ? "bad-dot"
                : dirty
                  ? "pending-dot"
                  : "good-dot"
            }
          />
          {saveState}
        </div>
        <Badge tone={draft.baseSha ? "good" : ""}>{draftStatus(draft)}</Badge>
        <button
          className="icon-button"
          aria-label={
            fullscreen ? "Exit fullscreen editor" : "Fullscreen editor"
          }
          onClick={() => setFullscreen(!fullscreen)}
        >
          {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
      <div className="editor-titlebar">
        <div>
          <span className="eyebrow">
            {draft.format.toUpperCase()} / PRIVATE WORKSPACE
          </span>
          <h1>{draft.metadata.title || "Untitled note"}</h1>
        </div>
        <div className="editor-actions">
          <button
            className="button ghost"
            disabled={busy}
            onClick={() =>
              void saveNow().then(
                () => notify("Draft saved privately."),
                (error) => notify(errorMessage(error), true),
              )
            }
          >
            <Save size={14} />
            Save draft
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => ask("publish")}
          >
            <Send size={14} />
            Publish
          </button>
        </div>
      </div>
      {error && <ErrorNotice message={error} />}{" "}
      {draft.format === "mdx" && (
        <Notice>
          <p>
            This article uses MDX. Its body is read-only and preserved
            byte-for-byte; metadata can be edited. Preview shows safe Markdown,
            without executing MDX imports or components.
          </p>
        </Notice>
      )}
      <div className="editor-layout">
        <div className="editor-workspace">
          <div className="editor-toolbar">
            <div>
              <button
                title="Heading"
                aria-label="Insert heading"
                disabled={busy || draft.format === "mdx"}
                onClick={() => insert.current("\n## ", "", "Heading")}
              >
                <Heading2 size={16} />
              </button>
              <button
                title="Bold (Ctrl+B)"
                aria-label="Bold"
                disabled={busy || draft.format === "mdx"}
                onClick={() => insert.current("**", "**")}
              >
                <Bold size={15} />
              </button>
              <button
                title="Italic (Ctrl+I)"
                aria-label="Italic"
                disabled={busy || draft.format === "mdx"}
                onClick={() => insert.current("*", "*")}
              >
                <Italic size={15} />
              </button>
              <button
                title="Link (Ctrl+K)"
                aria-label="Insert link"
                disabled={busy || draft.format === "mdx"}
                onClick={() => insert.current("[", "](https://)", "link text")}
              >
                <Link size={15} />
              </button>
              <button
                title="Code block"
                aria-label="Insert code block"
                disabled={busy || draft.format === "mdx"}
                onClick={() =>
                  insert.current("\n```typescript\n", "\n```\n", "// Your code")
                }
              >
                <Code2 size={16} />
              </button>
              <button
                title="List"
                aria-label="Insert list"
                disabled={busy || draft.format === "mdx"}
                onClick={() => insert.current("\n- ", "", "List item")}
              >
                <List size={16} />
              </button>
              <button
                title="Quote"
                aria-label="Insert blockquote"
                disabled={busy || draft.format === "mdx"}
                onClick={() =>
                  insert.current("\n> ", "", "A useful observation")
                }
              >
                <Quote size={15} />
              </button>
              <button
                title="Upload image"
                aria-label="Insert image"
                disabled={busy || draft.format === "mdx"}
                onClick={() => imageInput.current?.click()}
              >
                <ImagePlus size={16} />
              </button>
            </div>
            <div
              className="editor-modes"
              role="group"
              aria-label="Editor layout"
            >
              {["write", "split", "preview"].map((value) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className={`editor-panes mode-${mode}`}>
            <div className="code-pane">
              <MarkdownEditor
                value={draft.body}
                onChange={(body) =>
                  setDraft((previous) =>
                    previous ? { ...previous, body } : previous,
                  )
                }
                onUpload={(files) => void upload(files)}
                readOnly={draft.format === "mdx"}
                disabled={busy}
                onReady={(value) => {
                  insert.current = value;
                }}
              />
            </div>
            <div className="inline-preview">
              <Suspense fallback={<Loading text="Loading the reading view…" />}>
                <Preview metadata={draft.metadata} body={draft.body} />
              </Suspense>
            </div>
          </div>
          <div className="editor-statusbar">
            <span>
              {wordCount(draft.body).toLocaleString()} words ·{" "}
              {readingMinutes(draft.body)} min read
            </span>
            <span>
              Revision {draft.version} · {dateTime(draft.updatedAt)}
            </span>
          </div>
        </div>
        <aside className="article-settings">
          <fieldset disabled={busy}>
            <legend>Article details</legend>
            <label>
              Title
              <input
                value={draft.metadata.title}
                maxLength={160}
                onChange={(event) =>
                  updateMetadata("title", event.target.value)
                }
              />
            </label>
            <label>
              Description
              <textarea
                value={draft.metadata.description}
                maxLength={320}
                rows={3}
                onChange={(event) =>
                  updateMetadata("description", event.target.value)
                }
              />
              <small>{draft.metadata.description.length}/320</small>
            </label>
            <label>
              Slug
              <input
                value={draft.metadata.slug}
                onChange={(event) => updateMetadata("slug", event.target.value)}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
              <small>/blog/{draft.metadata.slug}</small>
            </label>
            <label>
              Publication date
              <input
                type="date"
                value={draft.metadata.date.slice(0, 10)}
                onChange={(event) => updateMetadata("date", event.target.value)}
              />
              <small>UTC. A future date needs a build after that date.</small>
            </label>
            <label>
              Tags
              <input
                value={tagsText}
                onChange={(event) => {
                  setTagsText(event.target.value);
                  updateMetadata(
                    "tags",
                    event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  );
                }}
                placeholder="Software, Engineering"
              />
              <small>Separate tags with commas.</small>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.metadata.featured}
                onChange={(event) =>
                  updateMetadata("featured", event.target.checked)
                }
              />
              Feature in the blog introduction
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.metadata.toc}
                onChange={(event) =>
                  updateMetadata("toc", event.target.checked)
                }
              />
              Show table of contents
            </label>
            <div className="settings-divider" />
            <label>
              Cover image
              <input
                value={draft.metadata.cover}
                onChange={(event) =>
                  updateMetadata("cover", event.target.value)
                }
                placeholder="/blog/images/cover.webp"
              />
            </label>
            <button
              className="button ghost wide"
              type="button"
              onClick={() => coverInput.current?.click()}
            >
              <ImagePlus size={14} />
              Upload cover
            </button>
            <label>
              Cover alt text
              <input
                value={draft.metadata.coverAlt}
                onChange={(event) =>
                  updateMetadata("coverAlt", event.target.value)
                }
              />
            </label>
            <label>
              Caption / credit
              <input
                value={draft.metadata.coverCaption}
                onChange={(event) =>
                  updateMetadata("coverCaption", event.target.value)
                }
              />
            </label>
          </fieldset>
          <div className="settings-divider" />
          <button
            className="button ghost wide"
            onClick={() => setPreviewOpen(true)}
          >
            Open reading preview ↗
          </button>
          <button className="inline-button" onClick={download}>
            <Download size={14} />
            Export Markdown backup
          </button>
          {draft.originPath && (
            <>
              <button
                className="inline-button"
                disabled={busy}
                onClick={() => {
                  void api<Revision[]>(`/drafts/${draft.id}/revisions`).then(
                    setHistory,
                    (error) => notify(errorMessage(error), true),
                  );
                }}
              >
                <History size={14} />
                Published revisions
              </button>
              <button
                className="inline-button"
                disabled={busy}
                onClick={() =>
                  confirm({
                    title: "Reload from GitHub?",
                    description:
                      "Your private changes will be replaced by the latest repository revision. Export a backup first if you need to compare them.",
                    label: "Reload latest",
                    run: () => revisionAction("reload"),
                  })
                }
              >
                Reload latest from GitHub ↗
              </button>
            </>
          )}
          {draft.baseSha && (
            <button
              className="inline-button"
              disabled={busy}
              onClick={() => ask("unpublish")}
            >
              Unpublish article
            </button>
          )}
          <button
            className="inline-button"
            disabled={busy}
            onClick={() =>
              confirm({
                title: "Recover an interrupted operation?",
                description:
                  "This releases a publishing lock only after 15 minutes. Your private edits are retained. Export them, then reload the latest GitHub revision to reconcile any accepted commit before publishing again.",
                label: "Check and recover",
                run: async () => {
                  try {
                    const latest = await api<Draft>(
                      `/drafts/${draft.id}/recover`,
                      {
                        method: "POST",
                        body: {
                          version: draft.version,
                          confirmation: `recover:${draft.metadata.slug}`,
                        },
                      },
                    );
                    setDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            version: latest.version,
                            originPath: latest.originPath,
                          }
                        : latest,
                    );
                    notify(
                      "Operation checked. Reload latest from GitHub if a publication was interrupted.",
                    );
                  } catch (error) {
                    notify(errorMessage(error), true);
                  }
                },
              })
            }
          >
            Recover interrupted operation
          </button>
          <button
            className="inline-button danger-text"
            disabled={busy}
            onClick={() => ask("delete")}
          >
            <Trash2 size={14} />
            Delete {draft.baseSha ? "article" : "private draft"}
          </button>
          {draft.publishedCommit && (
            <p className="footnote">
              <Check size={12} />
              Committed <code>{draft.publishedCommit.slice(0, 7)}</code>. Check
              Overview for deployment outcome.
            </p>
          )}
        </aside>
      </div>
      <input
        hidden
        type="file"
        ref={imageInput}
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        onChange={(event) => void upload([...(event.target.files ?? [])])}
      />
      <input
        hidden
        type="file"
        ref={coverInput}
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => void upload([...(event.target.files ?? [])], true)}
      />
      {history && (
        <div className="history-panel">
          <div className="panel-title">
            <div>
              <h2>Published revisions</h2>
              <p>
                Restore a previous source revision into this private working
                copy.
              </p>
            </div>
            <button className="button ghost" onClick={() => setHistory(null)}>
              Close
            </button>
          </div>
          {history.length ? (
            history.map((item) => (
              <div className="revision-row" key={item.sha}>
                <div>
                  <code>{item.sha.slice(0, 7)}</code>
                  <strong>{item.commit.message.split("\n")[0]}</strong>
                  <time>{dateTime(item.commit.author.date)}</time>
                </div>
                <button
                  className="button ghost"
                  disabled={busy}
                  onClick={() =>
                    confirm({
                      title: "Restore this revision?",
                      description:
                        "This replaces private changes with the selected published revision. The public article will change only if you publish again.",
                      label: "Restore into draft",
                      run: () => revisionAction("restore", item.sha),
                    })
                  }
                >
                  Restore
                </button>
              </div>
            ))
          ) : (
            <p>No published history returned.</p>
          )}
        </div>
      )}
      <dialog
        ref={previewDialog}
        className="reading-overlay"
        aria-label="Article reading preview"
        onCancel={() => setPreviewOpen(false)}
        onClose={() => setPreviewOpen(false)}
      >
        {previewOpen && (
          <>
            <button
              autoFocus
              className="button ghost"
              onClick={() => setPreviewOpen(false)}
            >
              Close preview
            </button>
            <Suspense fallback={<Loading />}>
              <Preview metadata={draft.metadata} body={draft.body} />
            </Suspense>
          </>
        )}
      </dialog>
    </div>
  );
}
