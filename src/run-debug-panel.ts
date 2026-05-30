import type { editor } from "monaco-editor";

export type RunDebugActionId =
  | "ChooseDebugConfiguration"
  | "Debug"
  | "DebugClass"
  | "Rerun"
  | "RerunTests"
  | "Resume"
  | "Run"
  | "RunClass"
  | "RunConfiguration"
  | "Stop";

export type RunDebugStatus = "configured" | "running" | "debugging" | "stopped";

export interface RunDebugPanelContext {
  uri: string;
  source: string;
  lineNumber: number;
  lineContent: string;
}

export interface RunDebugConfiguration {
  name: string;
  target: string;
  uri: string;
  lineNumber: number;
  runCount: number;
}

export interface RunDebugPanelSnapshot {
  activeActionId: RunDebugActionId;
  title: string;
  status: RunDebugStatus;
  configuration: RunDebugConfiguration;
  details: string[];
}

const titles: Record<RunDebugActionId, string> = {
  ChooseDebugConfiguration: "Choose Debug Configuration",
  Debug: "Debug",
  DebugClass: "Debug Class",
  Rerun: "Rerun",
  RerunTests: "Rerun Tests",
  Resume: "Resume",
  Run: "Run",
  RunClass: "Run Class",
  RunConfiguration: "Run Configuration",
  Stop: "Stop",
};

const actionIds = new Set(Object.keys(titles));

export class RunDebugPanelController {
  private snapshotState: RunDebugPanelSnapshot | undefined;
  private lastConfiguration: RunDebugConfiguration | undefined;

  constructor(private readonly onChange: () => void = () => undefined) {}

  runAction(actionId: string, context: RunDebugPanelContext): boolean {
    if (!isRunDebugActionId(actionId)) return false;

    const configuration = this.configurationFor(actionId, context);
    const status = statusFor(actionId);
    const runCount = startsExecution(actionId) ? configuration.runCount + 1 : configuration.runCount;
    const nextConfiguration = { ...configuration, runCount };

    this.lastConfiguration = nextConfiguration;
    this.snapshotState = {
      activeActionId: actionId,
      title: titles[actionId],
      status,
      configuration: nextConfiguration,
      details: this.detailsFor(actionId, status, nextConfiguration, context),
    };
    this.onChange();
    return true;
  }

  snapshot(): RunDebugPanelSnapshot | undefined {
    return this.snapshotState
      ? {
          ...this.snapshotState,
          configuration: { ...this.snapshotState.configuration },
          details: [...this.snapshotState.details],
        }
      : undefined;
  }

  private configurationFor(actionId: RunDebugActionId, context: RunDebugPanelContext): RunDebugConfiguration {
    if ((actionId === "Rerun" || actionId === "RerunTests" || actionId === "Resume" || actionId === "Stop") && this.lastConfiguration) {
      return this.lastConfiguration;
    }

    const target = actionId === "RunConfiguration" || actionId === "ChooseDebugConfiguration"
      ? fileNameFromUri(context.uri)
      : classNameAtLine(context.source, context.lineNumber) ?? fileNameFromUri(context.uri);

    return {
      name: context.uri,
      target,
      uri: context.uri,
      lineNumber: context.lineNumber,
      runCount: 0,
    };
  }

  private detailsFor(
    actionId: RunDebugActionId,
    status: RunDebugStatus,
    configuration: RunDebugConfiguration,
    context: RunDebugPanelContext,
  ): string[] {
    const base = [
      `Status: ${status}`,
      `Configuration: ${configuration.name}`,
      `Target: ${configuration.target}`,
      `Current file: ${configuration.uri}`,
      `Line ${context.lineNumber}: ${context.lineContent.trim()}`,
      `Lines: ${lineCount(context.source)}`,
      `Rerun count: ${configuration.runCount}`,
    ];

    if (actionId === "ChooseDebugConfiguration" || actionId === "RunConfiguration") {
      return ["Executable configuration selected from the active Monaco model", ...base];
    }

    if (actionId === "Debug" || actionId === "DebugClass") {
      return [`Debugger attached to ${configuration.target}`, "Lifecycle controls: Resume, Rerun, Stop", ...base];
    }

    if (actionId === "Resume") {
      return [`Resumed ${configuration.target}`, ...base];
    }

    if (actionId === "RerunTests") {
      return ["Test runner: active file diagnostics", ...base];
    }

    if (actionId === "Stop") {
      return [`Stopped ${configuration.target}`, ...base];
    }

    return [`Running ${configuration.target}`, "Lifecycle controls: Rerun, Stop", ...base];
  }
}

export const createRunDebugPanelController = (onChange?: () => void): RunDebugPanelController => new RunDebugPanelController(onChange);
export const runDebugPanelTitleForAction = (actionId: string): string | undefined => (isRunDebugActionId(actionId) ? titles[actionId] : undefined);
export const isRunDebugActionId = (actionId: string): actionId is RunDebugActionId => actionIds.has(actionId);

export function contextFromEditor(editor: editor.IStandaloneCodeEditor): RunDebugPanelContext | undefined {
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

export function installRunDebugPanelController(host: HTMLElement): RunDebugPanelController {
  const controller = createRunDebugPanelController(() => renderRunDebugPanel(host, controller));
  return controller;
}

function renderRunDebugPanel(host: HTMLElement, controller: RunDebugPanelController): void {
  host.querySelector(".maldives-run-debug-panel")?.remove();
  const snapshot = controller.snapshot();
  if (!snapshot) return;

  const panel = document.createElement("section");
  panel.className = "maldives-run-debug-panel";
  panel.setAttribute("role", "complementary");
  panel.setAttribute("aria-label", `${snapshot.title} Run Debug Panel`);
  panel.style.cssText = "position:fixed;right:16px;top:64px;width:min(540px,calc(100vw - 32px));z-index:9120;background:#201f24;color:#d4d4d4;border:1px solid #4a4a4a;box-shadow:0 12px 32px rgba(0,0,0,.45);font:13px JetBrains Mono, monospace";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;background:#2b2930";
  const title = document.createElement("strong");
  title.className = "maldives-run-debug-title";
  title.textContent = snapshot.title;
  title.style.cssText = "color:#fff;flex:1";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "background:#2d2d2d;color:#d4d4d4;border:1px solid #555;padding:4px 8px;cursor:pointer";
  close.addEventListener("click", () => panel.remove());
  header.append(title, close);

  const body = document.createElement("div");
  body.className = "maldives-run-debug-body";
  body.style.cssText = "display:grid;gap:6px;padding:12px;line-height:1.4";
  for (const detail of snapshot.details) {
    const row = document.createElement("div");
    row.className = "maldives-run-debug-row";
    row.textContent = detail;
    body.append(row);
  }

  panel.append(header, body);
  host.append(panel);
}

function startsExecution(actionId: RunDebugActionId): boolean {
  return actionId === "Run" || actionId === "RunClass" || actionId === "Debug" || actionId === "DebugClass" || actionId === "Rerun" || actionId === "RerunTests";
}

function statusFor(actionId: RunDebugActionId): RunDebugStatus {
  if (actionId === "Debug" || actionId === "DebugClass") return "debugging";
  if (actionId === "Stop") return "stopped";
  if (actionId === "ChooseDebugConfiguration" || actionId === "RunConfiguration") return "configured";
  return "running";
}

function classNameAtLine(source: string, lineNumber: number): string | undefined {
  const lines = source.split(/\r?\n/).slice(0, lineNumber);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = lines[index]?.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/);
    if (match) return match[1];
  }

  return undefined;
}

function fileNameFromUri(uri: string): string {
  return decodeURIComponent(uri.split("/").pop() ?? uri);
}

function lineCount(source: string): number {
  return source.trimEnd().split(/\r?\n/).length;
}
