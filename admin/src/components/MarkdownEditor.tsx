import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";

export type Insert = (
  before: string,
  after?: string,
  placeholder?: string,
  uploaded?: boolean,
) => void;
export default function MarkdownEditor({
  value,
  onChange,
  onUpload,
  readOnly,
  disabled,
  onReady,
}: {
  value: string;
  onChange: (value: string) => void;
  onUpload: (files: File[]) => void;
  readOnly: boolean;
  disabled: boolean;
  onReady: (insert: Insert) => void;
}) {
  const parent = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null),
    change = useRef(onChange),
    upload = useRef(onUpload),
    editable = useRef(new Compartment()),
    sourceReadOnly = useRef(readOnly);
  change.current = onChange;
  upload.current = onUpload;
  sourceReadOnly.current = readOnly;
  useEffect(() => {
    if (!parent.current) return;
    const insert: Insert = (
      before,
      after = "",
      placeholder = "text",
      uploaded = false,
    ) => {
      const editor = view.current;
      if (
        !editor ||
        sourceReadOnly.current ||
        (editor.state.readOnly && !uploaded)
      )
        return;
      const selection = editor.state.selection.main,
        text =
          editor.state.sliceDoc(selection.from, selection.to) || placeholder;
      editor.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: before + text + after,
        },
        selection: {
          anchor: selection.from + before.length,
          head: selection.from + before.length + text.length,
        },
      });
      editor.focus();
    };
    const size = Number(localStorage.getItem("admin.editor.font") ?? 13);
    const editor = new EditorView({
      parent: parent.current,
      doc: value,
      extensions: [
        basicSetup,
        markdown({ codeLanguages: languages }),
        oneDark,
        editable.current.of([
          EditorState.readOnly.of(readOnly || disabled),
          EditorView.editable.of(!readOnly && !disabled),
        ]),
        ...(localStorage.getItem("admin.editor.wrap") === "false"
          ? []
          : [EditorView.lineWrapping]),
        EditorView.contentAttributes.of({
          "aria-label": "Markdown article body",
          spellcheck: "true",
        }),
        EditorView.theme(
          {
            "&": {
              height: "100%",
              backgroundColor: "#141719",
              fontSize: `${Math.max(12, Math.min(18, size))}px`,
            },
            ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.8" },
            ".cm-gutters": {
              backgroundColor: "#141719",
              color: "#64716d",
              borderRight: "1px solid #303538",
            },
            ".cm-content": { padding: "22px 0" },
            ".cm-line": { padding: "0 22px" },
            "&.cm-focused": { outline: "none" },
          },
          { dark: true },
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) change.current(update.state.doc.toString());
        }),
        keymap.of([
          {
            key: "Mod-b",
            run: () => {
              insert("**", "**");
              return true;
            },
          },
          {
            key: "Mod-i",
            run: () => {
              insert("*", "*");
              return true;
            },
          },
          {
            key: "Mod-k",
            run: () => {
              insert("[", "](https://)", "link text");
              return true;
            },
          },
        ]),
        EditorView.domEventHandlers({
          paste: (event) => {
            if (view.current?.state.readOnly) return false;
            const files = [...(event.clipboardData?.files ?? [])].filter(
              (file) => file.type.startsWith("image/"),
            );
            if (!files.length) return false;
            event.preventDefault();
            upload.current(files);
            return true;
          },
          drop: (event) => {
            if (view.current?.state.readOnly) return false;
            const files = [...(event.dataTransfer?.files ?? [])].filter(
              (file) => file.type.startsWith("image/"),
            );
            if (!files.length) return false;
            event.preventDefault();
            upload.current(files);
            return true;
          },
        }),
      ],
    });
    view.current = editor;
    onReady(insert);
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The document is synchronized below; creating a view on every keystroke loses selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
      });
  }, [value]);
  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorState.readOnly.of(readOnly || disabled),
        EditorView.editable.of(!readOnly && !disabled),
      ]),
    });
  }, [readOnly, disabled]);
  return <div ref={parent} className="markdown-editor" />;
}
