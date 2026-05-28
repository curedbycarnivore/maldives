# maldives

A custom Monaco editor built to exactly match a personal WebStorm config.

**SSOT:** `ssot/` — read-only WebStorm settings. Never modify. Parser reads these to generate Monaco config.

## Config being matched
- **Keymap:** `leet hax` — 669-line custom keymap on Mac OS X 10.5+ base
- **Theme:** Tomorrow Night Eighties — Inconsolata 18pt, bg `#2d2d2d`, selection `#5E404A`

## Key bindings (critical)
- `⌥G` → SelectNextOccurrence (multi-cursor)
- `⌘⌥←/→` → word-by-hump navigation
- `⌘;` → AceJump
- `⌥1-9` → tab switching
- `⌘[` / `⌘]` → back/forward navigation

## Opt-in full Effect declarations

Maldives registers a lightweight built-in `effect` stub by default. Apps that install `effect` can opt into the full declaration tree for deeper Monaco TypeScript completions:

```ts
import { createMaldivesEditor, registerEffectDtsFiles } from "maldives";

const effectDtsFiles = import.meta.glob('/node_modules/effect/dist/dts/**/*.d.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const { editor, dispose } = createMaldivesEditor(container, { effectDtsFiles });

// Or register later against the same Monaco instance:
const effectDtsDisposable = registerEffectDtsFiles(monaco, effectDtsFiles);
```

`registerEffectDtsFiles` remaps files such as `effect/dist/dts/Effect.d.ts` to stable virtual paths like `file:///node_modules/effect/Effect.d.ts`, so sibling imports inside Effect's declarations resolve correctly.
