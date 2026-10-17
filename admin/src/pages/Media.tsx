import { useRef, useState } from "react";
import { Copy, ImagePlus, Trash2 } from "lucide-react";
import { api, dateTime, errorMessage, uploadImage } from "../api";
import { useResource } from "../hooks";
import type { Media } from "../types";
import type { Confirmation } from "../components/UI";
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  Notice,
  PageHeading,
} from "../components/UI";
export default function MediaLibrary({
  notify,
  confirm,
}: {
  notify: (message: string, error?: boolean) => void;
  confirm: (value: Confirmation) => void;
}) {
  const resource = useResource<Media[]>("/media"),
    input = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of files) await uploadImage(file);
      notify(
        "Images uploaded privately. They will enter GitHub only when used by a published article.",
      );
      resource.refresh();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="CONTENT / MEDIA"
        title="The visual library."
        description="Private uploads for diagrams, project images, and article covers."
        action={
          <button
            className="button primary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={15} />
            {busy ? "Uploading…" : "Upload images"}
          </button>
        }
      />
      <input
        hidden
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        onChange={(event) => void upload(event.target.files)}
      />
      <Notice>
        <p>
          PNG, JPEG, WebP, and GIF · up to 1 MiB per image. Uploaded files stay
          private until an article references them in a publication. Published
          assets are retained to protect existing links.
        </p>
      </Notice>
      {resource.error && (
        <ErrorNotice message={resource.error} onRetry={resource.refresh} />
      )}{" "}
      {resource.loading ? (
        <Loading />
      ) : !resource.data?.length ? (
        <Empty
          title="Room for the details."
          action={
            <button
              className="button ghost"
              onClick={() => input.current?.click()}
            >
              Upload your first image ↗
            </button>
          }
        >
          Add a diagram, a screenshot, or a photograph to accompany your
          writing.
        </Empty>
      ) : (
        <div className="media-grid">
          {resource.data.map((item) => (
            <article className="media-card" key={item.id}>
              <div className="media-image">
                <img
                  loading="lazy"
                  src={`/api/media/${item.id}`}
                  alt={item.name}
                />
              </div>
              <div className="media-details">
                <h2 title={item.name}>{item.name}</h2>
                <div>
                  <Badge tone={item.public_path ? "good" : ""}>
                    {item.public_path ? "Published" : "Private"}
                  </Badge>
                  <span>{Math.ceil(item.size / 1024)} KiB</span>
                </div>
                <time>{dateTime(item.created_at)}</time>
                <div className="media-actions">
                  <button
                    className="inline-button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(
                          `![${item.name.replace(/\.[^.]+$/, "")}](${item.public_path ?? `/api/media/${item.id}`})`,
                        )
                        .then(
                          () => notify("Markdown image reference copied."),
                          () => notify("Clipboard access was denied.", true),
                        );
                    }}
                  >
                    <Copy size={13} />
                    Copy Markdown
                  </button>
                  <button
                    className="icon-button danger-text"
                    aria-label={`Delete ${item.name}`}
                    disabled={Boolean(item.public_path)}
                    title={
                      item.public_path
                        ? "Published assets are retained to protect existing links"
                        : "Delete unused image"
                    }
                    onClick={() =>
                      confirm({
                        title: "Delete this image?",
                        description: `“${item.name}” will be removed from private storage. Referenced images cannot be deleted.`,
                        label: "Delete image",
                        danger: true,
                        run: async () => {
                          try {
                            await api(`/media/${item.id}`, {
                              method: "DELETE",
                              body: { confirmation: `delete:${item.id}` },
                            });
                            notify("Image deleted.");
                            resource.refresh();
                          } catch (error) {
                            notify(errorMessage(error), true);
                          }
                        },
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
