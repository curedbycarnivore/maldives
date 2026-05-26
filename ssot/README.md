# WebStorm SSOT — READ ONLY

These files are the source of truth. **Never modify.** Direct copies from WebStorm 2025.2.

## Files

- `colors/active-theme.icls` — THE ACTIVE THEME: "rad rad Tomorrow Night Eighties copy copy" (3195 lines)
- `colors/Tomorrow Night Eighties.icls` — NOT active, kept for reference only
- `keymaps/leet hax.xml` — custom keymap (230 actions, parent: Mac OS X 10.5+)
- `options/editor.xml` — behavioral settings (trailing spaces, newlines, breadcrumbs)

## Real active-theme.icls values

- Editor bg: `#2d2d2d` | Gutter: `#2D2D2D`
- Line highlight: `#283932` | Selection: `#5E404A`
- Caret: `#D4E3FE` | Line numbers: `#CCCCCC`
- Font: `JetBrains Mono` 14px (fallback: `Fira Code`)
- JS.KEYWORD: `#cc8a9b` | JS.STRING: `#e2844e` | JS.NUMBER: `#f99157`
- JS.LINE_COMMENT: `#969696` | JS.INSTANCE_MEMBER_FUNCTION: `#74aee8`

## Refresh from live WebStorm

```bash
WS=~/Library/Application\ Support/JetBrains/WebStorm2025.2
cp "$WS/colors/rad rad Tomorrow Night Eighties  copy copy.icls" ssot/colors/active-theme.icls
cp "$WS/keymaps/leet hax.xml" ssot/keymaps/
cp "$WS/options/editor.xml" ssot/options/
chmod -w ssot/colors/active-theme.icls ssot/keymaps/leet\ hax.xml ssot/options/editor.xml
```
