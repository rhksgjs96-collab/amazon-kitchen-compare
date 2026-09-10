import { describe, expect, it } from "vitest";
import {
  displayWidth,
  formatConfirmationSummary,
  isAffirmative,
  previewLines,
  truncateToWidth,
} from "@/lib/naver-blog/confirm";
import { buildBlogPost } from "@/lib/naver-blog/post-builder";
import type { BlogProduct, BlogSource } from "@/lib/naver-blog/types";

const NOW = new Date("2026-09-10T01:00:00Z");

function product(overrides: Partial<BlogProduct> = {}): BlogProduct {
  return {
    asin: "B000000001",
    title: "Acme 10-Inch Non-Stick Frying Pan",
    features: ["Hard-anodized aluminum"],
    priceDisplay: "$29.99",
    availability: "In Stock",
    affiliateUrl: "https://www.amazon.com/dp/B000000001?tag=mystore-20",
    ...overrides,
  };
}

function draftFrom(products: BlogProduct[]) {
  const source: BlogSource = {
    slug: "best-frying-pans",
    title: "Best Non-Stick Frying Pans",
    description: "Six pans tested for even heating.",
    categoryName: "Cookware",
    products,
    siteUrl: null,
  };
  return buildBlogPost(source, NOW);
}

describe("isAffirmative", () => {
  it("동의로 볼 만한 답만 통과시킨다", () => {
    for (const answer of ["y", "Y", "yes", "YES", " yes ", "네", "ㅇ", "ㅇㅇ", "예", "응"]) {
      expect(isAffirmative(answer), answer).toBe(true);
    }
  });

  it("엔터만 치면 발행하지 않는다 (기본값은 아니오)", () => {
    expect(isAffirmative("")).toBe(false);
    expect(isAffirmative("   ")).toBe(false);
  });

  it("거절이나 애매한 답은 전부 아니오로 본다", () => {
    for (const answer of ["n", "no", "ㄴ", "아니", "아니오", "ye", "yeah", "나중에", "?"]) {
      expect(isAffirmative(answer), answer).toBe(false);
    }
  });
});

describe("previewLines", () => {
  it("빈 줄은 빼고 앞에서부터 정해진 줄 수만 보여준다", () => {
    expect(previewLines("첫 줄\n\n둘째 줄\n\n\n셋째 줄\n넷째 줄", 3)).toEqual([
      "첫 줄",
      "둘째 줄",
      "셋째 줄",
    ]);
  });

  it("줄 수가 모자라면 있는 만큼만 준다", () => {
    expect(previewLines("한 줄뿐", 6)).toEqual(["한 줄뿐"]);
  });
});

describe("formatConfirmationSummary", () => {
  it("무엇이 올라가는지 알 수 있게 제목·slug·상품 수·태그를 보여준다", () => {
    const summary = formatConfirmationSummary("best-frying-pans", draftFrom([product()]));
    expect(summary).toContain("Best Non-Stick Frying Pans");
    expect(summary).toContain("best-frying-pans");
    expect(summary).toMatch(/상품 +1개/);
    expect(summary).toContain("아마존직구");
  });

  it("본문 앞부분에 대가성 표시가 보이도록 한다", () => {
    const summary = formatConfirmationSummary("best-frying-pans", draftFrom([product()]));
    expect(summary).toContain("Amazon 어소시에이트 제휴 링크가 포함되어 있습니다");
  });

  it("링크 없는 상품과 제외된 상품이 있으면 개수를 알려준다", () => {
    const summary = formatConfirmationSummary(
      "best-frying-pans",
      draftFrom([
        product(),
        product({ asin: "B02", affiliateUrl: null }),
        product({ asin: "B03", title: null }),
      ])
    );
    expect(summary).toContain("제휴 링크 없음 1개");
    expect(summary).toContain("갱신 전이라 제외 1개");
  });

  it("특별히 알릴 것이 없으면 상품 수만 적는다", () => {
    const summary = formatConfirmationSummary("best-frying-pans", draftFrom([product()]));
    expect(summary).toMatch(/상품 +1개\n/);
    expect(summary).not.toContain("제휴 링크 없음");
  });

  it("제목은 잘리지 않고 전부 보인다", () => {
    const draft = draftFrom([product()]);
    const summary = formatConfirmationSummary("best-frying-pans", draft);
    expect(summary).toContain(draft.title);
  });

  it("한글이 든 줄도 표시 폭 기준으로 박스를 넘지 않는다", () => {
    const summary = formatConfirmationSummary(
      "best-frying-pans",
      draftFrom([product({ title: "아주아주 긴 한글 상품명".repeat(8) })])
    );
    for (const line of summary.split("\n")) {
      expect(displayWidth(line), line).toBeLessThanOrEqual(78);
    }
  });
});

describe("displayWidth / truncateToWidth", () => {
  it("한글은 두 칸, 영문·숫자는 한 칸으로 센다", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("한글")).toBe(4);
    expect(displayWidth("a한b글")).toBe(6);
  });

  it("폭에 들어가면 그대로 둔다", () => {
    expect(truncateToWidth("한글", 10)).toBe("한글");
    expect(truncateToWidth("abcde", 5)).toBe("abcde");
  });

  it("넘치면 …를 붙여 자르고, 결과가 폭을 넘지 않는다", () => {
    const result = truncateToWidth("한글한글한글한글", 8);
    expect(result.endsWith("…")).toBe(true);
    expect(displayWidth(result)).toBeLessThanOrEqual(8);
  });

  it("두 칸짜리 글자가 경계에 걸려도 폭을 넘기지 않는다", () => {
    // 폭 5에 한글 두 글자(4칸) + … (1칸) = 5칸이 최대입니다.
    expect(displayWidth(truncateToWidth("한글한글", 5))).toBeLessThanOrEqual(5);
  });
});
