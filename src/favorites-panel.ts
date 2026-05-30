import type { editor } from "monaco-editor";

export type FavoritesActionId = "AddToFavoritesPopup";

export interface FavoritesPanelContext {
  uri: string;
  source: string;
  lineNumber: number;
  lineContent: string;
}

export interface FavoriteItem {
  uri: string;
  lineNumber: number;
  label: string;
  preview: string;
}

export interface FavoritesPanelSnapshot {
  activeActionId: FavoritesActionId;
  title: string;
  items: FavoriteItem[];
  details: string[];
}

const titles: Record<FavoritesActionId, string> = {
  AddToFavoritesPopup: "Add to Favorites",
};

const actionIds = new Set(Object.keys(titles));

export class FavoritesPanelController {
  private items: FavoriteItem[] = [];
  private snapshotState: FavoritesPanelSnapshot | undefined;

  constructor(private readonly onChange: () => void = () => undefined) {}

  runAction(actionId: string, context: FavoritesPanelContext): boolean {
    if (!isFavoritesActionId(actionId)) return false;

    const item = favoriteItemFromContext(context);
    this.items = [item, ...this.items.filter((existing) => existing.uri !== item.uri || existing.lineNumber !== item.lineNumber)];
    this.snapshotState = {
      activeActionId: actionId,
      title: titles[actionId],
      items: [...this.items],
      details: detailsFor(context, this.items),
    };
    this.onChange();
    return true;
  }

  snapshot(): FavoritesPanelSnapshot | undefined {
    return this.snapshotState
      ? {
          ...this.snapshotState,
          items: this.snapshotState.items.map((item) => ({ ...item })),
          details: [...this.snapshotState.details],
        }
      : undefined;
  }
}

export const createFavoritesPanelController = (onChange?: () => void): FavoritesPanelController => new FavoritesPanelController(onChange);
export const favoritesPanelTitleForAction = (actionId: string): string | undefined => (isFavoritesActionId(actionId) ? titles[actionId] : undefined);
export const isFavoritesActionId = (actionId: string): actionId is FavoritesActionId => actionIds.has(actionId);

export function contextFromEditor(editor: editor.IStandaloneCodeEditor): FavoritesPanelContext | undefined {
  const model = editor.getModel();
  const position = editor.getPosition();

  if (!model || !position) return undefined;

  return {
    uri: model.uri.toString(),
    source: model.getValue(),
    lineNumber: position.lineNumber,
    lineContent: model.getLineContent(position.lineNumber),
  };
}

export function installFavoritesPanelController(host: HTMLElement): FavoritesPanelController {
  const controller = createFavoritesPanelController(() => renderFavoritesPanel(host, controller));
  return controller;
}

function favoriteItemFromContext(context: FavoritesPanelContext): FavoriteItem {
  return {
    uri: context.uri,
    lineNumber: context.lineNumber,
    label: `${fileNameFromUri(context.uri)}:${context.lineNumber}`,
    preview: context.lineContent.trim(),
  };
}

function detailsFor(context: FavoritesPanelContext, items: FavoriteItem[]): string[] {
  const latest = items[0];
  return [
    `Favorites: ${items.length}`,
    latest ? `Latest: ${latest.label}` : "Latest: none",
    latest ? `Preview: ${latest.preview}` : "Preview: none",
    `Current file: ${context.uri}`,
    `Complex file lines: ${lineCount(context.source)}`,
  ];
}

function renderFavoritesPanel(host: HTMLElement, controller: FavoritesPanelController): void {
  host.querySelector(".maldives-favorites-panel")?.remove();
  const snapshot = controller.snapshot();
  if (!snapshot) return;

  const panel = document.createElement("section");
  panel.className = "maldives-favorites-panel";
  panel.setAttribute("role", "complementary");
  panel.setAttribute("aria-label", "Favorites Panel");
  panel.style.cssText = "position:fixed;right:16px;top:64px;width:min(560px,calc(100vw - 32px));z-index:9130;background:#1f2420;color:#d4d4d4;border:1px solid #4a4a4a;box-shadow:0 12px 32px rgba(0,0,0,.45);font:13px JetBrains Mono, monospace";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;background:#293029";
  const title = document.createElement("strong");
  title.className = "maldives-favorites-title";
  title.textContent = snapshot.title;
  title.style.cssText = "color:#fff;flex:1";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "background:#2d2d2d;color:#d4d4d4;border:1px solid #555;padding:4px 8px;cursor:pointer";
  close.addEventListener("click", () => panel.remove());
  header.append(title, close);

  const body = document.createElement("div");
  body.className = "maldives-favorites-body";
  body.style.cssText = "display:grid;gap:6px;padding:12px;line-height:1.4";
  for (const detail of snapshot.details) {
    const row = document.createElement("div");
    row.className = "maldives-favorites-row";
    row.textContent = detail;
    body.append(row);
  }
  for (const item of snapshot.items) {
    const row = document.createElement("div");
    row.className = "maldives-favorites-item";
    row.textContent = `${item.label} — ${item.preview}`;
    row.style.cssText = "padding-top:6px;border-top:1px solid #333;color:#e8f0e8";
    body.append(row);
  }

  panel.append(header, body);
  host.append(panel);
}

function fileNameFromUri(uri: string): string {
  return decodeURIComponent(uri.split("/").pop() ?? uri);
}

function lineCount(source: string): number {
  return source.trimEnd().split(/\r?\n/).length;
}
