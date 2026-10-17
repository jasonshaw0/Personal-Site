---
title: "Example draft: a technical note"
description: "An unpublished formatting reference for writing and reviewing technical articles."
slug: formatting-example
date: 2026-10-16
status: draft
tags: [Software, Engineering]
toc: true
---

This is an **example draft**, not a published article. It exists to demonstrate the available formatting. Replace this content before publishing.

## Start with the question

A good technical note explains what is being built, what constraints matter, and how the result was checked. Use [descriptive links](https://developer.mozilla.org/) and `inline code` where useful.

> Record the reasoning while the details are still fresh.

## Make the behavior concrete

```typescript
type Measurement = { expected: number; actual: number }

export function withinTolerance(value: Measurement, tolerance = 0.01) {
  return Math.abs(value.expected - value.actual) <= tolerance
}
```

### Explain the tradeoffs

| Approach | Useful when | Tradeoff |
| --- | --- | --- |
| Static content | Changes happen at publication | Requires a rebuild |
| Dynamic content | Changes happen per request | Requires a runtime |

1. Define the expected behavior.
2. Run the smallest useful experiment.
3. Record what the evidence supports.

- Keep the editable source.
- Distinguish measured results from assumptions.
- Include the limits of the experiment.

## Show the system

<figure>
  <svg viewBox="0 0 680 160" role="img" aria-label="Markdown source flows through the build to a static page" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="#667f73"><rect x="1" y="30" width="180" height="100" rx="4"/><rect x="250" y="30" width="180" height="100" rx="4"/><rect x="499" y="30" width="180" height="100" rx="4"/><path d="M181 80H245m-10-8 10 8-10 8M430 80H494m-10-8 10 8-10 8"/></g>
    <g fill="#bfd4cd" font-family="monospace" font-size="17" text-anchor="middle"><text x="90" y="86">Markdown</text><text x="340" y="86">Build</text><text x="589" y="86">Static page</text></g>
  </svg>
  <figcaption>An inline SVG stays sharp and scales to the reading column.</figcaption>
</figure>

Images can use standard Markdown: `![Descriptive alt text](/blog/images/your-image.webp)`. Store those files in `public/blog/images/`.

For captions, use a `<figure>` with an `<img>` and `<figcaption>`. Video and audio can use native `<video controls>` and `<audio controls>`. For an external embed, use a titled iframe with `loading="lazy"` and an appropriate `allow`/`sandbox` policy. Use MDX only when a custom component is needed.

## Record the result

Conclude with the observation and any next steps. This example makes no claims about completed projects or production results.
