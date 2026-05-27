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
