import type { editor } from "monaco-editor";

export interface FileSwitcherItem {
  label: string;
  description: string;
  model: editor.ITextModel;
}

export interface RecentLocationItem extends FileSwitcherItem {
  lineNumber: number;
  column: number;
}

export type NavBarItem =
  | { kind: "path"; label: string; description: string }
  | ({ kind: "model" } & FileSwitcherItem);

const modelTabs: editor.ITextModel[] = [];
const closedTabStack: editor.ITextModel[] = [];
const recentLocations: RecentLocationItem[] = [];
const maxClosedTabs = 10;
const maxRecentLocations = 12;

export function registerModelTab(model: editor.ITextModel): void {
  if (!modelTabs.includes(model)) {
    modelTabs.push(model);
  }
}

export function switchToModelTab(editor: editor.IStandaloneCodeEditor, oneBasedIndex: number): boolean {
  return switchToModel(editor, modelsForSwitcher(editor)[oneBasedIndex - 1]);
}

export function switchToNextModelTab(editor: editor.IStandaloneCodeEditor): boolean {
  const models = modelsForSwitcher(editor);
  const currentIndex = models.findIndex((model) => model === editor.getModel());
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % models.length;

  return switchToModel(editor, models[nextIndex]);
}

export function switchToPreviousModelTab(editor: editor.IStandaloneCodeEditor): boolean {
  const models = modelsForSwitcher(editor);
  const currentIndex = models.findIndex((model) => model === editor.getModel());
  const previousIndex = currentIndex === -1 ? models.length - 1 : (currentIndex - 1 + models.length) % models.length;

  return switchToModel(editor, models[previousIndex]);
}

export function switchToLastModelTab(editor: editor.IStandaloneCodeEditor): boolean {
  const models = modelsForSwitcher(editor);

  return switchToModel(editor, models.at(-1));
}

export function moveCurrentModelTabRight(editor: editor.IStandaloneCodeEditor): boolean {
  const currentModel = editor.getModel();
  const models = modelsForSwitcher(editor);
  const currentLiveIndex = models.findIndex((model) => model === currentModel);
  const nextModel = models[currentLiveIndex + 1];

  if (!currentModel || !nextModel) {
    editor.focus();
    return false;
  }

  const currentIndex = modelTabs.indexOf(currentModel);
  const nextIndex = modelTabs.indexOf(nextModel);

  if (currentIndex === -1 || nextIndex === -1) {
    editor.focus();
    return false;
  }

  modelTabs[currentIndex] = nextModel;
  modelTabs[nextIndex] = currentModel;
  editor.focus();
  return true;
}

export function reopenClosedTab(editor: editor.IStandaloneCodeEditor): boolean {
  const currentModel = editor.getModel();

  while (closedTabStack.length > 0) {
    const model = closedTabStack.pop();

    if (!model || model.isDisposed() || model === currentModel) {
      continue;
    }

    registerModelTab(model);
    return switchToModel(editor, model, { recordClosedTab: false });
  }

  editor.focus();
  return false;
}

function switchToModel(
  editor: editor.IStandaloneCodeEditor,
  model: editor.ITextModel | undefined,
  options: { recordClosedTab?: boolean } = {},
): boolean {
  if (!model) {
    editor.focus();
    return false;
  }

  if (options.recordClosedTab !== false) {
    recordClosedTabForSwitch(editor, model);
  }

  editor.setModel(model);
  editor.focus();
  return true;
}

function recordClosedTabForSwitch(editor: editor.IStandaloneCodeEditor, targetModel: editor.ITextModel): void {
  const currentModel = editor.getModel();
  const liveRegisteredModels = modelTabs.filter((model) => !model.isDisposed());

  if (
    !currentModel ||
    currentModel === targetModel ||
    currentModel.isDisposed() ||
    !liveRegisteredModels.includes(currentModel) ||
    !liveRegisteredModels.includes(targetModel)
  ) {
    return;
  }

  if (closedTabStack.at(-1) !== currentModel) {
    closedTabStack.push(currentModel);
    closedTabStack.splice(0, Math.max(0, closedTabStack.length - maxClosedTabs));
  }
}

export function openGotoFileSwitcher(editor: editor.IStandaloneCodeEditor): void {
  openModelSwitcher(editor, "Goto File", "maldives-file-switcher", "maldives-file-switcher-item");
}

export function openTabSwitcher(editor: editor.IStandaloneCodeEditor): void {
  openModelSwitcher(editor, "Switcher", "maldives-tab-switcher", "maldives-tab-switcher-item");
}

export function openRecentLocationsOverlay(editor: editor.IStandaloneCodeEditor): void {
  recordCurrentRecentLocation(editor);
  openRecentLocationSwitcher(editor);
}

export function navBarItems(editor: editor.IStandaloneCodeEditor): NavBarItem[] {
  const modelItems = fileSwitcherItems(editor);
  const currentModel = editor.getModel();
  const currentPath = currentModel ? pathForModel(currentModel) : modelItems[0]?.description;
  const pathItems = currentPath
    ? pathSegmentsForPath(currentPath).map((item): NavBarItem => ({ kind: "path", ...item }))
    : [];

  return [...pathItems, ...modelItems.map((item): NavBarItem => ({ kind: "model", ...item }))];
}

export function openShowNavBarOverlay(editor: editor.IStandaloneCodeEditor): void {
  const items = navBarItems(editor);

  if (items.length === 0) {
    editor.focus();
    return;
  }

  document.querySelector(".maldives-nav-bar")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "maldives-nav-bar";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Nav Bar");
  overlay.style.cssText = [
    "position:fixed",
    "top:48px",
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
  heading.textContent = "Nav Bar";
  heading.style.cssText = "padding:10px 12px;border-bottom:1px solid #333;color:#fff;font-weight:600";
  overlay.append(heading);

  const pathRow = document.createElement("div");
  pathRow.style.cssText = "display:flex;gap:6px;align-items:center;padding:8px 12px;border-bottom:1px solid #333;color:#9cdcfe";
  for (const item of items.filter((item) => item.kind === "path")) {
    const segment = document.createElement("span");
    segment.className = "maldives-nav-bar-segment";
    segment.title = item.description;
    segment.textContent = item.label;
    segment.style.cssText = "padding:2px 6px;border-radius:3px;background:#252526";
    pathRow.append(segment);
  }
  overlay.append(pathRow);

  for (const item of items.filter((item): item is { kind: "model" } & FileSwitcherItem => item.kind === "model")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "maldives-nav-bar-item";
    button.setAttribute("aria-label", `${item.label} ${item.description}`);
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
      overlay.remove();
      switchToModel(editor, item.model);
    });
    overlay.append(button);
  }

  document.body.append(overlay);
  overlay.querySelector<HTMLButtonElement>("button")?.focus();
}

export function registerRecentLocationTracking(editor: editor.IStandaloneCodeEditor): { dispose: () => void } {
  recordCurrentRecentLocation(editor);
  const cursorDisposable = editor.onDidChangeCursorPosition(() => recordCurrentRecentLocation(editor));
  const modelDisposable = editor.onDidChangeModel(() => recordCurrentRecentLocation(editor));

  return {
    dispose() {
      cursorDisposable.dispose();
      modelDisposable.dispose();
    },
  };
}

export function recentLocationItems(): RecentLocationItem[] {
  pruneDisposedRecentLocations();
  return [...recentLocations];
}

export function recordCurrentRecentLocation(editor: editor.IStandaloneCodeEditor): void {
  const model = editor.getModel();
  const position = editor.getPosition();

  if (!model || !position || model.isDisposed()) {
    return;
  }

  const baseItem = itemForModel(model);
  const preview = model.getLineContent(position.lineNumber).trim() || baseItem.label;

  addRecentLocation({
    ...baseItem,
    label: preview,
    description: `${baseItem.description}:${position.lineNumber}:${position.column}`,
    lineNumber: position.lineNumber,
    column: position.column,
  });
}

export function selectRecentLocation(editor: editor.IStandaloneCodeEditor, item: RecentLocationItem | undefined): boolean {
  if (!item || item.model.isDisposed()) {
    editor.focus();
    return false;
  }

  editor.setModel(item.model);
  editor.setPosition({ lineNumber: item.lineNumber, column: item.column });
  editor.focus();
  return true;
}

export function moveActiveTabSwitcherItem(direction: "next" | "previous"): void {
  const buttons = tabSwitcherButtons();

  if (buttons.length === 0) {
    return;
  }

  const selectedIndex = buttons.findIndex((button) => button.getAttribute("aria-selected") === "true");
  const focusedIndex = buttons.findIndex((button) => button === document.activeElement);
  const activeIndex = Math.max(0, selectedIndex, focusedIndex);
  const delta = direction === "next" ? 1 : -1;
  const nextIndex = (activeIndex + delta + buttons.length) % buttons.length;

  activateTabSwitcherButton(buttons[nextIndex]);
}

export function applyActiveTabSwitcherItem(): void {
  const buttons = tabSwitcherButtons();

  if (buttons.length === 0) {
    return;
  }

  const activeButton =
    buttons.find((button) => button.getAttribute("aria-selected") === "true") ??
    buttons.find((button) => button === document.activeElement) ??
    buttons[0];

  activeButton.click();
}

function openModelSwitcher(editor: editor.IStandaloneCodeEditor, title: string, overlayClass: string, itemClass: string): void {
  const items = fileSwitcherItems(editor);

  if (items.length === 0) {
    editor.focus();
    return;
  }

  document.querySelector(`.${overlayClass}`)?.remove();

  const overlay = document.createElement("div");
  overlay.className = overlayClass;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", title);
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
  heading.textContent = title;
  heading.style.cssText = "padding:10px 12px;border-bottom:1px solid #333;color:#fff;font-weight:600";
  overlay.append(heading);

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = itemClass;
    button.setAttribute("aria-label", `${item.label} ${item.description}`);
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
    button.addEventListener("focus", () => {
      if (overlayClass === "maldives-tab-switcher") {
        activateTabSwitcherButton(button);
      }
    });
    button.addEventListener("click", () => {
      if (switchToModel(editor, item.model)) {
        overlay.remove();
      }
    });
    overlay.append(button);
  }

  document.body.append(overlay);
  const firstButton = overlay.querySelector("button") as HTMLButtonElement | null;

  if (overlayClass === "maldives-tab-switcher" && firstButton) {
    activateTabSwitcherButton(firstButton);
    editor.focus();
    return;
  }

  firstButton?.focus();
}

function openRecentLocationSwitcher(editor: editor.IStandaloneCodeEditor): void {
  const items = recentLocationItems();

  if (items.length === 0) {
    editor.focus();
    return;
  }

  document.querySelector(".maldives-recent-locations")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "maldives-recent-locations";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Recent Locations");
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
  heading.textContent = "Recent Locations";
  heading.style.cssText = "padding:10px 12px;border-bottom:1px solid #333;color:#fff;font-weight:600";
  overlay.append(heading);

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "maldives-recent-locations-item";
    button.setAttribute("aria-label", `${item.label} ${item.description}`);
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
    button.innerHTML = `<div>${escapeHtml(item.label)}:${item.lineNumber}:${item.column}</div><div style="color:#9cdcfe;font-size:12px">${escapeHtml(item.description)}</div>`;
    button.addEventListener("click", () => {
      selectRecentLocation(editor, item);
      overlay.remove();
    });
    overlay.append(button);
  }

  document.body.append(overlay);
  overlay.querySelector<HTMLButtonElement>("button")?.focus();
}

function addRecentLocation(item: RecentLocationItem): void {
  pruneDisposedRecentLocations();

  const key = recentLocationKey(item);
  const existingIndex = recentLocations.findIndex((existing) => recentLocationKey(existing) === key);

  if (existingIndex !== -1) {
    recentLocations.splice(existingIndex, 1);
  }

  recentLocations.unshift(item);
  recentLocations.splice(maxRecentLocations);
}

function recentLocationKey(item: RecentLocationItem): string {
  return `${item.model.uri.toString()}#${item.lineNumber}:${item.column}`;
}

function pruneDisposedRecentLocations(): void {
  for (let index = recentLocations.length - 1; index >= 0; index -= 1) {
    if (recentLocations[index].model.isDisposed()) {
      recentLocations.splice(index, 1);
    }
  }
}

function tabSwitcherButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".maldives-tab-switcher .maldives-tab-switcher-item"));
}

function activateTabSwitcherButton(button: HTMLButtonElement | undefined): void {
  if (!button) {
    return;
  }

  for (const item of tabSwitcherButtons()) {
    const isActive = item === button;

    item.setAttribute("aria-selected", String(isActive));
    item.style.background = isActive ? "#04395e" : "transparent";
  }

}

export function fileSwitcherItems(editor: editor.IStandaloneCodeEditor): FileSwitcherItem[] {
  return modelsForSwitcher(editor).map(itemForModel);
}

function modelsForSwitcher(editor: editor.IStandaloneCodeEditor): editor.ITextModel[] {
  const registeredModels = modelTabs.filter((model) => !model.isDisposed());

  if (registeredModels.length > 0) {
    return registeredModels;
  }

  const model = editor.getModel();

  return model ? [model] : [];
}

function itemForModel(model: editor.ITextModel): FileSwitcherItem {
  const path = pathForModel(model);
  const label = path.split("/").filter(Boolean).at(-1) || "sample.ts";

  return { label, description: path, model };
}

function pathForModel(model: editor.ITextModel): string {
  return model.uri.scheme === "inmemory" ? "/maldives/sample.ts" : model.uri.path || "/maldives/sample.ts";
}

function pathSegmentsForPath(path: string): Array<{ label: string; description: string }> {
  const segments = path.split("/").filter(Boolean);

  return segments.map((label, index) => ({
    label,
    description: `/${segments.slice(0, index + 1).join("/")}`,
  }));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

    return entities[character] ?? character;
  });
}
