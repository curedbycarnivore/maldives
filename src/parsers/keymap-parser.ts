export interface KeymapConfig {
  name: string;
  parent: string;
  actions: KeyAction[];
}

export interface KeyAction {
  id: string;
  shortcuts: string[];
}

export function parseKeymap(xmlContent: string): KeymapConfig {
  const keymapAttributes = xmlContent.match(/<keymap\b([^>]*)>/)?.[1] ?? "";

  return {
    name: attributeValue(keymapAttributes, "name"),
    parent: attributeValue(keymapAttributes, "parent"),
    actions: actionBlocks(xmlContent).map(({ attributes, body }) => ({
      id: attributeValue(attributes, "id"),
      shortcuts: keyboardShortcuts(body),
    })),
  };
}

function actionBlocks(xmlContent: string): Array<{ attributes: string; body: string }> {
  return Array.from(xmlContent.matchAll(/<action\b((?:(?!\/>).)*)>([\s\S]*?)<\/action>|<action\b([^>]*)\/>/g)).map(
    (match) => ({
      attributes: match[1] ?? match[3] ?? "",
      body: match[2] ?? "",
    }),
  );
}

function keyboardShortcuts(actionBody: string): string[] {
  return Array.from(actionBody.matchAll(/<keyboard-shortcut\b([^>]*)\/>/g)).map((match) =>
    attributeValue(match[1], "first-keystroke"),
  );
}

function attributeValue(attributes: string, name: string): string {
  return attributes.match(new RegExp(`${escapeRegExp(name)}="([^"]*)"`))?.[1] ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
