import type * as monaco from "monaco-editor";

export const maldivesProFeatureOptions = {
  "semanticHighlighting.enabled": true,
  bracketPairColorization: {
    enabled: true,
    independentColorPoolPerBracketType: true,
  },
  guides: { bracketPairs: true, indentation: true },
  stickyScroll: { enabled: true, maxLineCount: 5, defaultModel: "indentationModel" },
  inlayHints: {
    enabled: "on",
    fontSize: 12,
    fontFamily: "JetBrains Mono",
  },
} satisfies monaco.editor.IStandaloneEditorConstructionOptions;
