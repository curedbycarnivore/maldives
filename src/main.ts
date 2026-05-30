import * as monaco from "monaco-editor";
import activeThemeXml from "../ssot/colors/active-theme.icls?raw";
import keymapXml from "../ssot/keymaps/leet hax.xml?raw";
import editorOptionsXml from "../ssot/options/editor.xml?raw";
import { ensureAstReady } from "./ast-smart-selection";
import { registerAstStructuralSearchAction } from "./ast-structural-search";
import { registerMaldivesCodeActions } from "./code-actions";
import { installCrossFileLspController, type CrossFileLspController } from "./cross-file-lsp";
import { defaultSampleDocument, DEFAULT_SAMPLE_URI } from "./default-buffer";
import { registerSchemaJsonSchemaAction } from "./schema-jsonschema";
import { installEffectDevToolsButton, openEffectDevToolsPanel, type OpenEffectDevToolsOptions } from "./effect-devtools";
import { installEffectLanguageService, type EffectLanguageServiceController } from "./effect-language-service";
import { registerEffectHoverProvider } from "./effect-hover";
import { registerEffectSnippets } from "./effect-snippets";
import { installFavoritesPanelController, type FavoritesPanelController } from "./favorites-panel";
import { installFindInFilesPanel, type FindInFilesController } from "./find-in-files";
import { FileSystemAccessAdapter, installOpenFileButton } from "./fs";
import { registerModelTab, registerRecentLocationTracking } from "./file-switcher";
import { cleanOnBlurFromModel } from "./hooks/trailing-whitespace";
import { isCustomTextMutationAction, registerKeybindings, type RegisteredMaldivesAction } from "./keybindings";
import { installReadWriteToggle, WRITE_MODE_CONTEXT_KEY, saveActiveWorkspaceFile } from "./read-write-mode";
import { parseEditorOptions } from "./parsers/editor-options-parser";
import { parseIcls } from "./parsers/icls-parser";
import { parseKeymap } from "./parsers/keymap-parser";
import { awaitTypeScriptWorkerAnswer, setupDefaultMonacoWorkers } from "./monaco-workers";
import { maldivesProFeatureOptions } from "./pro-features";
import { installRunDebugPanelController, type RunDebugPanelController } from "./run-debug-panel";
import { contextFromEditor as terminalContextFromEditor, installTerminalPanelController, type TerminalResult } from "./terminal-panel";
import { registerTheme, THEME_NAME } from "./theme";
import { installToolWindowController, type ToolWindowController } from "./tool-windows";
import { installVcsPanelController, type VcsPanelController } from "./vcs-panel";
import { configureTypeScriptWorker, registerEffectDtsFiles, type EffectDtsFiles, type RegisterEffectDtsFilesOptions } from "./typescript-worker";
import { startVscodeTypeScriptWorkerForMaldives, type VscodeTypeScriptWorkerBootstrap } from "./vscode-ts-worker";
import { installWorkspacePersistence, restoreWorkspaceFromStorage } from "./workspace-persistence";
import { installWorkspaceTabStrip } from "./workspace-tabs";
import { MaldivesWorkspace } from "./workspace";

declare global {
  interface Window {
    __maldivesEditor: monaco.editor.IStandaloneCodeEditor;
    __monaco: typeof monaco;
    __maldivesKeybindings: RegisteredMaldivesAction[];
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
    __maldivesRegisterEffectDtsFiles: (files: EffectDtsFiles, options?: RegisterEffectDtsFilesOptions) => monaco.IDisposable;
    __maldivesOpenEffectDevTools: (options: OpenEffectDevToolsOptions) => void;
    __maldivesVscodeTsWorkerReady: Promise<VscodeTypeScriptWorkerBootstrap>;
    __maldivesEffectLanguageService: EffectLanguageServiceController;
    __maldivesWorkspace: MaldivesWorkspace;
    __maldivesFileSystemAdapter: FileSystemAccessAdapter;
    __maldivesToolWindows: ToolWindowController;
    __maldivesVcsPanel: VcsPanelController;
    __maldivesRunDebugPanel: RunDebugPanelController;
    __maldivesTerminalPanel: { execute: (line: string, token?: string) => TerminalResult };
    __maldivesFavoritesPanel: FavoritesPanelController;
    __maldivesFindInFiles: FindInFilesController;
    __maldivesCrossFileLsp: CrossFileLspController;
    __maldivesSaveActiveFile: () => Promise<boolean>;
    __maldivesReady: Promise<void>;
  }
}

declare const __MALDIVES_DEVTOOLS_ENABLED__: boolean;

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount point");
}

document.body.style.margin = "0";
app.style.height = "100vh";
app.style.width = "100vw";

const secondDocument = `// Maldives deterministic second tab
export const secondTab = true;
`;

setupDefaultMonacoWorkers();

const effectDtsFiles = import.meta.glob("/node_modules/effect/dist/dts/**/*.d.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as EffectDtsFiles;
const effectLanguageServiceFiles = import.meta.glob("/node_modules/@effect/language-service/{index.js,package.json,schema.json}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const typeScriptLibFiles = import.meta.glob("/node_modules/typescript/lib/lib.*.d.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const themeConfig = parseIcls(activeThemeXml);
const editorOptions = parseEditorOptions(editorOptionsXml);
const keymapConfig = parseKeymap(keymapXml);

registerTheme(monaco, themeConfig);
configureTypeScriptWorker(monaco, { effectDtsFiles });
const vscodeTsWorkerReady = startVscodeTypeScriptWorkerForMaldives(monaco, { effectDtsFiles, effectLanguageServiceFiles });
registerEffectSnippets(monaco);
registerEffectHoverProvider(monaco);
registerMaldivesCodeActions(monaco);

window.__monaco = monaco;
window.__maldivesRegisterEffectDtsFiles = (files, options) => registerEffectDtsFiles(monaco, files, options);
window.__maldivesOpenEffectDevTools = (options) => openEffectDevToolsPanel(options);
const editor = monaco.editor.create(app, {
  model: null,
  automaticLayout: true,
  theme: THEME_NAME,
  fontFamily: `${themeConfig.fontFamily}, Fira Code, monospace`,
  fontSize: themeConfig.fontSize,
  trimAutoWhitespace: editorOptions.trimAutoWhitespace,
  ...maldivesProFeatureOptions,
});
const workspace = new MaldivesWorkspace({
  createModel(uri, content) {
    const language = uri.endsWith(".tsx") || uri.endsWith(".ts") ? "typescript" : undefined;
    const model = monaco.editor.createModel(content, language, monaco.Uri.parse(uri));
    registerModelTab(model);
    return model;
  },
  editor,
});
const workspaceStorage = {
  getItem: (key: string) => window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key),
  setItem: (key: string, value: string) => {
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(key, value);
  },
};
const restoredWorkspace = restoreWorkspaceFromStorage(workspace, workspaceStorage);
if (!restoredWorkspace) {
  workspace.open(DEFAULT_SAMPLE_URI, defaultSampleDocument);
  workspace.open("file:///maldives/second.ts", secondDocument);
  workspace.switchTo(DEFAULT_SAMPLE_URI);
}
installWorkspacePersistence({ workspace, editor, storage: workspaceStorage });
const readyModel = workspace.model(workspace.activeUri ?? DEFAULT_SAMPLE_URI) ?? workspace.open(DEFAULT_SAMPLE_URI, defaultSampleDocument);
installWorkspaceTabStrip(document.body, workspace);
const fileSystemAdapter = new FileSystemAccessAdapter();
const toolWindows = installToolWindowController(document.body);
const vcsPanel = installVcsPanelController(document.body);
const runDebugPanel = installRunDebugPanelController(document.body);
const terminalPanel = installTerminalPanelController(document.body, { token: "maldives-terminal-session", theme: themeConfig.console });
const favoritesPanel = installFavoritesPanelController(document.body);
const findInFiles = installFindInFilesPanel(document.body, { adapter: fileSystemAdapter, editor, workspace });
const crossFileLsp = installCrossFileLspController({ monaco, editor, workspace });
installReadWriteToggle(document.body, { monaco, editor, workspace, adapter: fileSystemAdapter });
const registeredKeybindings = registerKeybindings(editor, monaco, keymapConfig, {
  isWriteMode: () => workspace.mode === "write",
  writeModeContextKey: WRITE_MODE_CONTEXT_KEY,
  toolWindows,
  vcsPanel,
  runDebugPanel,
  terminalPanel,
  favoritesPanel,
  findInFiles,
});
registerRecentLocationTracking(editor);
registerAstStructuralSearchAction(editor);
registerSchemaJsonSchemaAction(editor);
const effectLanguageService = installEffectLanguageService(monaco, editor, { effectDtsFiles, typeScriptLibFiles });
installOpenFileButton(document.body, fileSystemAdapter, workspace);
installEffectDevToolsButton(document.body, {
  enabled: __MALDIVES_DEVTOOLS_ENABLED__,
  token: window.localStorage.getItem("maldives.devtools.token") ?? "",
});
window.__maldivesEditor = editor;
window.__maldivesEffectLanguageService = effectLanguageService;
window.__maldivesWorkspace = workspace;
window.__maldivesFileSystemAdapter = fileSystemAdapter;
window.__maldivesToolWindows = toolWindows;
window.__maldivesVcsPanel = vcsPanel;
window.__maldivesRunDebugPanel = runDebugPanel;
window.__maldivesFavoritesPanel = favoritesPanel;
window.__maldivesFindInFiles = findInFiles;
window.__maldivesCrossFileLsp = crossFileLsp;
window.__maldivesTerminalPanel = {
  execute(line, token) {
    const context = terminalContextFromEditor(editor);
    return context ? terminalPanel.execute(line, context, token) : { ok: false, output: "ENOENT: no active editor model" };
  },
};
window.__maldivesSaveActiveFile = () => saveActiveWorkspaceFile({ adapter: fileSystemAdapter, workspace, editor, userGesture: true });
window.__maldivesVscodeTsWorkerReady = vscodeTsWorkerReady;
window.__maldivesReady = (async () => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await vscodeTsWorkerReady;
  await awaitTypeScriptWorkerAnswer(monaco, readyModel);
  await ensureAstReady();
  if (workspace.activeUri) {
    workspace.switchTo(workspace.activeUri);
  }
})();
window.__maldivesKeybindings = registeredKeybindings;
window.__maldivesExecuteKeybinding = (wsActionId) => {
  const registered = registeredKeybindings.find(
    (action) => action.wsActionId === wsActionId || (wsActionId === "AceJump" && action.wsActionId === "AceJumpAction"),
  );

  if (!registered) {
    return false;
  }

  if (isCustomTextMutationAction(registered.wsActionId) || registered.wsActionId === "SelectNextOccurrence" || registered.wsActionId === "UnselectPreviousOccurrence") {
    registered.run();
  } else {
    editor.trigger("maldives", registered.commandId, null);
  }
  return true;
};

if (
  editorOptions.removeTrailingBlankLines ||
  editorOptions.trimAutoWhitespace ||
  editorOptions.insertFinalNewline
) {
  editor.onDidBlurEditorText(() => {
    if (workspace.mode !== "write") {
      return;
    }

    const model = editor.getModel();

    if (model) {
      cleanOnBlurFromModel(model, editorOptions);
    }
  });
}
