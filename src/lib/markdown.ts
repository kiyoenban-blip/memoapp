import { marked, Lexer } from "marked";
import DOMPurify from "dompurify";
// Derive task locations from parser tokens, excluding fenced code and raw HTML.
export function taskLines(body: string): number[] {
  const lines: number[] = [];
  function visit(tokens: any[], start: number) {
    let line = start;
    for (const token of tokens) {
      if (token.type === "list") {
        let itemLine = line;
        for (const item of token.items) {
          if (item.task) lines.push(itemLine);
          visit(item.tokens ?? [], itemLine);
          itemLine += (item.raw.match(/\n/g) ?? []).length;
        }
      } else if (token.type === "blockquote") visit(token.tokens ?? [], line);
      line += ((token.raw ?? "").match(/\n/g) ?? []).length;
    }
  }
  visit(Lexer.lex(body), 0);
  return [...new Set(lines)].sort((a, b) => a - b);
}
export function toggleTask(body: string, index: number) {
  const lines = body.split("\n");
  const row = taskLines(body)[index];
  if (row === undefined) return body;
  lines[row] = lines[row].replace(
    /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+\[)([ xX])(\])/,
    (_, a, b, c) => a + (b === " " ? "x" : " ") + c,
  );
  return lines.join("\n");
}
export function progress(body: string) {
  const lines = body.split("\n");
  const tasks = taskLines(body);
  return {
    total: tasks.length,
    done: tasks.filter((i) =>
      /^\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+\[[xX]\]/.test(lines[i]),
    ).length,
  };
}
export function renderMarkdown(body: string) {
  const renderer = new marked.Renderer();
  let taskIndex = 0;
  renderer.html = () => "";
  renderer.checkbox = ({ checked }) =>
    `<input type="checkbox" data-task="${taskIndex++}" aria-label="할 일 완료" ${checked ? "checked" : ""}>`;
  return DOMPurify.sanitize(
    marked.parse(body, { renderer, async: false }) as string,
    { ADD_ATTR: ["data-task"], FORBID_TAGS: ["style", "iframe", "form"] },
  );
}
