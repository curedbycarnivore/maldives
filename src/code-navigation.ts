import type { editor } from "monaco-editor";

export type CodeNavigationKind = "gotoSuperMethod" | "gotoTest" | "methodHierarchy";

export interface NavigationNode {
  text: string;
  spans?: Array<{ start: number; length: number }>;
  childItems?: NavigationNode[];
}

export interface CodeNavigationContent {
  title: string;
  primary: string;
  detail: string;
}

type MonacoGlobal = typeof import("monaco-editor");

const labels: Record<CodeNavigationKind, string> = {
  gotoSuperMethod: "Goto Super Method",
  gotoTest: "Goto Test",
  methodHierarchy: "Method Hierarchy",
};

export function buildCodeNavigationContent(kind: CodeNavigationKind, symbolName: string | undefined): CodeNavigationContent {
  const title = labels[kind];
  const symbol = symbolName ? `TypeScript symbol: ${symbolName}` : "TypeScript symbol: unavailable";
  const details: Record<CodeNavigationKind, string> = {
    gotoSuperMethod: "Standalone Monaco can inspect the current TypeScript symbol, but has no override/super-method index for this model.",
    gotoTest: "Standalone Monaco can inspect the current TypeScript symbol, but has no project-wide test index yet.",
    methodHierarchy: "Standalone Monaco can inspect current-document TypeScript symbols; full method hierarchy needs an IDE-shell index.",
  };

  return { title, primary: symbol, detail: details[kind] };
}

export function symbolNameAtOffset(node: NavigationNode, offset: number): string | undefined {
  if (!nodeContainsOffset(node, offset)) {
    return undefined;
  }

  for (const child of node.childItems ?? []) {
    const childMatch = symbolNameAtOffset(child, offset);

    if (childMatch) {
      return childMatch;
    }
  }

  return node.text;
}

export function openCodeNavigationOverlay(editor: editor.IStandaloneCodeEditor, kind: CodeNavigationKind): void {
  document.querySelector(".maldives-code-navigation")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "maldives-code-navigation";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", labels[kind]);
  overlay.style.cssText = [
    "position:fixed",
    "top:72px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:10000",
    "width:min(460px, calc(100vw - 32px))",
    "background:#1e1e1e",
    "color:#d4d4d4",
    "border:1px solid #454545",
    "box-shadow:0 12px 32px rgba(0,0,0,.45)",
    "font:13px system-ui, sans-serif",
    "padding:12px",
  ].join(";");

  const heading = document.createElement("div");
  heading.style.cssText = "color:#fff;font-weight:600;margin-bottom:6px";

  const primary = document.createElement("div");
  primary.style.cssText = "line-height:1.4";

  const detail = document.createElement("div");
  detail.style.cssText = "line-height:1.4;margin-top:6px;color:#bdbdbd";

  renderContent(kind, undefined, heading, primary, detail);
  overlay.append(heading, primary, detail);
  document.body.append(overlay);

  void currentTypeScriptSymbol(editor).then((symbol) => {
    renderContent(kind, symbol, heading, primary, detail);
  });

  editor.focus();
}

function renderContent(
  kind: CodeNavigationKind,
  symbol: string | undefined,
  heading: HTMLElement,
  primary: HTMLElement,
  detail: HTMLElement,
): void {
  const content = buildCodeNavigationContent(kind, symbol);

  heading.textContent = content.title;
  primary.textContent = content.primary;
  detail.textContent = content.detail;
}

function nodeContainsOffset(node: NavigationNode, offset: number): boolean {
  return (node.spans ?? []).some((span) => span.start <= offset && offset <= span.start + span.length);
}

async function currentTypeScriptSymbol(editor: editor.IStandaloneCodeEditor): Promise<string | undefined> {
  const monacoApi = (globalThis as typeof globalThis & { __monaco?: MonacoGlobal }).__monaco;
  const model = editor.getModel();
  const position = editor.getPosition();

  if (!monacoApi || !model || !position) {
    return undefined;
  }

  try {
    const getWorker = await monacoApi.languages.typescript.getTypeScriptWorker();
    const worker = await getWorker(model.uri);
    const tree = (await worker.getNavigationTree(model.uri.toString())) as NavigationNode;

    return symbolNameAtOffset(tree, model.getOffsetAt(position));
  } catch {
    return undefined;
  }
}
