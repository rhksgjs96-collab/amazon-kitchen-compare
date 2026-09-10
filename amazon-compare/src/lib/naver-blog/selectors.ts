/**
 * 네이버 로그인 화면과 스마트에디터 ONE의 DOM 선택자 모음.
 *
 * 네이버는 예고 없이 화면 구조를 바꾸고, 클래스 이름에 붙는 해시(publish_btn__m9KHH 같은)도
 * 배포마다 달라집니다. 그래서 여기서는
 *   1) 후보를 여러 개 두고 먼저 보이는 것을 쓰고,
 *   2) 해시가 바뀌어도 살아남도록 `[class*="publish_btn"]` 같은 부분 일치를 우선 쓰며,
 *   3) 그래도 깨지면 코드를 고치지 않고 JSON 파일로 덮어쓸 수 있게 했습니다.
 *
 * 덮어쓰려면 NAVER_SELECTORS_FILE에 JSON 경로를 지정하세요. 예:
 *   { "publishOpenButton": ["button.내가_찾은_클래스"] }
 * 지정한 키만 교체되고 나머지는 기본값을 그대로 씁니다.
 */

import { readFileSync } from "node:fs";

export interface NaverSelectors {
  loginIdInput: string[];
  loginPwInput: string[];
  loginSubmit: string[];
  /** "새로운 기기 등록" 화면의 [등록안함] 버튼. */
  deviceRegisterSkip: string[];
  /** 자동입력 방지문자(캡차)가 떴는지 판단할 요소. */
  captchaIndicator: string[];
  /** 에디터가 들어 있는 iframe. 없으면 최상위 문서를 씁니다. */
  editorFrame: string[];
  /** "작성 중이던 글이 있습니다" 팝업의 [취소]. */
  restorePopupCancel: string[];
  /** 처음 켤 때 뜨는 도움말 패널 닫기. */
  helpPanelClose: string[];
  titleInput: string[];
  bodyInput: string[];
  /** 우측 상단 [발행] — 발행 설정 레이어를 엽니다. */
  publishOpenButton: string[];
  /** 발행 설정 레이어 안의 최종 [발행]. */
  publishConfirmButton: string[];
  tagInput: string[];
  categorySelectButton: string[];
  categoryOption: string[];
  /** 우측 상단 [저장] — 임시저장. */
  saveDraftButton: string[];
}

export const DEFAULT_SELECTORS: NaverSelectors = {
  loginIdInput: ["#id", "input[name='id']"],
  loginPwInput: ["#pw", "input[name='pw']"],
  loginSubmit: ["#log\\.login", "button[type='submit'].btn_login", ".btn_login"],
  deviceRegisterSkip: ["#new\\.dontsave", "a:has-text('등록안함')", "button:has-text('등록안함')"],
  captchaIndicator: ["#captcha", ".captcha_wrap", "#captchaimg"],
  editorFrame: ["iframe#mainFrame", "iframe[name='mainFrame']"],
  restorePopupCancel: [
    ".se-popup-button-cancel",
    ".se-popup-button:has-text('취소')",
    "button:has-text('취소')",
  ],
  helpPanelClose: [".se-help-panel-close-button", "button[class*='help-panel-close']"],
  titleInput: [
    ".se-section-documentTitle .se-text-paragraph",
    ".se-documentTitle .se-text-paragraph",
    ".se-placeholder.__se_placeholder",
  ],
  bodyInput: [
    ".se-section-text .se-text-paragraph",
    ".se-component.se-text .se-text-paragraph",
  ],
  publishOpenButton: [
    "button[class*='publish_btn']",
    ".btn_publish",
    "header button:has-text('발행')",
  ],
  publishConfirmButton: [
    "button[class*='confirm_btn']",
    "div[class*='layer_publish'] button:has-text('발행')",
    "div[class*='btn_area'] button:has-text('발행')",
  ],
  tagInput: ["#tag-input", "input[class*='tag_input']", ".tag_input"],
  categorySelectButton: ["button[class*='selectbox_button']", ".selectbox_button"],
  categoryOption: ["li[class*='option_item'] button", ".option_list button", ".selectbox_list li"],
  saveDraftButton: ["button[class*='save_btn']", "header button:has-text('저장')"],
};

/**
 * 기본 선택자에 NAVER_SELECTORS_FILE의 내용을 덮어씌워 돌려줍니다.
 * 파일이 없거나 형식이 틀리면 즉시 에러를 던집니다 — 조용히 기본값으로 돌아가면
 * "덮어썼는데 왜 그대로지?" 하고 한참 헤매게 되니까요.
 */
export function loadSelectors(filePath = process.env.NAVER_SELECTORS_FILE): NaverSelectors {
  if (!filePath || filePath.trim() === "") return DEFAULT_SELECTORS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`NAVER_SELECTORS_FILE(${filePath})을 읽지 못했습니다: ${message}`);
  }

  return mergeSelectors(DEFAULT_SELECTORS, parsed, filePath);
}

export function mergeSelectors(
  base: NaverSelectors,
  override: unknown,
  sourceLabel = "override"
): NaverSelectors {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    throw new Error(`${sourceLabel}의 최상위 값은 객체여야 합니다.`);
  }

  const merged: NaverSelectors = { ...base };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (!(key in base)) {
      throw new Error(
        `${sourceLabel}에 알 수 없는 선택자 키 "${key}"가 있습니다. 쓸 수 있는 키: ${Object.keys(base).join(", ")}`
      );
    }
    const list = Array.isArray(value) ? value : [value];
    const selectors = list.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    if (selectors.length === 0) {
      throw new Error(`${sourceLabel}의 "${key}"에는 비어 있지 않은 문자열(또는 문자열 배열)이 필요합니다.`);
    }
    merged[key as keyof NaverSelectors] = selectors;
  }
  return merged;
}
