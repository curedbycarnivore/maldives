export const effectLanguageServicePluginConfig = {
  name: "@effect/language-service",
  diagnostics: true,
  refactors: true,
  diagnosticSeverity: {
    floatingEffect: "error",
    missingEffectContext: "error",
    missingEffectError: "error",
    missingLayerContext: "error",
    missingStarInYieldEffectGen: "error",
    asyncFunction: "warning",
  },
} as const;
