import * as monaco from "monaco-editor";
import activeThemeXml from "../ssot/colors/active-theme.icls?raw";
import keymapXml from "../ssot/keymaps/leet hax.xml?raw";
import editorOptionsXml from "../ssot/options/editor.xml?raw";
import { registerEffectSnippets } from "./effect-snippets";
import { cleanOnBlurFromModel } from "./hooks/trailing-whitespace";
import { registerKeybindings } from "./keybindings";
import { parseEditorOptions } from "./parsers/editor-options-parser";
import { parseIcls } from "./parsers/icls-parser";
import { parseKeymap } from "./parsers/keymap-parser";
import { maldivesProFeatureOptions } from "./pro-features";
import { registerTheme, THEME_NAME } from "./theme";
import { configureTypeScriptWorker } from "./typescript-worker";

export interface CreateMaldivesEditorOptions {
  lspUrl?: string;
}

export interface MaldivesEditorHandle {
  editor: monaco.editor.IStandaloneCodeEditor;
  dispose: () => void;
}

export function createMaldivesEditor(
  container: HTMLElement,
  _opts: CreateMaldivesEditorOptions = {},
): MaldivesEditorHandle {
  const themeConfig = parseIcls(activeThemeXml);
  const editorOptions = parseEditorOptions(editorOptionsXml);
  const keymapConfig = parseKeymap(keymapXml);

  registerTheme(monaco, themeConfig);
  configureTypeScriptWorker(monaco);
  const snippetsDisposable = registerEffectSnippets(monaco);

  const editor = monaco.editor.create(container, {
    value: "",
    language: "typescript",
    automaticLayout: true,
    theme: THEME_NAME,
    fontFamily: `${themeConfig.fontFamily}, Fira Code, monospace`,
    fontSize: themeConfig.fontSize,
    trimAutoWhitespace: editorOptions.trimAutoWhitespace,
    ...maldivesProFeatureOptions,
  });

  registerKeybindings(editor, monaco, keymapConfig);

  const blurDisposable =
    editorOptions.removeTrailingBlankLines || editorOptions.trimAutoWhitespace || editorOptions.insertFinalNewline
      ? editor.onDidBlurEditorText(() => {
          const model = editor.getModel();

          if (model) {
            cleanOnBlurFromModel(model, editorOptions);
          }
        })
      : undefined;

  return {
    editor,
    dispose() {
      blurDisposable?.dispose();
      snippetsDisposable.dispose();
      editor.dispose();
    },
  };
}
