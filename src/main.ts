import * as monaco from "monaco-editor";
import activeThemeXml from "../ssot/colors/active-theme.icls?raw";
import keymapXml from "../ssot/keymaps/leet hax.xml?raw";
import editorOptionsXml from "../ssot/options/editor.xml?raw";
import { initializeAstSmartSelection } from "./ast-smart-selection";
import { registerAstStructuralSearchAction } from "./ast-structural-search";
import { registerMaldivesCodeActions } from "./code-actions";
import { registerEffectSnippets } from "./effect-snippets";
import { registerModelTab, registerRecentLocationTracking } from "./file-switcher";
import { cleanOnBlurFromModel } from "./hooks/trailing-whitespace";
import { registerKeybindings, type RegisteredMaldivesAction } from "./keybindings";
import { parseEditorOptions } from "./parsers/editor-options-parser";
import { parseIcls } from "./parsers/icls-parser";
import { parseKeymap } from "./parsers/keymap-parser";
import { maldivesProFeatureOptions } from "./pro-features";
import { registerTheme, THEME_NAME } from "./theme";
import { configureTypeScriptWorker, registerEffectDtsFiles, type EffectDtsFiles } from "./typescript-worker";

declare global {
  interface Window {
    __maldivesEditor: monaco.editor.IStandaloneCodeEditor;
    __monaco: typeof monaco;
    __maldivesKeybindings: RegisteredMaldivesAction[];
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
    __maldivesRegisterEffectDtsFiles: (files: EffectDtsFiles) => monaco.IDisposable;
  }
}

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

const themeConfig = parseIcls(activeThemeXml);
const editorOptions = parseEditorOptions(editorOptionsXml);
const keymapConfig = parseKeymap(keymapXml);

registerTheme(monaco, themeConfig);
configureTypeScriptWorker(monaco);
registerEffectSnippets(monaco);
registerMaldivesCodeActions(monaco);
void initializeAstSmartSelection().catch(() => undefined);

window.__monaco = monaco;
window.__maldivesRegisterEffectDtsFiles = (files) => registerEffectDtsFiles(monaco, files);
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
const registeredKeybindings = registerKeybindings(editor, monaco, keymapConfig);
registerRecentLocationTracking(editor);
registerAstStructuralSearchAction(editor);
window.__maldivesEditor = editor;
window.__maldivesKeybindings = registeredKeybindings;
window.__maldivesExecuteKeybinding = (wsActionId) => {
  const registered = registeredKeybindings.find(
    (action) => action.wsActionId === wsActionId || (wsActionId === "AceJump" && action.wsActionId === "AceJumpAction"),
  );

  if (!registered) {
    return false;
  }

  editor.trigger("maldives", registered.commandId, null);
  return true;
};

if (
  editorOptions.removeTrailingBlankLines ||
  editorOptions.trimAutoWhitespace ||
  editorOptions.insertFinalNewline
) {
  editor.onDidBlurEditorText(() => {
    const model = editor.getModel();

    if (model) {
      cleanOnBlurFromModel(model, editorOptions);
    }
  });
}
