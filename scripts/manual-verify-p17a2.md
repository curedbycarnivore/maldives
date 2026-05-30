# Manual verify P17a2 — FSA write path

Automated proof uses OPFS because Chromium's File System Access picker/permission flow cannot be driven reliably in headless Playwright.

1. `cd ~/maldives && bun run dev`
2. Open `http://127.0.0.1:5173/` in real Chromium.
3. Click **Open file** and choose a small `.ts`/`.tsx` file under 5MB.
4. After P17a3 lands, click the 🔒 status toggle to enter Write mode.
5. Edit the file and press Cmd/Ctrl+S.
6. Confirm the one-session save prompt and the browser read/write permission prompt.
7. Verify the bytes changed on disk, then try a second save without the per-save gesture and confirm it is rejected.

Security gates covered by unit tests: `..` traversal rejection, granted-handle scope, per-write gesture, and 5MB cap.
