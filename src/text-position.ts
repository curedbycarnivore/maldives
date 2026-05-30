export interface OneBasedTextPosition {
  line: number;
  col: number;
}

export function positionAt(source: string, offset: number): OneBasedTextPosition {
  let line = 1;
  let col = 1;

  for (let i = 0; i < offset; i += 1) {
    if (source[i] === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }

  return { line, col };
}
