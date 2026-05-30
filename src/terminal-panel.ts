import type { editor } from "monaco-editor";
import type { ConsoleThemeConfig } from "./parsers/icls-parser";

export type TerminalActionId = "ActivateTerminalToolWindow" | "tasks.switch" | "tasks.goto" | "tasks.close" | "tasks.open.in.browser";
export type TerminalResult = { ok: boolean; output: string };

export interface TerminalPanelContext { uri: string; source: string; lineNumber: number; lineContent: string }
export interface TerminalPanelSnapshot { visible: boolean; title: string; cwd: string; lines: string[] }
export interface TerminalPanelOptions { token?: string; root?: string; theme?: ConsoleThemeConfig }
type TerminalLineKind = "normal" | "system" | "user-input" | "error";
type TerminalLine = { text: string; kind: TerminalLineKind };

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
  private lines: TerminalLine[] = [];
  private audit: string[] = [];
  private readonly theme?: ConsoleThemeConfig;

  constructor(private readonly onChange: () => void = () => undefined, options: TerminalPanelOptions = {}) {
    this.root = normalizeRoot(options.root ?? "/workspace");
    this.token = options.token;
    this.theme = options.theme;
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
    else this.pushInput(`$ ${line}`, output);
    this.visible = true;
    this.onChange();
    return { ok: true, output };
  }

  snapshot(): TerminalPanelSnapshot { return { visible: this.visible, title: "Terminal", cwd: this.root, lines: this.lines.map((line) => line.text) }; }
  auditLog(): string[] { return [...this.audit]; }

  private open(context: TerminalPanelContext): void {
    this.lines = [
      { text: "Terminal ready — sandboxed browser workspace shell", kind: "system" },
      { text: `Sandbox root: ${this.root}`, kind: "system" },
      { text: `Current file: ${context.uri}`, kind: "system" },
      { text: "Allowed commands: pwd, ls, cat, echo, clear", kind: "system" },
    ];
  }

  private switchTask(): void {
    this.taskIndex = (this.taskIndex + 1) % taskNames.length;
    this.pushSystem(`Task: ${taskNames[this.taskIndex]}`);
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
    this.pushError(`$ ${command}`, output);
    this.visible = true;
    this.onChange();
    return { ok: false, output };
  }

  private push(...next: string[]): void {
    this.lines = [...this.lines, ...next.map((text) => ({ text, kind: "normal" as const }))].slice(-24);
  }

  private pushSystem(...next: string[]): void {
    this.lines = [...this.lines, ...next.map((text) => ({ text, kind: "system" as const }))].slice(-24);
  }

  private pushInput(command: string, output: string): void {
    this.lines = [...this.lines, { text: command, kind: "user-input" as const }, { text: output, kind: "normal" as const }].slice(-24);
  }

  private pushError(command: string, output: string): void {
    this.lines = [...this.lines, { text: command, kind: "user-input" as const }, { text: output, kind: "error" as const }].slice(-24);
  }

  lineKinds(): TerminalLineKind[] { return this.lines.map((line) => line.kind); }
  themeConfig(): ConsoleThemeConfig | undefined { return this.theme; }
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
  panel.style.cssText = terminalPanelCssText(controller.themeConfig());

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;background:#1e1e1e";
  const title = document.createElement("strong");
  title.className = "maldives-terminal-title";
  title.textContent = snapshot.title;
  title.style.cssText = "color:var(--maldives-console-normal-output);flex:1";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "background:#2d2d2d;color:var(--maldives-console-normal-output);border:1px solid #555;padding:4px 8px;cursor:pointer";
  close.addEventListener("click", () => { controller.runAction("tasks.close", { uri: "file:///workspace", source: "", lineNumber: 1, lineContent: "" }); });
  header.append(title, close);

  const body = document.createElement("div");
  body.className = "maldives-terminal-body";
  body.style.cssText = "display:grid;gap:4px;padding:12px;line-height:var(--maldives-console-line-spacing);white-space:pre-wrap;overflow:auto;height:202px";
  const kinds = controller.lineKinds();
  snapshot.lines.forEach((line, index) => {
    const kind = kinds[index] ?? "normal";
    const row = document.createElement("div");
    row.className = `maldives-terminal-row maldives-terminal-row-${kind}`;
    row.style.cssText = terminalRowCssText(kind);
    row.textContent = line;
    body.append(row);
  });
  panel.append(header, body);
  host.append(panel);
}

export function terminalPanelCssText(theme?: ConsoleThemeConfig): string {
  const fontFamily = theme?.fontFamily ?? "JetBrains Mono";
  const fontSize = theme?.fontSize ?? 13;
  return [
    "position:fixed",
    "left:24px",
    "right:24px",
    "bottom:24px",
    "height:260px",
    "z-index:9130",
    `--maldives-console-background:${theme?.background ?? "#111"}`,
    `--maldives-console-normal-output:${theme?.normal ?? "#d4d4d4"}`,
    `--maldives-console-error-output:${theme?.error ?? "#f2777a"}`,
    `--maldives-console-system-output:${theme?.system ?? "#6699cc"}`,
    `--maldives-console-user-input:${theme?.userInput ?? "#99cc99"}`,
    `--maldives-console-user-input-font-style:${theme?.userInputFontStyle || "normal"}`,
    `--maldives-console-line-spacing:${theme?.lineSpacing ?? 1.35}`,
    `--maldives-console-black:${theme?.ansi.black ?? "#000"}`,
    `--maldives-console-blue:${theme?.ansi.blue ?? "#6699cc"}`,
    `--maldives-console-blue-bright:${theme?.ansi.blueBright ?? "#2d61f0"}`,
    `--maldives-console-cyan:${theme?.ansi.cyan ?? "#66cccc"}`,
    `--maldives-console-cyan-bright:${theme?.ansi.cyanBright ?? "#15c1c1"}`,
    `--maldives-console-gray:${theme?.ansi.gray ?? "#999999"}`,
    `--maldives-console-green:${theme?.ansi.green ?? "#99cc99"}`,
    `--maldives-console-green-bright:${theme?.ansi.greenBright ?? "#16b42c"}`,
    `--maldives-console-magenta:${theme?.ansi.magenta ?? "#cc99cc"}`,
    `--maldives-console-magenta-bright:${theme?.ansi.magentaBright ?? "#a47dde"}`,
    `--maldives-console-red:${theme?.ansi.red ?? "#f2777a"}`,
    `--maldives-console-red-bright:${theme?.ansi.redBright ?? "#ff1616"}`,
    `--maldives-console-white:${theme?.ansi.white ?? "#c9c9c9"}`,
    `--maldives-console-yellow:${theme?.ansi.yellow ?? "#ffcc66"}`,
    `--maldives-console-yellow-bright:${theme?.ansi.yellowBright ?? "#ecc32c"}`,
    "background:var(--maldives-console-background)",
    "color:var(--maldives-console-normal-output)",
    "border:1px solid #4a4a4a",
    "box-shadow:0 14px 36px rgba(0,0,0,.5)",
    `font:${fontSize}px ${fontFamily}, monospace`,
  ].join(";");
}

function terminalRowCssText(kind: TerminalLineKind): string {
  if (kind === "system") return "color:var(--maldives-console-system-output)";
  if (kind === "user-input") return "color:var(--maldives-console-user-input);font-style:var(--maldives-console-user-input-font-style)";
  if (kind === "error") return "color:var(--maldives-console-error-output)";
  return "color:var(--maldives-console-normal-output)";
}

function normalizeRoot(root: string): string { return root.startsWith("/") ? root.replace(/\/+$/g, "") || "/" : `/${root}`; }
function fileNameFromUri(uri: string): string { return decodeURIComponent(uri.split("/").pop() ?? uri); }
