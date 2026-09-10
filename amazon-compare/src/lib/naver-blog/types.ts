/**
 * 네이버 블로그 자동 업로드에서 주고받는 데이터 모양.
 *
 * 여기 정의된 타입들은 Prisma 모델과 일부러 분리해 두었습니다. 글을 만드는 로직
 * (post-builder)이 DB나 Playwright를 전혀 모르게 해야 순수 함수로 테스트할 수 있기
 * 때문입니다.
 */

/** 글에 실을 상품 하나. Prisma의 Product에서 필요한 필드만 추린 모양입니다. */
export interface BlogProduct {
  asin: string;
  title: string | null;
  /** Amazon Creators API가 준 핵심 사양 목록. */
  features: string[];
  priceDisplay: string | null;
  availability: string | null;
  /** 파트너 태그가 검증된 링크만 들어옵니다. 검증 실패 시 null이며 링크를 걸지 않습니다. */
  affiliateUrl: string | null;
}

/** 글 한 편의 재료. 비교 페이지 하나가 글 한 편이 됩니다. */
export interface BlogSource {
  slug: string;
  /** 비교 페이지 제목. 공개 사이트가 영어라서 보통 영어 문장입니다. */
  title: string;
  description: string | null;
  categoryName: string;
  products: BlogProduct[];
  /** 원본 비교 페이지로 돌아가는 링크. SITE_URL이 없으면 null이고 링크를 생략합니다. */
  siteUrl: string | null;
}

/** 발행 직전의 글 초안. publisher는 이 모양만 보고 브라우저를 조작합니다. */
export interface BlogPostDraft {
  title: string;
  /** 스마트에디터에 붙여넣을 본문 HTML. */
  html: string;
  /** 클립보드 붙여넣기가 막혔을 때 대신 타이핑할 평문 본문. */
  text: string;
  tags: string[];
  /** 제목+본문의 SHA-256. 내용이 그대로면 재발행을 건너뛰는 데 씁니다. */
  contentHash: string;
  /** 실제로 글에 실린 상품 수. 0이면 발행할 내용이 없다는 뜻입니다. */
  includedCount: number;
  /** 아직 한 번도 갱신되지 않아(title 없음) 글에서 제외한 ASIN. */
  pendingAsins: string[];
  /** 제휴 링크 검증에 실패해 링크 없이 실은 ASIN. */
  unlinkedAsins: string[];
}
