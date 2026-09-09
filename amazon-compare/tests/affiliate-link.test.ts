import { describe, expect, it } from "vitest";
import { resolveAffiliateLink, extractRawDetailPageUrl } from "@/lib/affiliate-link";

const PARTNER_TAG = "mystore-20";

describe("extractRawDetailPageUrl", () => {
  it("reads detailPageUrl (camelCase)", () => {
    expect(extractRawDetailPageUrl({ detailPageUrl: "https://www.amazon.com/dp/B000000000" })).toBe(
      "https://www.amazon.com/dp/B000000000"
    );
  });

  it("falls back to DetailPageURL (legacy PA-API casing)", () => {
    expect(extractRawDetailPageUrl({ DetailPageURL: "https://www.amazon.com/dp/B000000000" })).toBe(
      "https://www.amazon.com/dp/B000000000"
    );
  });

  it("returns null when nothing is present", () => {
    expect(extractRawDetailPageUrl({})).toBeNull();
    expect(extractRawDetailPageUrl(null)).toBeNull();
    expect(extractRawDetailPageUrl(undefined)).toBeNull();
  });
});

describe("resolveAffiliateLink", () => {
  it("accepts a link whose tag matches our partner tag", () => {
    const item = { detailPageUrl: `https://www.amazon.com/dp/B000000000?tag=${PARTNER_TAG}` };
    expect(resolveAffiliateLink(item, PARTNER_TAG)).toBe(
      `https://www.amazon.com/dp/B000000000?tag=${PARTNER_TAG}`
    );
  });

  it("rejects a link with no tag at all", () => {
    const item = { detailPageUrl: "https://www.amazon.com/dp/B000000000" };
    expect(resolveAffiliateLink(item, PARTNER_TAG)).toBeNull();
  });

  it("rejects a link whose tag does not match our partner tag", () => {
    const item = { detailPageUrl: "https://www.amazon.com/dp/B000000000?tag=someone-elses-20" };
    expect(resolveAffiliateLink(item, PARTNER_TAG)).toBeNull();
  });

  it("rejects a malformed URL instead of throwing", () => {
    const item = { detailPageUrl: "not a url" };
    expect(resolveAffiliateLink(item, PARTNER_TAG)).toBeNull();
  });

  it("rejects a link that is not on an amazon.* domain, even with a matching tag", () => {
    const item = { detailPageUrl: `https://not-amazon.example.com/dp/B000000000?tag=${PARTNER_TAG}` };
    expect(resolveAffiliateLink(item, PARTNER_TAG)).toBeNull();
  });

  it("rejects when there is no detail page URL in the response at all", () => {
    expect(resolveAffiliateLink({}, PARTNER_TAG)).toBeNull();
  });

  it("accepts other Amazon regional domains (e.g. amazon.co.jp)", () => {
    const item = { detailPageUrl: `https://www.amazon.co.jp/dp/B000000000?tag=${PARTNER_TAG}` };
    expect(resolveAffiliateLink(item, PARTNER_TAG)).toBe(
      `https://www.amazon.co.jp/dp/B000000000?tag=${PARTNER_TAG}`
    );
  });
});
