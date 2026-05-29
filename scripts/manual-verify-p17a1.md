# P17a1 manual verification — File System Access read

Headless Playwright cannot drive Chromium's native File System Access picker, so this step is manual by design.

1. `cd /Users/jrad/maldives && bun run dev`
2. Open `http://127.0.0.1:5173/` in a real Chromium browser.
3. Click the fixed **Open file** button in the lower-left corner.
4. Pick a real `.ts` or `.tsx` file from disk.
5. Confirm the editor switches to that file and its actual contents are visible.
6. Confirm this is read-only adapter work only: no save/write prompt should appear in P17a1.
