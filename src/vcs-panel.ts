import type { editor } from "monaco-editor";
import type { GitBlameEntry, GitDiffHunk, GitStateProvider, GitStatusEntry } from "./git-proxy";
import { normalizeGitPathFromUri } from "./git-proxy";

export type VcsActionId =
  | "Annotate"
  | "ChangesView.AddUnversioned"
  | "ChangesView.ShelveSilently"
  | "CheckinProject"
  | "Diff.NextChange"
  | "Diff.NextConflict"
  | "Diff.PrevChange"
  | "Diff.PreviousConflict"
  | "Diff.ShowSettingsPopup"
  | "Git.Branches"
  | "Git.CompareWithBranch"
  | "Git.Stash"
  | "JumpToNextChange"
  | "NextDiff"
  | "PreviousDiff"
  | "RecentChangedFiles"
  | "RecentChanges"
  | "Vcs.UpdateProject";

export interface VcsPanelContext {
  uri: string;
  source: string;
  lineNumber: number;
  lineContent: string;
}

export interface VcsPanelSnapshot {
  activeActionId: VcsActionId;
  title: string;
  details: string[];
}

export interface VcsGitStateSnapshot {
  readonly path: string;
  readonly status: readonly GitStatusEntry[];
  readonly blame: GitBlameEntry;
  readonly diff: readonly GitDiffHunk[];
}

const titles: Record<VcsActionId, string> = {
  Annotate: "Annotate",
  "ChangesView.AddUnversioned": "Local Changes",
  "ChangesView.ShelveSilently": "Shelve Changes",
  CheckinProject: "Commit",
  "Diff.NextChange": "Diff",
  "Diff.NextConflict": "Conflicts",
  "Diff.PrevChange": "Diff",
  "Diff.PreviousConflict": "Conflicts",
  "Diff.ShowSettingsPopup": "Diff Settings",
  "Git.Branches": "Branches",
  "Git.CompareWithBranch": "Compare With Branch",
  "Git.Stash": "Stash",
  JumpToNextChange: "Diff",
  NextDiff: "Diff",
  PreviousDiff: "Diff",
  RecentChangedFiles: "Recent Changed Files",
  RecentChanges: "Recent Changes",
  "Vcs.UpdateProject": "Update Project",
};

const changeLabels = ["Working tree", "Staged changes", "Shelved changes"];
const conflictLabels = ["Incoming change", "Current change"];
const actionIds = new Set(Object.keys(titles));

export class VcsPanelController {
  private snapshotState: VcsPanelSnapshot | undefined;
  private trackedFiles = new Set<string>();
  private shelvedFiles = new Map<string, number>();
  private changeIndex = -1;
  private conflictIndex = -1;
  private gitProvider: GitStateProvider | undefined;
  private gitState: VcsGitStateSnapshot | undefined;
  private gitDecorations: editor.IEditorDecorationsCollection | undefined;

  constructor(private readonly onChange: () => void = () => undefined) {}

  runAction(actionId: string, context: VcsPanelContext): boolean {
    if (!isVcsActionId(actionId)) return false;

    this.snapshotState = {
      activeActionId: actionId,
      title: titles[actionId],
      details: this.detailsFor(actionId, context),
    };
    this.onChange();
    return true;
  }

  snapshot(): VcsPanelSnapshot | undefined {
    return this.snapshotState ? { ...this.snapshotState, details: [...this.snapshotState.details] } : undefined;
  }

  setGitStateProvider(provider: GitStateProvider | undefined): void {
    this.gitProvider = provider;
  }

  async refreshGitStateFromEditor(editor: editor.IStandaloneCodeEditor): Promise<VcsGitStateSnapshot | undefined> {
    const context = contextFromEditor(editor);
    if (!context) return undefined;

    const gitState = await this.refreshGitState(context);
    if (gitState) {
      this.applyGitDecorations(editor, gitState);
    }
    return gitState;
  }

  async refreshGitState(context: VcsPanelContext): Promise<VcsGitStateSnapshot | undefined> {
    if (!this.gitProvider) return undefined;

    const path = normalizeGitPathFromUri(context.uri);
    const [status, blame, diff] = await Promise.all([
      this.gitProvider.status(),
      this.gitProvider.blame(path, context.lineNumber),
      this.gitProvider.diff(path),
    ]);

    this.gitState = { path, status, blame, diff };
    if (this.snapshotState) {
      this.snapshotState = {
        ...this.snapshotState,
        details: this.detailsFor(this.snapshotState.activeActionId, context),
      };
      this.onChange();
    }
    return this.gitState;
  }

  private applyGitDecorations(editor: editor.IStandaloneCodeEditor, gitState: VcsGitStateSnapshot): void {
    installGitDecorationStyles();
    const model = editor.getModel();
    if (!model) return;

    const activeStatuses = gitState.status.filter((entry) => entry.path === gitState.path);
    const decorations = activeStatuses.flatMap((entry) => {
      const lines = entry.lines?.length ? entry.lines : [gitState.blame.line];
      return lines.map((line) => ({
        range: {
          startLineNumber: Math.min(line, model.getLineCount()),
          startColumn: 1,
          endLineNumber: Math.min(line, model.getLineCount()),
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          linesDecorationsClassName: `maldives-git-line-${entry.status}`,
          glyphMarginClassName: `maldives-git-glyph-${entry.status}`,
          hoverMessage: { value: `Blame: ${gitState.blame.author} ${gitState.blame.commit} — ${gitState.blame.summary}` },
        },
      }));
    });

    if (!this.gitDecorations) {
      this.gitDecorations = editor.createDecorationsCollection(decorations);
    } else {
      this.gitDecorations.set(decorations);
    }
  }

  private detailsFor(actionId: VcsActionId, context: VcsPanelContext): string[] {
    const fileSummary = [`Current file: ${context.uri}`, `Lines: ${lineCount(context.source)}`];
    const gitDetails = this.gitDetailsForActivePath();

    if (actionId === "Annotate") {
      return [`Line ${context.lineNumber}: ${context.lineContent.trim()}`, "Author: local working tree", ...gitDetails, ...fileSummary];
    }

    if (actionId === "ChangesView.AddUnversioned") {
      this.trackedFiles.add(context.uri);
      return [`Tracked file: ${context.uri}`, `Tracked files: ${this.trackedFiles.size}`, ...gitDetails, ...fileSummary];
    }

    if (actionId === "ChangesView.ShelveSilently") {
      this.shelvedFiles.set(context.uri, lineCount(context.source));
      return [`Shelved ${lineCount(context.source)} lines from ${context.uri}`, `Shelves: ${this.shelvedFiles.size}`, ...gitDetails, ...fileSummary];
    }

    if (actionId === "CheckinProject") {
      this.trackedFiles.add(context.uri);
      return [`Commit draft includes ${context.uri}`, `Files included: ${this.trackedFiles.size}`, ...gitDetails, ...fileSummary];
    }

    if (actionId === "Git.Branches") {
      return ["Current branch: browser-workspace", "Available branches: browser-workspace", ...gitDetails, ...fileSummary];
    }

    if (actionId === "Git.CompareWithBranch") {
      return ["Comparing browser-workspace with the active editor buffer", ...gitDetails, ...fileSummary];
    }

    if (actionId === "Git.Stash") {
      return ["Stash preview includes the active editor buffer", ...gitDetails, ...fileSummary];
    }

    if (isNextChangeAction(actionId) || isPreviousChangeAction(actionId)) {
      this.changeIndex = nextIndex(this.changeIndex, changeLabels.length, isNextChangeAction(actionId) ? 1 : -1);
      return [`Selected change ${this.changeIndex + 1}/${changeLabels.length}: ${changeLabels[this.changeIndex]}`, ...gitDetails, ...fileSummary];
    }

    if (actionId === "Diff.NextConflict" || actionId === "Diff.PreviousConflict") {
      this.conflictIndex = nextIndex(this.conflictIndex, conflictLabels.length, actionId === "Diff.NextConflict" ? 1 : -1);
      return [`Selected conflict ${this.conflictIndex + 1}/${conflictLabels.length}: ${conflictLabels[this.conflictIndex]}`, ...gitDetails, ...fileSummary];
    }

    if (actionId === "Diff.ShowSettingsPopup") {
      return ["Whitespace: ignored", "Highlight mode: unified", ...gitDetails, ...fileSummary];
    }

    if (actionId === "RecentChangedFiles" || actionId === "RecentChanges") {
      return [`Recent change: ${context.uri}`, ...gitDetails, ...fileSummary];
    }

    return ["Project update queued for the active workspace", ...gitDetails, ...fileSummary];
  }

  private gitDetailsForActivePath(): string[] {
    if (!this.gitState) return [];

    const activeStatuses = this.gitState.status.filter((entry) => entry.path === this.gitState?.path);
    const statusLines = activeStatuses.map((entry) => `Take5 status: ${entry.status} ${entry.path}`);
    const blameLine = `Blame: ${this.gitState.blame.author} ${this.gitState.blame.commit} — ${this.gitState.blame.summary}`;
    const diffLines = this.gitState.diff
      .filter((hunk) => hunk.path === this.gitState?.path)
      .flatMap((hunk) => [`Diff: ${hunk.lines[0] ?? `@@ -${hunk.oldStart} +${hunk.newStart} @@`}`, ...hunk.lines.slice(1, 6)]);

    return [...statusLines, blameLine, ...diffLines];
  }
}

export const createVcsPanelController = (onChange?: () => void): VcsPanelController => new VcsPanelController(onChange);
export const vcsPanelTitleForAction = (actionId: string): string | undefined => (isVcsActionId(actionId) ? titles[actionId] : undefined);
export const isVcsActionId = (actionId: string): actionId is VcsActionId => actionIds.has(actionId);

export function contextFromEditor(editor: editor.IStandaloneCodeEditor): VcsPanelContext | undefined {
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

export function installVcsPanelController(host: HTMLElement): VcsPanelController {
  const controller = createVcsPanelController(() => renderVcsPanel(host, controller));
  return controller;
}

function renderVcsPanel(host: HTMLElement, controller: VcsPanelController): void {
  host.querySelector(".maldives-vcs-panel")?.remove();
  const snapshot = controller.snapshot();
  if (!snapshot) return;

  const panel = document.createElement("section");
  panel.className = "maldives-vcs-panel";
  panel.setAttribute("role", "complementary");
  panel.setAttribute("aria-label", `${snapshot.title} VCS Panel`);
  panel.style.cssText = "position:fixed;right:16px;bottom:16px;width:min(520px,calc(100vw - 32px));z-index:9100;background:#202020;color:#d4d4d4;border:1px solid #4a4a4a;box-shadow:0 12px 32px rgba(0,0,0,.45);font:13px JetBrains Mono, monospace";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;background:#2a2a2a";
  const title = document.createElement("strong");
  title.className = "maldives-vcs-title";
  title.textContent = snapshot.title;
  title.style.cssText = "color:#fff;flex:1";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "background:#2d2d2d;color:#d4d4d4;border:1px solid #555;padding:4px 8px;cursor:pointer";
  close.addEventListener("click", () => panel.remove());
  header.append(title, close);

  const body = document.createElement("div");
  body.className = "maldives-vcs-body";
  body.style.cssText = "display:grid;gap:6px;padding:12px;line-height:1.4";
  for (const detail of snapshot.details) {
    const row = document.createElement("div");
    row.className = "maldives-vcs-row";
    row.textContent = detail;
    body.append(row);
  }

  panel.append(header, body);
  host.append(panel);
}

function installGitDecorationStyles(): void {
  if (document.getElementById("maldives-git-decoration-styles")) return;

  const style = document.createElement("style");
  style.id = "maldives-git-decoration-styles";
  style.textContent = `
    .maldives-git-line-added { border-left: 3px solid #6a9955; background: rgba(106, 153, 85, 0.10); }
    .maldives-git-line-modified { border-left: 3px solid #d7ba7d; background: rgba(215, 186, 125, 0.10); }
    .maldives-git-line-deleted { border-left: 3px solid #f48771; background: rgba(244, 135, 113, 0.10); }
    .maldives-git-glyph-added::before { content: '+'; color: #6a9955; }
    .maldives-git-glyph-modified::before { content: '~'; color: #d7ba7d; }
    .maldives-git-glyph-deleted::before { content: '-'; color: #f48771; }
  `;
  document.head.append(style);
}

function lineCount(source: string): number {
  return source.trimEnd().split(/\r?\n/).length;
}

function nextIndex(index: number, size: number, delta: 1 | -1): number {
  return (index + delta + size) % size;
}

function isNextChangeAction(actionId: VcsActionId): boolean {
  return actionId === "Diff.NextChange" || actionId === "JumpToNextChange" || actionId === "NextDiff";
}

function isPreviousChangeAction(actionId: VcsActionId): boolean {
  return actionId === "Diff.PrevChange" || actionId === "PreviousDiff";
}
