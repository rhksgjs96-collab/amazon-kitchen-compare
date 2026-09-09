export interface NormalizedProduct {
  asin: string;
  title: string | null;
  imageUrl: string | null;
  features: string[];
  priceAmount: number | null;
  priceDisplay: string | null;
  currency: string | null;
  availability: string | null;
  /** 파트너 태그가 검증된 링크만 들어옵니다. 검증 실패 시 null. */
  affiliateUrl: string | null;
}

export interface AsinFailure {
  asin: string;
  error: string;
}

export interface FetchProductsResult {
  results: NormalizedProduct[];
  failures: AsinFailure[];
}
