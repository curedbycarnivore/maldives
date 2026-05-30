export type ToolWindowId =
  | "database" | "debug" | "electrojun" | "favorites" | "find" | "messages"
  | "run" | "services" | "todo" | "terminal" | "version-control" | "youtrack";

export interface ToolWindowDefinition { id: ToolWindowId; title: string; body: string }
export interface ToolWindowSnapshot extends ToolWindowDefinition { compact: boolean }

type ToolWindowSeed = readonly [ToolWindowId, string, string];

const seeds: ToolWindowSeed[] = [
  ["terminal", "Terminal", "Integrated terminal action is wired. Shell transport is owned by the terminal backend ring."],
  ["version-control", "Version Control", "VCS tool-window action is wired. Git/diff operations are owned by the VCS subsystem ring."],
  ["debug", "Debug", "Debug tool-window action is wired. Run/debug execution is owned by the debug subsystem ring."],
  ["run", "Run", "Run tool-window action is wired. Run configuration execution is owned by the debug subsystem ring."],
  ["database", "Database", "Database tool-window action is wired for IDE-shell parity."],
  ["electrojun", "ElectroJun", "ElectroJun tool-window action is wired for IDE-shell parity."],
  ["favorites", "Favorites", "Favorites tool-window action is wired. Favorites content is owned by the favorites subsystem ring."],
  ["find", "Find", "Find tool-window action is wired. Project search is owned by the find-in-files ring."],
  ["messages", "Messages", "Messages tool-window action is wired for IDE-shell parity."],
  ["services", "Services", "Services tool-window action is wired for IDE-shell parity."],
  ["todo", "TODO", "TODO tool-window action is wired for IDE-shell parity."],
  ["youtrack", "YouTrack", "YouTrack tool-window action is wired for IDE-shell parity."],
];

const definitions = seeds.map(([id, title, body]): ToolWindowDefinition => ({ id, title, body }));
const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
const idsByAction = new Map<string, ToolWindowId>([
  ["ActivateDatabaseToolWindow", "database"], ["ActivateDebugToolWindow", "debug"],
  ["ActivateElectroJunToolWindowToolWindow", "electrojun"], ["ActivateFavoritesToolWindow", "favorites"],
  ["ActivateFindToolWindow", "find"], ["ActivateMessagesToolWindow", "messages"],
  ["ActivateRunToolWindow", "run"], ["ActivateServicesToolWindow", "services"],
  ["ActivateTODOToolWindow", "todo"], ["ActivateTerminalToolWindow", "terminal"],
  ["ActivateVersionControlToolWindow", "version-control"], ["ActivateYouTrackToolWindow", "youtrack"],
]);

export class ToolWindowController {
  activeId: ToolWindowId | undefined;
  private compact = false;
  private history: ToolWindowId[] = [];
  constructor(private readonly onChange: () => void = () => undefined) {}

  activate(id: ToolWindowId): boolean {
    if (!definitionsById.has(id)) return false;
    this.activeId = id;
    this.history = [id, ...this.history.filter((existing) => existing !== id)].slice(0, definitions.length);
    this.onChange();
    return true;
  }

  activateAction(actionId: string): boolean {
    const id = idsByAction.get(actionId);
    return id ? this.activate(id) : false;
  }

  hideActiveWindow(): void { this.activeId = undefined; this.onChange(); }
  hideAllWindows(): void { this.history = []; this.hideActiveWindow(); }
  showContent(): void { this.compact = false; this.onChange(); }
  toggleContentUiTypeMode(): void { this.compact = !this.compact; this.onChange(); }

  nextWindow(): boolean {
    const ordered = this.history.length > 1 ? this.history : definitions.map((definition) => definition.id);
    const currentIndex = this.activeId ? ordered.indexOf(this.activeId) : -1;
    const next = ordered[(currentIndex + 1 + ordered.length) % ordered.length];
    return next ? this.activate(next) : false;
  }

  snapshot(): ToolWindowSnapshot | undefined {
    const definition = this.activeId ? definitionsById.get(this.activeId) : undefined;
    return definition ? { ...definition, compact: this.compact } : undefined;
  }
}

export const createToolWindowController = (onChange?: () => void): ToolWindowController => new ToolWindowController(onChange);
export const toolWindowIdForAction = (actionId: string): ToolWindowId | undefined => idsByAction.get(actionId);
export const toolWindowTitleForAction = (actionId: string): string | undefined => {
  const id = toolWindowIdForAction(actionId);
  return id ? definitionsById.get(id)?.title : undefined;
};

export function installToolWindowController(host: HTMLElement): ToolWindowController {
  const controller = createToolWindowController(() => renderToolWindow(host, controller));
  return controller;
}

function renderToolWindow(host: HTMLElement, controller: ToolWindowController): void {
  host.querySelector(".maldives-tool-window")?.remove();
  const snapshot = controller.snapshot();
  if (!snapshot) return;

  const panel = document.createElement("section");
  panel.className = "maldives-tool-window";
  panel.setAttribute("role", "complementary");
  panel.setAttribute("aria-label", `${snapshot.title} Tool Window`);
  panel.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${snapshot.compact ? 104 : 180}px;z-index:9000;background:#1e1e1e;color:#d4d4d4;border-top:1px solid #3c3c3c;box-shadow:0 -8px 24px rgba(0,0,0,.35);font:13px JetBrains Mono, monospace`;

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #333;background:#252526";
  const title = document.createElement("strong");
  title.className = "maldives-tool-window-title";
  title.textContent = snapshot.title;
  title.style.cssText = "color:#fff;flex:1";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Hide";
  close.style.cssText = "background:#2d2d2d;color:#d4d4d4;border:1px solid #555;padding:4px 8px;cursor:pointer";
  close.addEventListener("click", () => controller.hideActiveWindow());
  header.append(title, close);

  const body = document.createElement("div");
  body.className = "maldives-tool-window-body";
  body.textContent = snapshot.body;
  body.style.cssText = "padding:12px;line-height:1.45";
  panel.append(header, body);
  host.append(panel);
}
