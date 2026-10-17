import { useEffect, useState } from "react";
import type { Metadata } from "../../shared/content";
import blogCss from "../../../blog/styles/blog.css?inline";
import tokens from "../../../src/tokens.css?inline";
import sans from "@fontsource-variable/instrument-sans/index.css?inline";
import syne from "@fontsource-variable/syne/index.css?inline";
import mono from "@fontsource/ibm-plex-mono/latin-400.css?inline";
import { errorMessage } from "../api";
import { readingMinutes } from "../../shared/content";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const imageURL = (value: string) =>
  value.startsWith("/") && !value.startsWith("/api/media/")
    ? `https://www.jason-shaw.com${value}`
    : value;
export default function Preview({
  metadata,
  body,
}: {
  metadata: Metadata;
  body: string;
}) {
  const [html, setHTML] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void import("../preview-renderer")
        .then((module) => module.renderMarkdown(body))
        .then(
          (result) => {
            if (active) {
              setHTML(
                result.replace(
                  /(src|poster|href)="(\/(?!api\/media\/)[^"]*)"/g,
                  '$1="https://www.jason-shaw.com$2"',
                ),
              );
              setError("");
            }
          },
          (error) => {
            if (active) setError(errorMessage(error));
          },
        );
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [body]);
  const date = new Date(metadata.date);
  const source = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; media-src 'self' https:; frame-src https:; base-uri 'none'"><style>${sans}${syne}${mono}${tokens}${blogCss}body{min-width:0}.preview-page{padding:36px 26px;max-width:820px;margin:auto}.article-header h1{font-size:38px}.article-deck{font-size:18px}.prose{font-size:17px}.preview-label{font:10px var(--mono);color:var(--accent);margin-bottom:28px}</style></head><body><main class="preview-page"><div class="preview-label">PRIVATE PREVIEW · PUBLIC ARTICLE STYLES</div><header class="article-header"><div class="article-tags">${metadata.tags.map((tag) => `<span>${escape(tag)}</span>`).join("")}</div><h1>${escape(metadata.title || "Untitled note")}</h1><p class="article-deck">${escape(metadata.description)}</p><div class="article-byline"><span>Jason Shaw</span><span>${Number.isFinite(date.valueOf()) ? escape(date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })) : "Publication date"}</span><span>${readingMinutes(body)} min read</span></div></header>${metadata.cover ? `<figure class="article-cover"><img src="${escape(imageURL(metadata.cover))}" alt="${escape(metadata.coverAlt)}">${metadata.coverCaption ? `<figcaption>${escape(metadata.coverCaption)}</figcaption>` : ""}</figure>` : ""}<div class="prose">${html}</div></main></body></html>`;
  return (
    <div className="preview-pane">
      {error ? (
        <p className="preview-error">Preview unavailable: {error}</p>
      ) : (
        <iframe
          title="Private article preview"
          sandbox="allow-same-origin"
          srcDoc={source}
        />
      )}
    </div>
  );
}
