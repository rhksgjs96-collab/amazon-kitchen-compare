import { createHash } from "node:crypto";
import type { BlogPostDraft, BlogProduct, BlogSource } from "./types";

/**
 * 비교 페이지 데이터를 네이버 블로그용 한국어 글 초안으로 바꿉니다.
 *
 * 이 파일은 순수 함수만 있습니다 — DB도, 브라우저도, 네트워크도 건드리지 않습니다.
 * 그래서 tests/naver-post-builder.test.ts로 전부 검증할 수 있습니다.
 *
 * 지켜야 하는 표기 정책 (절대 빼지 말 것):
 * - 제휴 링크가 들어간 글이므로, 공정거래위원회 추천·보증 심사지침에 따라 "대가를 받는다"는
 *   사실을 본문 맨 위에 눈에 띄게 적습니다. 글 맨 아래에만 적으면 안 됩니다.
 * - Amazon 어소시에이트 운영 정책이 요구하는 영문 고지 문구와 가격 고지문도 함께 넣습니다.
 * - 파트너 태그가 검증된 링크(affiliateUrl)만 사용합니다. 링크를 직접 조립하지 않습니다.
 */

/** 본문 맨 위에 들어가는 대가성 표시. 공정위 심사지침상 "첫 부분"에 있어야 합니다. */
export const SPONSORSHIP_NOTICE =
  "이 글에는 Amazon 어소시에이트 제휴 링크가 포함되어 있습니다. 링크를 통해 구매가 일어나면 " +
  "작성자가 아마존으로부터 일정액의 수수료를 받습니다. 구매자가 내는 금액은 달라지지 않습니다.";

/** Amazon 어소시에이트 운영 계약이 원문 그대로 노출하도록 요구하는 문구입니다. */
export const ASSOCIATES_DISCLOSURE =
  "As an Amazon Associate I earn from qualifying purchases.";

/** 아마존 재고 표기를 한국어로 바꿉니다. 모르는 표현은 원문을 그대로 둡니다. */
const AVAILABILITY_KO: Record<string, string> = {
  "in stock": "재고 있음",
  "in stock.": "재고 있음",
  "currently unavailable": "현재 구매 불가",
  "out of stock": "품절",
  "usually ships within 1 to 2 months": "배송까지 1~2개월 소요",
};

const BASE_TAGS = ["아마존직구", "해외직구", "직구추천", "주방용품"];
const MAX_TAGS = 10;

/** 검색에 도움이 안 되는 영어 낱말은 태그로 쓰지 않습니다. */
const TAG_STOPWORDS = new Set([
  "best", "top", "the", "and", "for", "with", "our", "new", "non", "your", "guide", "review", "reviews",
]);

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function localizeAvailability(availability: string | null): string {
  if (!availability || availability.trim() === "") return "정보 없음";
  const normalized = availability.trim().toLowerCase();
  return AVAILABILITY_KO[normalized] ?? availability.trim();
}

/** "2026년 9월 10일" — 한국 시간대 기준으로 고정합니다(서버가 UTC여도 같은 날짜가 나오도록). */
export function formatKoreanDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  // ko-KR은 "2026년 9월 10일"을 주지만 로케일 데이터에 따라 끝에 마침표가 붙는 경우가 있습니다.
  return parts.replace(/\.$/, "").trim();
}

/** "2026.09" — 제목에 붙이는 기준 연월. */
export function formatKoreanYearMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}.${month}`;
}

/**
 * 태그 목록을 만듭니다. 상품/페이지 제목은 영어라서, 고정 한국어 태그에 영어 키워드를 섞습니다.
 * 네이버는 태그에 공백을 허용하지 않으므로 단어 단위로 자릅니다.
 */
export function buildTags(source: BlogSource): string[] {
  const fromTitle = `${source.categoryName} ${source.title}`
    .split(/[^A-Za-z0-9가-힣]+/)
    .map((word) => word.trim())
    .filter(
      (word) => word.length >= 3 && !/^\d+$/.test(word) && !TAG_STOPWORDS.has(word.toLowerCase())
    );

  const tags: string[] = [];
  for (const candidate of [...BASE_TAGS, ...fromTitle]) {
    const tag = candidate.slice(0, 20);
    if (tag.length < 2) continue;
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) continue;
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

export function buildPostTitle(source: BlogSource, publishedCount: number, now: Date): string {
  return `${source.title} — 아마존 ${publishedCount}종 가격·스펙 비교 (${formatKoreanYearMonth(now)} 기준)`;
}

/** 글에 실을 수 있는 상품인지 판단합니다. 아직 갱신 전(title 없음)이면 실을 내용이 없습니다. */
function isPublishable(product: BlogProduct): boolean {
  return typeof product.title === "string" && product.title.trim() !== "";
}

export function buildBlogPost(source: BlogSource, now: Date = new Date()): BlogPostDraft {
  const publishable = source.products.filter(isPublishable);
  const pendingAsins = source.products.filter((p) => !isPublishable(p)).map((p) => p.asin);
  const unlinkedAsins = publishable.filter((p) => !p.affiliateUrl).map((p) => p.asin);

  const title = buildPostTitle(source, publishable.length, now);
  const collectedOn = formatKoreanDate(now);

  const html = renderHtml(source, publishable, collectedOn);
  const text = renderText(source, publishable, collectedOn);

  return {
    title,
    html,
    text,
    tags: buildTags(source),
    contentHash: createHash("sha256").update(`${title}\n${html}`).digest("hex"),
    includedCount: publishable.length,
    pendingAsins,
    unlinkedAsins,
  };
}

/* ------------------------------------------------------------------ *
 * HTML 렌더링
 *
 * 스마트에디터는 붙여넣은 HTML을 자기 형식으로 다시 씁니다. class나 style을 얹어봐야
 * 대부분 버려지므로, 확실히 살아남는 기본 태그(h3/p/ul/li/table/strong/a)만 씁니다.
 * 이미지는 넣지 않습니다 — 아마존 상품 이미지는 API 응답 링크로만 쓸 수 있는데,
 * 네이버 블로그는 외부 이미지를 자기 서버로 복사해 저장하기 때문에 정책에 어긋납니다.
 * ------------------------------------------------------------------ */

function renderHtml(source: BlogSource, products: BlogProduct[], collectedOn: string): string {
  const rows = products
    .map((product) => {
      const name = escapeHtml(product.title ?? product.asin);
      const price = escapeHtml(product.priceDisplay ?? "가격 정보 없음");
      const stock = escapeHtml(localizeAvailability(product.availability));
      const link = product.affiliateUrl
        ? `<a href="${escapeHtml(product.affiliateUrl)}" target="_blank" rel="nofollow sponsored noopener">아마존에서 보기</a>`
        : "링크 확인 중";
      return `<tr><td>${name}</td><td>${price}</td><td>${stock}</td><td>${link}</td></tr>`;
    })
    .join("");

  const details = products
    .map((product, index) => {
      const name = escapeHtml(product.title ?? product.asin);
      const featureList = product.features.length
        ? `<ul>${product.features
            .slice(0, 6)
            .map((feature) => `<li>${escapeHtml(feature)}</li>`)
            .join("")}</ul>`
        : "<p>등록된 주요 사양 정보가 없습니다.</p>";
      const price = escapeHtml(product.priceDisplay ?? "가격 정보 없음");
      const stock = escapeHtml(localizeAvailability(product.availability));
      const cta = product.affiliateUrl
        ? `<p><a href="${escapeHtml(product.affiliateUrl)}" target="_blank" rel="nofollow sponsored noopener">▶ 아마존에서 ${name} 보기</a></p>`
        : `<p>이 상품은 제휴 링크가 확인되지 않아 링크를 걸지 않았습니다.</p>`;

      return [
        `<h3>${index + 1}. ${name}</h3>`,
        featureList,
        `<p><strong>가격</strong> ${price} / <strong>재고</strong> ${stock}</p>`,
        cta,
      ].join("");
    })
    .join("");

  const intro = source.description
    ? `<p>${escapeHtml(source.description)}</p>`
    : "";

  const backlink = source.siteUrl
    ? `<p>표가 잘려 보이거나 최신 가격이 궁금하시면 <a href="${escapeHtml(source.siteUrl)}" target="_blank" rel="noopener">비교 페이지 원본</a>에서 확인하실 수 있습니다.</p>`
    : "";

  return [
    `<p><strong>※ ${escapeHtml(SPONSORSHIP_NOTICE)}</strong></p>`,
    `<p>안녕하세요. 이번 글에서는 ${escapeHtml(source.categoryName)} 카테고리의 “${escapeHtml(
      source.title
    )}” 목록에 올라온 상품 ${products.length}개를 가격과 주요 사양 기준으로 한 번에 비교해 봤습니다.</p>`,
    intro,
    `<h3>한눈에 보는 비교표</h3>`,
    `<table><thead><tr><th>상품</th><th>가격</th><th>재고</th><th>바로가기</th></tr></thead><tbody>${rows}</tbody></table>`,
    `<h3>상품별로 살펴보기</h3>`,
    details,
    `<h3>정리하며</h3>`,
    `<p>가격만 보면 표의 위쪽부터, 사양을 꼼꼼히 따지실 거라면 각 상품의 주요 사양 목록을 비교해 보시길 권합니다. 해외 배송 기간과 관세는 상품마다 다르니 주문 전에 아마존 상품 페이지에서 꼭 확인해 주세요.</p>`,
    backlink,
    `<p>가격·재고 정보는 ${escapeHtml(
      collectedOn
    )}(한국 시간) 기준으로 수집한 값입니다. 아마존 가격은 수시로 바뀌므로 실제 결제 금액은 반드시 아마존 상품 페이지에서 확인해 주세요.</p>`,
    `<p>${escapeHtml(ASSOCIATES_DISCLOSURE)}</p>`,
  ]
    .filter((block) => block !== "")
    .join("\n");
}

/* ------------------------------------------------------------------ *
 * 평문 렌더링 — 클립보드 붙여넣기가 막혔을 때 대신 타이핑하는 내용입니다.
 * 링크는 태그로 감쌀 수 없으니 URL을 그대로 적습니다.
 * ------------------------------------------------------------------ */

function renderText(source: BlogSource, products: BlogProduct[], collectedOn: string): string {
  const lines: string[] = [];

  lines.push(`※ ${SPONSORSHIP_NOTICE}`);
  lines.push("");
  lines.push(
    `안녕하세요. 이번 글에서는 ${source.categoryName} 카테고리의 “${source.title}” 목록에 올라온 상품 ${products.length}개를 가격과 주요 사양 기준으로 한 번에 비교해 봤습니다.`
  );
  if (source.description) {
    lines.push(source.description);
  }
  lines.push("");
  lines.push("[ 한눈에 보는 비교표 ]");
  for (const product of products) {
    const price = product.priceDisplay ?? "가격 정보 없음";
    const stock = localizeAvailability(product.availability);
    lines.push(`- ${product.title ?? product.asin} / ${price} / ${stock}`);
  }
  lines.push("");
  lines.push("[ 상품별로 살펴보기 ]");
  products.forEach((product, index) => {
    lines.push("");
    lines.push(`${index + 1}. ${product.title ?? product.asin}`);
    for (const feature of product.features.slice(0, 6)) {
      lines.push(`  · ${feature}`);
    }
    lines.push(`  가격: ${product.priceDisplay ?? "가격 정보 없음"}`);
    lines.push(`  재고: ${localizeAvailability(product.availability)}`);
    if (product.affiliateUrl) {
      lines.push(`  아마존에서 보기: ${product.affiliateUrl}`);
    } else {
      lines.push("  이 상품은 제휴 링크가 확인되지 않아 링크를 걸지 않았습니다.");
    }
  });
  lines.push("");
  lines.push("[ 정리하며 ]");
  lines.push(
    "가격만 보면 표의 위쪽부터, 사양을 꼼꼼히 따지실 거라면 각 상품의 주요 사양 목록을 비교해 보시길 권합니다. 해외 배송 기간과 관세는 상품마다 다르니 주문 전에 아마존 상품 페이지에서 꼭 확인해 주세요."
  );
  if (source.siteUrl) {
    lines.push(`비교 페이지 원본: ${source.siteUrl}`);
  }
  lines.push("");
  lines.push(
    `가격·재고 정보는 ${collectedOn}(한국 시간) 기준으로 수집한 값입니다. 아마존 가격은 수시로 바뀌므로 실제 결제 금액은 반드시 아마존 상품 페이지에서 확인해 주세요.`
  );
  lines.push(ASSOCIATES_DISCLOSURE);

  return lines.join("\n");
}
