import { mkdir, mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const DEVTOOLS_TOKEN = "test-devtools-token";

test("Effect DevTools panel streams a real local bridge span and rejects cross-origin sockets", async ({ browser, page }) => {
  const { default: bridgeModule } = await import("../scripts/effect-devtools-bridge.cjs");
  const { startEffectDevToolsBridge } = bridgeModule as {
    startEffectDevToolsBridge: (options: { enabled: boolean; tokenFile: string; port: number }) => Promise<{
      publish: (event: { type: "span"; name: string; status: string; attributes: Record<string, string> }) => void;
      close: () => Promise<void>;
    }>;
  };
  const dir = await mkdtemp(join(tmpdir(), "maldives-devtools-e2e-"));
  const tokenFile = join(dir, "devtools.token");
  await writeFile(tokenFile, DEVTOOLS_TOKEN, "utf8");
  await chmod(tokenFile, 0o600);
  const bridge = await startEffectDevToolsBridge({ tokenFile, port: 34437, enabled: true });

  try {
    await loadEditor(page);

    await page.evaluate((token) => {
      window.__maldivesOpenEffectDevTools({
        enabled: true,
        token,
        url: "ws://127.0.0.1:34437",
      });
    }, DEVTOOLS_TOKEN);

    await page.locator(".maldives-effect-devtools").waitFor({ state: "visible", timeout: 8000 });
    bridge.publish({
      type: "span",
      name: "maldives-real-bridge-span",
      status: "completed",
      attributes: { route: "Effect.gen", unsafe: "<script>alert(1)</script>" },
    });

    await expect(page.locator(".maldives-effect-devtools")).toContainText("maldives-real-bridge-span", { timeout: 8000 });
    await expect(page.locator(".maldives-effect-devtools")).toContainText("Effect.gen");
    // SG-P11D-5: untrusted span attributes render as text, never executable HTML.
    await expect(page.locator(".maldives-effect-devtools")).toContainText("<script>alert(1)</script>");
    await expect(page.locator(".maldives-effect-devtools script")).toHaveCount(0);

    const hostile = await browser.newPage();
    await hostile.goto("data:text/html,<title>hostile</title>");
    const rejected = await hostile.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const ws = new WebSocket("ws://127.0.0.1:34437");
          ws.onopen = () => resolve(false);
          ws.onerror = () => resolve(true);
          ws.onclose = () => resolve(true);
          setTimeout(() => resolve(false), 2000);
        }),
    );
    await hostile.close();

    expect(rejected).toBe(true);

    await mkdir("proof", { recursive: true });
    await page.screenshot({ path: "proof/p11d-effect-devtools-panel-proof.png" });
  } finally {
    await bridge.close();
    await rm(dir, { recursive: true, force: true });
  }
});
