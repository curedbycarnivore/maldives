import type { MaldivesWorkspace } from "./workspace";

export interface WorkspaceTabItem {
  readonly uri: string;
  readonly label: string;
  readonly active: boolean;
  readonly dirty: boolean;
}

type WorkspaceForTabs = Pick<MaldivesWorkspace, "uris" | "activeUri" | "isDirty" | "switchTo" | "close" | "onDidChange">;

export function workspaceTabItems(workspace: Pick<MaldivesWorkspace, "uris" | "activeUri" | "isDirty">): WorkspaceTabItem[] {
  return workspace.uris().map((uri) => ({
    uri,
    label: labelForUri(uri),
    active: uri === workspace.activeUri,
    dirty: workspace.isDirty(uri),
  }));
}

export function installWorkspaceTabStrip(container: HTMLElement, workspace: WorkspaceForTabs): { dispose: () => void } {
  container.querySelector(".maldives-workspace-tabs")?.remove();

  const root = document.createElement("div");
  root.className = "maldives-workspace-tabs";
  root.setAttribute("role", "tablist");
  root.setAttribute("aria-label", "Open workspace files");
  root.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "right:0",
    "height:34px",
    "z-index:10002",
    "display:flex",
    "align-items:stretch",
    "background:#252526",
    "border-bottom:1px solid #3c3c3c",
    "font:12px system-ui,sans-serif",
    "overflow-x:auto",
  ].join(";");

  const render = () => {
    root.replaceChildren(...workspaceTabItems(workspace).map((item) => renderTab(item, workspace)));
  };

  const subscription = workspace.onDidChange(render);
  render();
  container.append(root);

  return {
    dispose() {
      subscription.dispose();
      root.remove();
    },
  };
}

function renderTab(item: WorkspaceTabItem, workspace: Pick<MaldivesWorkspace, "switchTo" | "close">): HTMLElement {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "maldives-workspace-tab";
  tab.dataset.uri = item.uri;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", String(item.active));
  tab.title = item.uri;
  tab.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:6px",
    "min-width:0",
    "max-width:220px",
    "padding:0 8px",
    "border:0",
    "border-right:1px solid #3c3c3c",
    `background:${item.active ? "#1e1e1e" : "#2d2d2d"}`,
    `color:${item.active ? "#ffffff" : "#cccccc"}`,
    "cursor:pointer",
  ].join(";");

  const label = document.createElement("span");
  label.className = "maldives-workspace-tab-label";
  label.textContent = item.label;
  label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

  tab.append(label);

  if (item.dirty) {
    const dirty = document.createElement("span");
    dirty.className = "maldives-workspace-tab-dirty";
    dirty.textContent = "●";
    dirty.setAttribute("aria-label", "dirty");
    dirty.style.cssText = "color:#d7ba7d;font-size:10px";
    tab.append(dirty);
  }

  const close = document.createElement("span");
  close.className = "maldives-workspace-tab-close";
  close.setAttribute("role", "button");
  close.setAttribute("aria-label", `Close ${item.label}`);
  close.textContent = "×";
  close.style.cssText = "padding:0 2px;color:#aaaaaa";
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    workspace.close(item.uri);
  });

  tab.append(close);
  tab.addEventListener("click", () => workspace.switchTo(item.uri));
  return tab;
}

function labelForUri(uri: string): string {
  const path = uri.replace(/^file:\/\//, "");

  return path.split("/").filter(Boolean).at(-1) ?? uri;
}
