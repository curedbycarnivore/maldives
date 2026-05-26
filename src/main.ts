import * as monaco from "monaco-editor";
import activeThemeXml from "../ssot/colors/active-theme.icls?raw";
import keymapXml from "../ssot/keymaps/leet hax.xml?raw";
import editorOptionsXml from "../ssot/options/editor.xml?raw";
import { registerKeybindings, type RegisteredMaldivesAction } from "./keybindings";
import { parseEditorOptions } from "./parsers/editor-options-parser";
import { parseIcls } from "./parsers/icls-parser";
import { parseKeymap } from "./parsers/keymap-parser";
import { registerTheme, THEME_NAME } from "./theme";

declare global {
  interface Window {
    __maldivesEditor: monaco.editor.IStandaloneCodeEditor;
    __monaco: typeof monaco;
    __maldivesKeybindings: RegisteredMaldivesAction[];
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
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

const themeConfig = parseIcls(activeThemeXml);
const editorOptions = parseEditorOptions(editorOptionsXml);
const keymapConfig = parseKeymap(keymapXml);

registerTheme(monaco, themeConfig);

window.__monaco = monaco;
const editor = monaco.editor.create(app, {
  value: sampleDocument,
  language: "typescript",
  automaticLayout: true,
  theme: THEME_NAME,
  fontFamily: `${themeConfig.fontFamily}, Fira Code, monospace`,
  fontSize: themeConfig.fontSize,
  trimAutoWhitespace: editorOptions.trimAutoWhitespace,
});
const registeredKeybindings = registerKeybindings(editor, monaco, keymapConfig);
window.__maldivesEditor = editor;
window.__maldivesKeybindings = registeredKeybindings;
window.__maldivesExecuteKeybinding = (wsActionId) => {
  const registered = registeredKeybindings.find((action) => action.wsActionId === wsActionId);

  if (!registered) {
    return false;
  }

  editor.trigger("maldives", registered.commandId, null);
  return true;
};

if (editorOptions.insertFinalNewline) {
  editor.onDidBlurEditorText(() => {
    const model = editor.getModel();
    const value = model?.getValue();

    if (model && value && !value.endsWith("\n")) {
      const line = model.getLineCount();
      const column = model.getLineMaxColumn(line);

      model.pushEditOperations(
        [],
        [{ range: new monaco.Range(line, column, line, column), text: "\n" }],
        () => null,
      );
    }
  });
}
