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
import type { EffectDtsFiles } from "maldives";

const effectDtsFiles = import.meta.glob('/node_modules/effect/dist/dts/**/*.d.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as EffectDtsFiles;

const { editor, dispose } = createMaldivesEditor(container, { effectDtsFiles });

// Or register later against the same Monaco instance:
const effectDtsDisposable = registerEffectDtsFiles(monaco, effectDtsFiles);
```

`registerEffectDtsFiles` remaps files such as `effect/dist/dts/Effect.d.ts` to stable virtual paths like `file:///node_modules/effect/Effect.d.ts`, so sibling imports inside Effect's declarations resolve correctly.

## Opt-in Effect DevTools panel

The runtime DevTools bridge is off by default. To show the local panel in development, start Vite with:

```sh
MALDIVES_DEVTOOLS=1 bun run dev
```

The browser client only connects to `ws://127.0.0.1:34437` / `ws://localhost:34437`, sends a pre-shared token as its first frame, bounds incoming frames/events, and renders all wire data with `textContent` (no trusted HTML). Store the token at `~/.config/maldives/devtools.token` with file mode `0600` and copy it into `localStorage.maldives.devtools.token` for the local UI.

Never enable DevTools against a process holding production secrets; Effect spans and metrics can include raw attribute values.
