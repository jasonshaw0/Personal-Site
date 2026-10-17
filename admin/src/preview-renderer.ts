import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, {
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "figure",
      "figcaption",
      "svg",
      "g",
      "path",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "text",
      "tspan",
      "defs",
      "marker",
      "linearGradient",
      "stop",
      "clipPath",
      "video",
      "audio",
      "source",
    ],
    attributes: {
      ...defaultSchema.attributes,
      "*": [...(defaultSchema.attributes?.["*"] ?? []), "role", "ariaLabel"],
      svg: ["viewBox", "width", "height", "fill", "xmlns"],
      g: ["fill", "stroke", "strokeWidth", "transform"],
      path: ["d", "fill", "stroke", "strokeWidth", "transform"],
      rect: ["x", "y", "width", "height", "rx", "fill", "stroke"],
      circle: ["cx", "cy", "r", "fill", "stroke"],
      line: ["x1", "x2", "y1", "y2", "stroke"],
      text: ["x", "y", "fill", "fontFamily", "fontSize", "textAnchor"],
      video: ["src", "controls", "poster", "width", "height"],
      audio: ["src", "controls"],
      source: ["src", "type"],
      code: [
        ...(defaultSchema.attributes?.code ?? []),
        ["className", /^language-/],
      ],
    },
  })
  .use(rehypeShiki, {
    theme: "github-dark-dimmed",
    langs: [
      "typescript",
      "tsx",
      "javascript",
      "jsx",
      "json",
      "css",
      "html",
      "bash",
      "python",
      "cpp",
      "c",
      "sql",
      "yaml",
      "markdown",
      "diff",
      "rust",
      "go",
    ],
    fallbackLanguage: "text",
    defaultLanguage: "text",
  })
  .use(rehypeStringify);
export async function renderMarkdown(markdown: string) {
  return String(await processor.process(markdown));
}
