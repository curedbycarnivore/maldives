import * as monaco from "monaco-editor";
import "monaco-editor/esm/vs/basic-languages/coffee/coffee.contribution.js";
import activeThemeXml from "../ssot/colors/active-theme.icls?raw";
import keymapXml from "../ssot/keymaps/leet hax.xml?raw";
import editorOptionsXml from "../ssot/options/editor.xml?raw";
import { ensureAstReady } from "./ast-smart-selection";
import { registerAstStructuralSearchAction } from "./ast-structural-search";
import { registerMaldivesCodeActions } from "./code-actions";
import { registerSchemaJsonSchemaAction } from "./schema-jsonschema";
import { installEffectDevToolsButton, openEffectDevToolsPanel, type OpenEffectDevToolsOptions } from "./effect-devtools";
import { installEffectLanguageService, type EffectLanguageServiceController } from "./effect-language-service";
import { registerEffectHoverProvider } from "./effect-hover";
import { registerEffectSnippets } from "./effect-snippets";
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
import { registerTheme, THEME_NAME } from "./theme";
import { installToolWindowController, type ToolWindowController } from "./tool-windows";
import { configureTypeScriptWorker, registerEffectDtsFiles, type EffectDtsFiles, type RegisterEffectDtsFilesOptions } from "./typescript-worker";
import { startVscodeTypeScriptWorkerForMaldives, type VscodeTypeScriptWorkerBootstrap } from "./vscode-ts-worker";
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

const sampleDocument = `// Maldives deterministic sample
const camelCaseWord = "string value";
let snake_case = 123;
class XMLParser {
  parse(word123: number) {
    return camelCaseWord + snake_case + word123;
  }
}

camelCaseWord;
camelCaseWord;
`;

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
const sampleModel = monaco.editor.createModel(sampleDocument, "typescript", monaco.Uri.parse("file:///maldives/sample.ts"));
const secondModel = monaco.editor.createModel(secondDocument, "typescript", monaco.Uri.parse("file:///maldives/second.ts"));
registerModelTab(sampleModel);
registerModelTab(secondModel);
const editor = monaco.editor.create(app, {
  model: sampleModel,
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
const fileSystemAdapter = new FileSystemAccessAdapter();
const toolWindows = installToolWindowController(document.body);
installReadWriteToggle(document.body, { monaco, editor, workspace, adapter: fileSystemAdapter });
const registeredKeybindings = registerKeybindings(editor, monaco, keymapConfig, {
  isWriteMode: () => workspace.mode === "write",
  writeModeContextKey: WRITE_MODE_CONTEXT_KEY,
  toolWindows,
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
window.__maldivesSaveActiveFile = () => saveActiveWorkspaceFile({ adapter: fileSystemAdapter, workspace, editor, userGesture: true });
window.__maldivesVscodeTsWorkerReady = vscodeTsWorkerReady;
window.__maldivesReady = (async () => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await vscodeTsWorkerReady;
  await awaitTypeScriptWorkerAnswer(monaco, sampleModel);
  await ensureAstReady();
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
