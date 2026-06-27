import CodeMirror from "@uiw/react-codemirror";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { parse } from "@sygil/sysml-notation";
import { useSygil } from "../store/sygilStore.js";

/** Diagnostics come straight from the parser — the same parser that drives the diagram. */
const sysmlLinter = linter((view): Diagnostic[] => {
  const { errors } = parse(view.state.doc.toString());
  return errors.map((e) => ({
    from: Math.min(e.start, view.state.doc.length),
    to: Math.min(Math.max(e.end, e.start + 1), view.state.doc.length),
    severity: "error",
    message: e.message,
  }));
});

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
});

export function TextEditor({ theme }: { theme: "light" | "dark" }) {
  const text = useSygil((s) => s.text);
  const setText = useSygil((s) => s.setTextFromEditor);
  return (
    <CodeMirror
      value={text}
      height="100%"
      style={{ height: "100%" }}
      extensions={[lintGutter(), sysmlLinter, editorTheme, EditorView.lineWrapping]}
      onChange={setText}
      basicSetup={{ foldGutter: false }}
      theme={theme}
    />
  );
}
