import { createInterface } from "node:readline/promises";
import type { BlogPostDraft } from "./types";

/**
 * 발행 직전 사람 확인.
 *
 * 한 번 올라간 글은 되돌리기 번거롭고, 제휴 링크가 걸린 글이라 잘못 올라가면 곤란합니다.
 * 그래서 실제 발행(게시) 전에는 무엇이 올라가는지 보여주고 반드시 확인을 받습니다.
 *
 * 확인을 건너뛰려면 `--yes`를 명시해야 합니다. 그리고 터미널이 아닌 곳(스크립트, CI 등)에서
 * 돌 때는 물어볼 사람이 없으므로, 조용히 발행하지 않고 멈춥니다 — 확인 없이 올라가는 경우가
 * 생기면 이 장치가 있으나 마나 하니까요.
 */

export type ConfirmOutcome =
  /** 사람이 발행에 동의함 */
  | "confirmed"
  /** 사람이 거절함 */
  | "declined"
  /** 물어볼 터미널이 없음 — 발행하지 않습니다 */
  | "no-tty";

const AFFIRMATIVE = new Set(["y", "yes", "ㅇ", "ㅇㅇ", "네", "넵", "예", "응", "발행"]);

/** 확인 질문의 답을 해석합니다. 애매하면 "아니오"입니다(빈 입력 포함). */
export function isAffirmative(answer: string): boolean {
  return AFFIRMATIVE.has(answer.trim().toLowerCase());
}

/** 본문 앞부분만 잘라 보여줍니다. 무엇이 올라가는지 감을 잡을 정도면 충분합니다. */
export function previewLines(text: string, maxLines = 6): string[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .slice(0, maxLines);
}

const BOX_WIDTH = 78;

/**
 * 터미널에서 차지하는 칸 수를 셉니다. 한글·한자·전각 문자는 두 칸입니다.
 * 글자 수로만 자르면 한글이 든 줄이 박스를 뚫고 나갑니다.
 */
export function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += isWide(char.codePointAt(0) ?? 0) ? 2 : 1;
  }
  return width;
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // 한글 자모
    (code >= 0x2e80 && code <= 0x303e) || // CJK 부수·기호
    (code >= 0x3041 && code <= 0x33ff) || // 가나·한글 호환 자모·기타
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 통합 한자
    (code >= 0xa960 && code <= 0xa97f) ||
    (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) || // 전각
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f9ff) // 이모지
  );
}

/** 표시 폭 기준으로 자릅니다. 잘리면 끝에 …를 붙입니다. */
export function truncateToWidth(value: string, maxWidth: number): string {
  if (displayWidth(value) <= maxWidth) return value;

  let result = "";
  let width = 0;
  for (const char of value) {
    const charWidth = isWide(char.codePointAt(0) ?? 0) ? 2 : 1;
    if (width + charWidth > maxWidth - 1) break;
    result += char;
    width += charWidth;
  }
  return `${result}…`;
}

/** 표시 폭 기준으로 오른쪽을 공백으로 채웁니다(라벨 정렬용). */
function padToWidth(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - displayWidth(value)));
}

/** 발행 전에 보여줄 요약. 제목·상품·태그와 본문 앞부분을 담습니다. */
export function formatConfirmationSummary(slug: string, draft: BlogPostDraft): string {
  const label = (text: string) => `  ${padToWidth(text, 12)}`;

  const lines: string[] = [];
  lines.push("─".repeat(BOX_WIDTH));
  lines.push("  올릴 글");
  lines.push(`    ${draft.title}`);
  lines.push("");
  lines.push(`${label("비교 페이지")}${slug}`);
  lines.push(`${label("상품")}${draft.includedCount}개${describeLinkCounts(draft)}`);
  lines.push(`${label("태그")}${draft.tags.join(", ")}`);
  lines.push("");
  lines.push("  본문 앞부분");
  for (const line of previewLines(draft.text)) {
    lines.push(`    ${line}`);
  }
  lines.push("    …");
  lines.push("─".repeat(BOX_WIDTH));

  return lines.map((line) => truncateToWidth(line, BOX_WIDTH)).join("\n");
}

function describeLinkCounts(draft: BlogPostDraft): string {
  const notes: string[] = [];
  if (draft.unlinkedAsins.length > 0) {
    notes.push(`제휴 링크 없음 ${draft.unlinkedAsins.length}개`);
  }
  if (draft.pendingAsins.length > 0) {
    notes.push(`갱신 전이라 제외 ${draft.pendingAsins.length}개`);
  }
  return notes.length > 0 ? ` (${notes.join(", ")})` : "";
}

/**
 * 요약을 보여주고 발행 여부를 묻습니다.
 * 기본값은 "아니오"입니다 — 엔터만 쳐도 올라가지 않습니다.
 */
export async function askToPublish(summary: string): Promise<ConfirmOutcome> {
  console.log(`\n${summary}`);

  if (!process.stdin.isTTY) {
    return "no-tty";
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("  이대로 네이버 블로그에 발행할까요? [y/N] ");
    return isAffirmative(answer) ? "confirmed" : "declined";
  } finally {
    rl.close();
  }
}
