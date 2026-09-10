import { describe, expect, it } from "vitest";
import {
  ASSOCIATES_DISCLOSURE,
  SPONSORSHIP_NOTICE,
  buildBlogPost,
  buildTags,
  escapeHtml,
  formatKoreanDate,
  formatKoreanYearMonth,
  localizeAvailability,
} from "@/lib/naver-blog/post-builder";
import type { BlogProduct, BlogSource } from "@/lib/naver-blog/types";

const NOW = new Date("2026-09-10T01:00:00Z");

function product(overrides: Partial<BlogProduct> = {}): BlogProduct {
  return {
    asin: "B000000001",
    title: "Acme 10-Inch Non-Stick Frying Pan",
    features: ["Hard-anodized aluminum", "Oven safe to 500F"],
    priceDisplay: "$29.99",
    availability: "In Stock",
    affiliateUrl: "https://www.amazon.com/dp/B000000001?tag=mystore-20",
    ...overrides,
  };
}

function source(overrides: Partial<BlogSource> = {}): BlogSource {
  return {
    slug: "best-frying-pans",
    title: "Best Non-Stick Frying Pans",
    description: "Six pans tested for even heating.",
    categoryName: "Cookware",
    products: [product()],
    siteUrl: "https://example.com/compare/best-frying-pans",
    ...overrides,
  };
}

describe("buildBlogPost — 고지 문구", () => {
  it("대가성 표시를 본문 맨 앞에 넣는다 (공정위 심사지침)", () => {
    const draft = buildBlogPost(source(), NOW);
    const firstBlock = draft.html.split("\n")[0] ?? "";
    expect(firstBlock).toContain(SPONSORSHIP_NOTICE);
    expect(draft.text.split("\n")[0]).toContain(SPONSORSHIP_NOTICE);
  });

  it("Amazon 어소시에이트 영문 고지를 HTML과 평문 모두에 넣는다", () => {
    const draft = buildBlogPost(source(), NOW);
    expect(draft.html).toContain(ASSOCIATES_DISCLOSURE);
    expect(draft.text).toContain(ASSOCIATES_DISCLOSURE);
  });

  it("가격 수집 기준일을 한국 시간 기준으로 밝힌다", () => {
    const draft = buildBlogPost(source(), NOW);
    expect(draft.html).toContain("2026년 9월 10일");
    expect(draft.html).toContain("한국 시간");
  });
});

describe("buildBlogPost — 상품 선별", () => {
  it("아직 갱신되지 않은 상품(title 없음)은 빼고 pendingAsins에 남긴다", () => {
    const draft = buildBlogPost(
      source({ products: [product(), product({ asin: "B000000002", title: null })] }),
      NOW
    );
    expect(draft.includedCount).toBe(1);
    expect(draft.pendingAsins).toEqual(["B000000002"]);
    expect(draft.html).not.toContain("B000000002");
  });

  it("제목이 공백뿐인 상품도 갱신 전으로 본다", () => {
    const draft = buildBlogPost(source({ products: [product({ title: "   " })] }), NOW);
    expect(draft.includedCount).toBe(0);
    expect(draft.pendingAsins).toEqual(["B000000001"]);
  });

  it("실을 상품이 하나도 없으면 includedCount가 0이다", () => {
    const draft = buildBlogPost(source({ products: [] }), NOW);
    expect(draft.includedCount).toBe(0);
  });
});

describe("buildBlogPost — 제휴 링크 정책", () => {
  it("검증된 제휴 링크만 sponsored/nofollow로 건다", () => {
    const draft = buildBlogPost(source(), NOW);
    expect(draft.html).toContain('href="https://www.amazon.com/dp/B000000001?tag=mystore-20"');
    expect(draft.html).toContain('rel="nofollow sponsored noopener"');
    expect(draft.unlinkedAsins).toEqual([]);
  });

  it("제휴 링크가 없으면 링크를 만들지 않고 사실대로 적는다", () => {
    const draft = buildBlogPost(
      source({ products: [product({ affiliateUrl: null })] }),
      NOW
    );
    expect(draft.html).not.toContain("amazon.com");
    expect(draft.html).toContain("제휴 링크가 확인되지 않아");
    expect(draft.unlinkedAsins).toEqual(["B000000001"]);
  });

  it("평문 버전에도 같은 제휴 링크를 그대로 싣는다", () => {
    const draft = buildBlogPost(source(), NOW);
    expect(draft.text).toContain("https://www.amazon.com/dp/B000000001?tag=mystore-20");
  });
});

describe("buildBlogPost — 제목과 해시", () => {
  it("제목에 원본 제목과 상품 수, 기준 연월이 들어간다", () => {
    const draft = buildBlogPost(
      source({ products: [product(), product({ asin: "B000000002" })] }),
      NOW
    );
    expect(draft.title).toBe("Best Non-Stick Frying Pans — 아마존 2종 가격·스펙 비교 (2026.09 기준)");
  });

  it("같은 입력이면 같은 해시가 나온다", () => {
    expect(buildBlogPost(source(), NOW).contentHash).toBe(buildBlogPost(source(), NOW).contentHash);
  });

  it("가격이 바뀌면 해시도 바뀐다", () => {
    const before = buildBlogPost(source(), NOW).contentHash;
    const after = buildBlogPost(
      source({ products: [product({ priceDisplay: "$24.99" })] }),
      NOW
    ).contentHash;
    expect(after).not.toBe(before);
  });
});

describe("buildBlogPost — 원본 링크와 설명", () => {
  it("SITE_URL이 없어 siteUrl이 null이면 원본 링크 문단을 생략한다", () => {
    const draft = buildBlogPost(source({ siteUrl: null }), NOW);
    expect(draft.html).not.toContain("비교 페이지 원본");
    expect(draft.text).not.toContain("비교 페이지 원본");
  });

  it("설명이 없으면 빈 문단을 남기지 않는다", () => {
    const draft = buildBlogPost(source({ description: null }), NOW);
    expect(draft.html).not.toContain("<p></p>");
  });
});

describe("escapeHtml", () => {
  it("아마존 상품명에 들어온 특수문자를 이스케이프한다", () => {
    expect(escapeHtml('12" Pan <Pro> & Co.')).toBe("12&quot; Pan &lt;Pro&gt; &amp; Co.");
  });

  it("상품 제목의 태그가 본문 HTML로 새어 나가지 않는다", () => {
    const draft = buildBlogPost(
      source({ products: [product({ title: "<script>alert(1)</script>" })] }),
      NOW
    );
    expect(draft.html).not.toContain("<script>");
    expect(draft.html).toContain("&lt;script&gt;");
  });
});

describe("localizeAvailability", () => {
  it("자주 나오는 표현은 한국어로 바꾼다", () => {
    expect(localizeAvailability("In Stock")).toBe("재고 있음");
    expect(localizeAvailability("Out of Stock")).toBe("품절");
  });

  it("모르는 표현은 원문을 그대로 둔다", () => {
    expect(localizeAvailability("Only 3 left in stock")).toBe("Only 3 left in stock");
  });

  it("값이 없으면 '정보 없음'", () => {
    expect(localizeAvailability(null)).toBe("정보 없음");
    expect(localizeAvailability("  ")).toBe("정보 없음");
  });
});

describe("날짜 표기", () => {
  it("UTC 밤 시각도 한국 시간 날짜로 적는다", () => {
    expect(formatKoreanDate(new Date("2026-09-10T20:00:00Z"))).toBe("2026년 9월 11일");
  });

  it("연월은 2자리 월로 적는다", () => {
    expect(formatKoreanYearMonth(new Date("2026-01-05T00:00:00Z"))).toBe("2026.01");
  });
});

describe("buildTags", () => {
  it("공백 없는 태그만, 중복 없이, 10개까지 만든다", () => {
    const tags = buildTags(source());
    expect(tags.length).toBeLessThanOrEqual(10);
    expect(tags.every((tag) => !tag.includes(" "))).toBe(true);
    expect(new Set(tags.map((t) => t.toLowerCase())).size).toBe(tags.length);
  });

  it("고정 한국어 태그와 제목에서 뽑은 키워드를 함께 넣는다", () => {
    const tags = buildTags(source());
    expect(tags).toContain("아마존직구");
    expect(tags).toContain("Cookware");
    expect(tags).toContain("Frying");
  });

  it("검색에 도움이 안 되는 영어 낱말(best, non 등)은 태그로 쓰지 않는다", () => {
    const tags = buildTags(source());
    expect(tags).not.toContain("Best");
    expect(tags).not.toContain("Non");
  });

  it("두 글자 미만이거나 숫자뿐인 조각은 태그로 쓰지 않는다", () => {
    const tags = buildTags(source({ categoryName: "A B", title: "10 12 Pans" }));
    expect(tags).not.toContain("A");
    expect(tags).not.toContain("10");
    expect(tags).toContain("Pans");
  });
});
