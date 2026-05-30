import type { editor } from "monaco-editor";

export type TerminalActionId = "ActivateTerminalToolWindow" | "tasks.switch" | "tasks.goto" | "tasks.close" | "tasks.open.in.browser";
export type TerminalResult = { ok: boolean; output: string };

export interface TerminalPanelContext { uri: string; source: string; lineNumber: number; lineContent: string }
export interface TerminalPanelSnapshot { visible: boolean; title: string; cwd: string; lines: string[] }
export interface TerminalPanelOptions { token?: string; root?: string }

const titles: Record<TerminalActionId, string> = {
  ActivateTerminalToolWindow: "Terminal",
  "tasks.switch": "Tasks",
  "tasks.goto": "Tasks",
  "tasks.close": "Tasks",
  "tasks.open.in.browser": "Tasks",
};
const actionIds = new Set(Object.keys(titles));
const allowlistedCommands = new Set(["pwd", "ls", "cat", "echo", "clear"]);
const taskNames = ["typecheck", "test", "e2e"];

export class TerminalPanelController {
  private visible = false;
  private readonly root: string;
  private readonly token?: string;
  private taskIndex = -1;
  private lines: string[] = [];
  private audit: string[] = [];

  constructor(private readonly onChange: () => void = () => undefined, options: TerminalPanelOptions = {}) {
    this.root = normalizeRoot(options.root ?? "/workspace");
    this.token = options.token;
  }

  runAction(actionId: string, context: TerminalPanelContext): boolean {
    if (!isTerminalActionId(actionId)) return false;
    if (actionId === "tasks.close") {
      this.visible = false;
      this.onChange();
      return true;
    }
    this.visible = true;
    if (actionId === "ActivateTerminalToolWindow") this.open(context);
    if (actionId === "tasks.switch") this.switchTask();
    if (actionId === "tasks.goto") this.push(`Goto task source: ${context.uri}:${context.lineNumber}`);
    if (actionId === "tasks.open.in.browser") this.push("Preview: http://127.0.0.1:5173/");
    this.onChange();
    return true;
  }

  execute(line: string, context: TerminalPanelContext, token?: string): TerminalResult {
    const [command, ...args] = line.trim().split(/\s+/).filter(Boolean);
    if (!command) return { ok: false, output: "EINVALID: empty command" };
    if (this.token && token !== this.token) return this.deny("token", command, context, "EACCES: invalid terminal token");
    if (args.some((arg) => arg.includes("..")) || command === "cd") return this.deny("traversal", command, context, "ESECURITY: path traversal denied");
    if (!allowlistedCommands.has(command)) return this.deny("command", command, context, "ESECURITY: command not allowlisted");

    const output = this.outputFor(command, args, context);
    this.audit.push(`ALLOW command=${command} uri=${context.uri}`);
    if (command === "clear") this.lines = [];
    else this.push(`$ ${line}`, output);
    this.visible = true;
    this.onChange();
    return { ok: true, output };
  }

  snapshot(): TerminalPanelSnapshot { return { visible: this.visible, title: "Terminal", cwd: this.root, lines: [...this.lines] }; }
  auditLog(): string[] { return [...this.audit]; }

  private open(context: TerminalPanelContext): void {
    this.lines = [
      "Terminal ready — sandboxed browser workspace shell",
      `Sandbox root: ${this.root}`,
      `Current file: ${context.uri}`,
      "Allowed commands: pwd, ls, cat, echo, clear",
    ];
  }

  private switchTask(): void {
    this.taskIndex = (this.taskIndex + 1) % taskNames.length;
    this.push(`Task: ${taskNames[this.taskIndex]}`);
  }

  private outputFor(command: string, args: string[], context: TerminalPanelContext): string {
    if (command === "pwd") return this.root;
    if (command === "ls") return fileNameFromUri(context.uri);
    if (command === "echo") return args.join(" ");
    if (command === "clear") return "";
    const requested = args[0] ?? fileNameFromUri(context.uri);
    return requested === fileNameFromUri(context.uri) ? context.source : `ENOENT: ${requested}`;
  }

  private deny(reason: string, command: string, context: TerminalPanelContext, output: string): TerminalResult {
    this.audit.push(`DENY ${reason} command=${command} uri=${context.uri}`);
    this.push(`$ ${command}`, output);
    this.visible = true;
    this.onChange();
    return { ok: false, output };
  }

  private push(...next: string[]): void {
    this.lines = [...this.lines, ...next].slice(-24);
  }
}

export const createTerminalPanelController = (options?: TerminalPanelOptions, onChange?: () => void): TerminalPanelController => new TerminalPanelController(onChange, options);
export const terminalPanelTitleForAction = (actionId: string): string | undefined => (isTerminalActionId(actionId) ? titles[actionId] : undefined);
export const isTerminalActionId = (actionId: string): actionId is TerminalActionId => actionIds.has(actionId);

export function contextFromEditor(editor: editor.IStandaloneCodeEditor): TerminalPanelContext | undefined {
  const model = editor.getModel();
  const position = editor.getPosition();
  if (!model || !position) return undefined;
  return { uri: model.uri.toString(), source: model.getValue(), lineNumber: position.lineNumber, lineContent: model.getLineContent(position.lineNumber) };
}

export function installTerminalPanelController(host: HTMLElement, options?: TerminalPanelOptions): TerminalPanelController {
  const controller = createTerminalPanelController(options, () => renderTerminalPanel(host, controller));
  return controller;
}

function renderTerminalPanel(host: HTMLElement, controller: TerminalPanelController): void {
  host.querySelector(".maldives-terminal-panel")?.remove();
  const snapshot = controller.snapshot();
  if (!snapshot.visible) return;

  const panel = document.createElement("section");
  panel.className = "maldives-terminal-panel";
  panel.setAttribute("role", "complementary");
  panel.setAttribute("aria-label", "Terminal Panel");
  panel.style.cssText = "position:fixed;left:24px;right:24px;bottom:24px;height:260px;z-index:9130;background:#111;color:#d4d4d4;border:1px solid #4a4a4a;box-shadow:0 14px 36px rgba(0,0,0,.5);font:13px JetBrains Mono, monospace";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;background:#1e1e1e";
  const title = document.createElement("strong");
  title.className = "maldives-terminal-title";
  title.textContent = snapshot.title;
  title.style.cssText = "color:#fff;flex:1";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "background:#2d2d2d;color:#d4d4d4;border:1px solid #555;padding:4px 8px;cursor:pointer";
  close.addEventListener("click", () => { controller.runAction("tasks.close", { uri: "file:///workspace", source: "", lineNumber: 1, lineContent: "" }); });
  header.append(title, close);

  const body = document.createElement("div");
  body.className = "maldives-terminal-body";
  body.style.cssText = "display:grid;gap:4px;padding:12px;line-height:1.35;white-space:pre-wrap;overflow:auto;height:202px";
  for (const line of snapshot.lines) {
    const row = document.createElement("div");
    row.className = "maldives-terminal-row";
    row.textContent = line;
    body.append(row);
  }
  panel.append(header, body);
  host.append(panel);
}

function normalizeRoot(root: string): string { return root.startsWith("/") ? root.replace(/\/+$/g, "") || "/" : `/${root}`; }
function fileNameFromUri(uri: string): string { return decodeURIComponent(uri.split("/").pop() ?? uri); }
