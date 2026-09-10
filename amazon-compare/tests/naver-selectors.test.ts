import { describe, expect, it } from "vitest";
import { DEFAULT_SELECTORS, mergeSelectors } from "@/lib/naver-blog/selectors";

describe("mergeSelectors", () => {
  it("지정한 키만 바꾸고 나머지는 기본값을 유지한다", () => {
    const merged = mergeSelectors(DEFAULT_SELECTORS, {
      publishOpenButton: ["button.my-publish"],
    });
    expect(merged.publishOpenButton).toEqual(["button.my-publish"]);
    expect(merged.titleInput).toEqual(DEFAULT_SELECTORS.titleInput);
  });

  it("문자열 하나만 줘도 배열로 받아준다", () => {
    const merged = mergeSelectors(DEFAULT_SELECTORS, { tagInput: "#my-tag" });
    expect(merged.tagInput).toEqual(["#my-tag"]);
  });

  it("기본값을 건드리지 않는다", () => {
    const before = [...DEFAULT_SELECTORS.publishOpenButton];
    mergeSelectors(DEFAULT_SELECTORS, { publishOpenButton: ["button.my-publish"] });
    expect(DEFAULT_SELECTORS.publishOpenButton).toEqual(before);
  });

  it("오타 난 키는 조용히 넘기지 않고 알려준다", () => {
    expect(() => mergeSelectors(DEFAULT_SELECTORS, { publishButton: ["x"] })).toThrow(
      /알 수 없는 선택자 키 "publishButton"/
    );
  });

  it("빈 값은 거부한다", () => {
    expect(() => mergeSelectors(DEFAULT_SELECTORS, { tagInput: [] })).toThrow(/비어 있지 않은 문자열/);
    expect(() => mergeSelectors(DEFAULT_SELECTORS, { tagInput: ["  "] })).toThrow(/비어 있지 않은 문자열/);
  });

  it("최상위가 객체가 아니면 거부한다", () => {
    expect(() => mergeSelectors(DEFAULT_SELECTORS, ["#id"])).toThrow(/객체여야 합니다/);
    expect(() => mergeSelectors(DEFAULT_SELECTORS, null)).toThrow(/객체여야 합니다/);
  });
});
