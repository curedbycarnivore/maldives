import type { editor } from "monaco-editor";

interface FileSwitcherItem {
  label: string;
  description: string;
  model: editor.ITextModel;
}

export function openGotoFileSwitcher(editor: editor.IStandaloneCodeEditor): void {
  const items = fileSwitcherItems(editor);

  if (items.length === 0) {
    editor.focus();
    return;
  }

  document.querySelector(".maldives-file-switcher")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "maldives-file-switcher";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Goto File");
  overlay.style.cssText = [
    "position:fixed",
    "top:72px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:10000",
    "width:min(560px, calc(100vw - 32px))",
    "background:#1e1e1e",
    "color:#d4d4d4",
    "border:1px solid #454545",
    "box-shadow:0 12px 32px rgba(0,0,0,.45)",
    "font:13px system-ui, sans-serif",
  ].join(";");

  const heading = document.createElement("div");
  heading.textContent = "Goto File";
  heading.style.cssText = "padding:10px 12px;border-bottom:1px solid #333;color:#fff;font-weight:600";
  overlay.append(heading);

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "maldives-file-switcher-item";
    button.style.cssText = [
      "display:block",
      "width:100%",
      "padding:10px 12px",
      "border:0",
      "background:transparent",
      "color:inherit",
      "text-align:left",
      "cursor:pointer",
    ].join(";");
    button.innerHTML = `<div>${escapeHtml(item.label)}</div><div style="color:#9cdcfe;font-size:12px">${escapeHtml(item.description)}</div>`;
    button.addEventListener("click", () => {
      editor.setModel(item.model);
      overlay.remove();
      editor.focus();
    });
    overlay.append(button);
  }

  document.body.append(overlay);
  (overlay.querySelector("button") as HTMLButtonElement | null)?.focus();
}

export function fileSwitcherItems(editor: editor.IStandaloneCodeEditor): FileSwitcherItem[] {
  const model = editor.getModel();

  return model ? [itemForModel(model)] : [];
}

function itemForModel(model: editor.ITextModel): FileSwitcherItem {
  const path = model.uri.path || "/maldives/sample.ts";
  const label = path.split("/").filter(Boolean).at(-1) || "sample.ts";

  return { label, description: path, model };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

    return entities[character] ?? character;
  });
}
