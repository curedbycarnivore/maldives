import * as monaco from "monaco-editor";
import activeThemeXml from "../ssot/colors/active-theme.icls?raw";
import keymapXml from "../ssot/keymaps/leet hax.xml?raw";
import editorOptionsXml from "../ssot/options/editor.xml?raw";
import { initializeAstSmartSelection } from "./ast-smart-selection";
import { registerAstStructuralSearchAction } from "./ast-structural-search";
import { registerMaldivesCodeActions } from "./code-actions";
import { registerSchemaJsonSchemaAction } from "./schema-jsonschema";
import { registerEffectSnippets } from "./effect-snippets";
import { registerModelTab, registerRecentLocationTracking } from "./file-switcher";
import { cleanOnBlurFromModel } from "./hooks/trailing-whitespace";
import { registerKeybindings } from "./keybindings";
import { parseEditorOptions } from "./parsers/editor-options-parser";
import { parseIcls } from "./parsers/icls-parser";
import { parseKeymap } from "./parsers/keymap-parser";
import { maldivesProFeatureOptions } from "./pro-features";
import { registerTheme, THEME_NAME } from "./theme";
import { configureTypeScriptWorker, type EffectDtsFiles } from "./typescript-worker";

export interface CreateMaldivesEditorOptions {
  lspUrl?: string;
  effectDtsFiles?: EffectDtsFiles;
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
  configureTypeScriptWorker(monaco, { effectDtsFiles: _opts.effectDtsFiles });
  const snippetsDisposable = registerEffectSnippets(monaco);
  const codeActionsDisposable = registerMaldivesCodeActions(monaco);
  void initializeAstSmartSelection().catch(() => undefined);

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

  const model = editor.getModel();

  if (model) {
    registerModelTab(model);
  }

  registerKeybindings(editor, monaco, keymapConfig);
  const recentLocationsDisposable = registerRecentLocationTracking(editor);
  const astStructuralSearchDisposable = registerAstStructuralSearchAction(editor);
  const schemaJsonSchemaDisposable = registerSchemaJsonSchemaAction(editor);

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
      recentLocationsDisposable.dispose();
      astStructuralSearchDisposable.dispose();
      schemaJsonSchemaDisposable.dispose();
      codeActionsDisposable.dispose();
      snippetsDisposable.dispose();
      editor.dispose();
    },
  };
}

export { registerEffectDtsFiles } from "./typescript-worker";
export type { EffectDtsFiles } from "./typescript-worker";
