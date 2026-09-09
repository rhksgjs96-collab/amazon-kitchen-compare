/**
 * Amazon Creators API 응답에서 "내 파트너 태그가 포함된" 상품 상세 링크만 골라냅니다.
 *
 * 정책 (절대 완화하지 말 것):
 * - Amazon 웹페이지를 조합해서 URL을 직접 만들지 않습니다. API가 응답으로 준 링크만 씁니다.
 * - 그 링크의 쿼리스트링 `tag` 파라미터가 내가 설정한 AMAZON_PARTNER_TAG와 정확히 일치해야
 *   "검증된 제휴 링크"로 인정합니다. 하나라도 어긋나면 null을 반환해서 구매 버튼을 숨깁니다.
 *
 * 참고: Amazon Creators API 응답 필드명은 SDK 버전에 따라 detailPageUrl / DetailPageURL 등으로
 * 다르게 내려올 수 있어 방어적으로 여러 후보를 확인합니다. 실제 응답을 받아보고 필드명이
 * 다르면 CANDIDATE_FIELDS만 수정하면 됩니다.
 */

const CANDIDATE_FIELDS = ["detailPageUrl", "DetailPageURL", "detailPageURL"] as const;

export function extractRawDetailPageUrl(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  for (const field of CANDIDATE_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

export function resolveAffiliateLink(
  item: unknown,
  expectedPartnerTag: string
): string | null {
  const raw = extractRawDetailPageUrl(item);
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  // Amazon 도메인이 아닌 링크는 절대 신뢰하지 않습니다.
  if (!/(^|\.)amazon\.[a-z.]+$/i.test(url.hostname)) {
    return null;
  }

  const tag = url.searchParams.get("tag");
  if (!tag || tag !== expectedPartnerTag) {
    return null;
  }

  return url.toString();
}
