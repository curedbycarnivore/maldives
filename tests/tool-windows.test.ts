import { describe, expect, test } from "vitest";
import { createToolWindowController, toolWindowTitleForAction } from "../src/tool-windows";

describe("IDE-shell tool windows", () => {
  test("activates, cycles, and hides real tool-window panel state", () => {
    const controller = createToolWindowController();

    expect(toolWindowTitleForAction("ActivateTerminalToolWindow")).toBe("Terminal");

    controller.activateAction("ActivateTerminalToolWindow");
    expect(controller.activeId).toBe("terminal");
    expect(controller.snapshot()).toMatchObject({ title: "Terminal" });

    controller.activateAction("ActivateVersionControlToolWindow");
    expect(controller.activeId).toBe("version-control");
    expect(controller.snapshot()).toMatchObject({ title: "Version Control" });

    controller.nextWindow();
    expect(controller.activeId).toBe("terminal");

    controller.hideActiveWindow();
    expect(controller.activeId).toBeUndefined();
    expect(controller.snapshot()).toBeUndefined();
  });
});
