declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "@effect/language-service" {
  import type * as ts from "typescript";

  const init: (modules: { typescript: typeof ts }) => { create(info: unknown): ts.LanguageService };
  export default init;
}
