import type { MaldivesWorkspace, WorkspacePane } from "./workspace";

type WorkspaceForSplits = Pick<
  MaldivesWorkspace,
  "panes" | "model" | "switchTo" | "movePane" | "onDidChange" | "activeUri"
>;

export interface WorkspaceSplitItem extends WorkspacePane {
  readonly label: string;
  readonly active: boolean;
  readonly preview: string;
}

export function workspaceSplitItems(workspace: Pick<WorkspaceForSplits, "panes" | "model" | "activeUri">): WorkspaceSplitItem[] {
  return workspace.panes().map((pane) => ({
    ...pane,
    label: labelForUri(pane.uri),
    active: pane.uri === workspace.activeUri,
    preview: previewForModel(workspace.model(pane.uri)),
  }));
}

export function installWorkspaceSplitLayout(container: HTMLElement, workspace: WorkspaceForSplits): { dispose: () => void } {
  container.querySelector(".maldives-workspace-split-layout")?.remove();

  const root = document.createElement("div");
  root.className = "maldives-workspace-split-layout";
  root.setAttribute("aria-label", "Workspace split panes");
  root.style.cssText = [
    "position:fixed",
    "top:34px",
    "left:0",
    "right:0",
    "min-height:94px",
    "z-index:10001",
    "display:flex",
    "gap:6px",
    "padding:6px",
    "box-sizing:border-box",
    "background:rgba(37,37,38,0.96)",
    "border-bottom:1px solid #3c3c3c",
    "font:12px JetBrains Mono,monospace",
    "pointer-events:auto",
    "overflow-x:auto",
  ].join(";");

  const render = () => {
    const items = workspaceSplitItems(workspace);
    root.style.display = items.length > 1 ? "flex" : "none";
    root.replaceChildren(...items.map((item, index) => renderPane(item, index, workspace)));
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

function renderPane(item: WorkspaceSplitItem, index: number, workspace: Pick<WorkspaceForSplits, "switchTo" | "movePane">): HTMLElement {
  const pane = document.createElement("button");
  pane.type = "button";
  pane.className = "maldives-workspace-split-pane";
  pane.draggable = true;
  pane.dataset.paneId = item.id;
  pane.dataset.index = String(index);
  pane.setAttribute("aria-label", `${item.direction} split ${item.label}`);
  pane.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "align-items:stretch",
    "gap:4px",
    "min-width:220px",
    "max-width:360px",
    "height:82px",
    "padding:7px",
    "border:1px solid #555",
    "border-radius:4px",
    `background:${item.active ? "#1e1e1e" : "#2d2d2d"}`,
    `color:${item.active ? "#ffffff" : "#cccccc"}`,
    "text-align:left",
    "cursor:grab",
  ].join(";");

  const title = document.createElement("span");
  title.className = "maldives-workspace-split-pane-title";
  title.textContent = `${item.direction} · ${item.label}`;
  title.style.cssText = "font-weight:700;color:#d7ba7d";

  const preview = document.createElement("pre");
  preview.className = "maldives-workspace-split-pane-preview";
  preview.textContent = item.preview;
  preview.style.cssText = "margin:0;overflow:hidden;white-space:pre-wrap;color:#cccccc;line-height:1.2";

  pane.append(title, preview);
  pane.addEventListener("click", () => workspace.switchTo(item.uri));
  pane.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", item.id);
    event.dataTransfer?.setData("application/x-maldives-pane", item.id);
  });
  pane.addEventListener("dragover", (event) => event.preventDefault());
  pane.addEventListener("drop", (event) => {
    event.preventDefault();
    const paneId = event.dataTransfer?.getData("application/x-maldives-pane") || event.dataTransfer?.getData("text/plain");

    if (paneId) {
      workspace.movePane(paneId, index);
    }
  });

  return pane;
}

function previewForModel(model: { getValue?: () => string } | undefined): string {
  const value = model?.getValue?.() ?? "";
  const meaningful = value.split(/\r?\n/).filter((line) => line.trim().length > 0);

  return meaningful.slice(0, 4).join("\n");
}

function labelForUri(uri: string): string {
  return uri.replace(/^file:\/\//, "").split("/").filter(Boolean).at(-1) ?? uri;
}
