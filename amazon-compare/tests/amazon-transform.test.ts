import { describe, expect, it } from "vitest";
import { normalizeItem } from "@/lib/amazon";

const PARTNER_TAG = "mystore-20";

function buildRawItem(overrides: Record<string, unknown> = {}) {
  return {
    asin: "B0DLFMFBJW",
    detailPageUrl: `https://www.amazon.com/dp/B0DLFMFBJW?tag=${PARTNER_TAG}`,
    itemInfo: {
      title: { displayValue: "Non-stick Frying Pan 10-inch" },
      features: { displayValues: ["Dishwasher safe", "PFOA-free coating", "Oven safe to 500°F"] },
    },
    images: {
      primary: { large: { url: "https://m.media-amazon.com/images/I/example.jpg" } },
    },
    offersV2: {
      listings: [
        {
          price: { money: { amount: 29.99, displayAmount: "$29.99", currency: "USD" } },
          availability: { message: "In Stock" },
        },
      ],
    },
    ...overrides,
  };
}

describe("normalizeItem", () => {
  it("maps a well-formed Creators API item to our internal shape", () => {
    const normalized = normalizeItem(buildRawItem(), PARTNER_TAG);

    expect(normalized).toEqual({
      asin: "B0DLFMFBJW",
      title: "Non-stick Frying Pan 10-inch",
      imageUrl: "https://m.media-amazon.com/images/I/example.jpg",
      features: ["Dishwasher safe", "PFOA-free coating", "Oven safe to 500°F"],
      priceAmount: 29.99,
      priceDisplay: "$29.99",
      currency: "USD",
      availability: "In Stock",
      affiliateUrl: `https://www.amazon.com/dp/B0DLFMFBJW?tag=${PARTNER_TAG}`,
    });
  });

  it("does not blow up when optional fields are missing", () => {
    const normalized = normalizeItem({ asin: "B000000000" }, PARTNER_TAG);

    expect(normalized.asin).toBe("B000000000");
    expect(normalized.title).toBeNull();
    expect(normalized.imageUrl).toBeNull();
    expect(normalized.features).toEqual([]);
    expect(normalized.priceAmount).toBeNull();
    expect(normalized.priceDisplay).toBeNull();
    expect(normalized.availability).toBeNull();
    expect(normalized.affiliateUrl).toBeNull();
  });

  it("returns a null affiliateUrl when the tag on the returned link does not match ours", () => {
    const raw = buildRawItem({
      detailPageUrl: "https://www.amazon.com/dp/B0DLFMFBJW?tag=someone-elses-20",
    });
    const normalized = normalizeItem(raw, PARTNER_TAG);
    expect(normalized.affiliateUrl).toBeNull();
    // 나머지 상품 정보는 여전히 정상적으로 채워져야 합니다 (구매 버튼만 숨겨야 함).
    expect(normalized.title).toBe("Non-stick Frying Pan 10-inch");
  });

  it("caps features to at most 6 entries", () => {
    const raw = buildRawItem({
      itemInfo: {
        title: { displayValue: "Test" },
        features: { displayValues: Array.from({ length: 10 }, (_, i) => `Feature ${i}`) },
      },
    });
    const normalized = normalizeItem(raw, PARTNER_TAG);
    expect(normalized.features).toHaveLength(6);
  });

  it("handles a completely empty/garbage item without throwing", () => {
    expect(() => normalizeItem(null, PARTNER_TAG)).not.toThrow();
    expect(() => normalizeItem(undefined, PARTNER_TAG)).not.toThrow();
    expect(() => normalizeItem("not an object", PARTNER_TAG)).not.toThrow();
  });
});
