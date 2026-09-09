/**
 * Amazon Creators API 연동 모듈.
 *
 * ⚠️ 이 파일은 커뮤니티 Node.js/TypeScript SDK(`amazon-creators-api`, npm)의
 * 공개된 사용 예시를 바탕으로 작성했습니다. 이 개발 환경은 네트워크 정책상
 * npm 레지스트리 접근이 차단되어 있어 실제로 `npm install` 후 응답을 눈으로
 * 확인하며 검증하지 못했습니다. 반드시 로컬에서 ASIN 1~2개로 먼저 테스트해보고,
 * 만약 아래 import나 필드 접근이 실제 SDK와 다르면 이 파일(과 normalizeItem
 * 함수)만 고치면 됩니다 — 이 파일을 쓰는 다른 코드는 NormalizedProduct 타입만
 * 알면 되도록 분리해 두었습니다.
 *
 * 절대 하지 않는 것:
 * - Amazon 웹페이지 스크래핑 / Selenium·Playwright 자동 탐색 (금지 정책)
 * - AWS Signature 수동 서명 (예전 PA-API 방식, Creators API는 OAuth2 자격증명 방식)
 * - customerReviews(리뷰/별점) 리소스 요청 — 정책상 이번 버전에서는 아예 요청하지 않습니다.
 */

import { requireEnv } from "./env";
import { resolveAffiliateLink } from "./affiliate-link";
import type { FetchProductsResult, NormalizedProduct } from "./types";

// SDK의 정확한 named export 형태(클래스명 등)가 버전에 따라 달라질 수 있어
// 네임스페이스로 통째로 불러온 뒤 방어적으로 꺼내 씁니다.
// (설치 후 타입 오류가 나면 이 import 한 줄만 SDK 실제 형태에 맞게 조정하세요.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as AmazonCreatorsSdk from "amazon-creators-api";

const MAX_BATCH_SIZE = 10; // Creators API GetItems 1회 호출당 최대 ASIN 개수
const MAX_RETRY_ATTEMPTS = 4;

// 고객 리뷰/별점은 정책상 절대 요청하지 않습니다. 필요한 리소스만 최소한으로 요청합니다.
const REQUESTED_RESOURCES = [
  "itemInfo.title",
  "itemInfo.features",
  "images.primary.large",
  "offersV2.listings.price",
  "offersV2.listings.availability",
  "offersV2.listings.condition",
];

interface AmazonApiError extends Error {
  status?: number;
}

let cachedClient: unknown = null;

function getApiClient(): { api: any; partnerTag: string; marketplace: string } {
  const credentialId = requireEnv("AMAZON_CREDENTIAL_ID");
  const credentialSecret = requireEnv("AMAZON_CREDENTIAL_SECRET");
  const version = requireEnv("AMAZON_CREDENTIAL_VERSION");
  const partnerTag = requireEnv("AMAZON_PARTNER_TAG");
  const marketplace = requireEnv("AMAZON_MARKETPLACE");

  const sdk = AmazonCreatorsSdk as any;

  if (!cachedClient) {
    const ApiClientCtor = sdk.ApiClient ?? sdk.default?.ApiClient;
    if (!ApiClientCtor) {
      throw new Error(
        "amazon-creators-api 패키지에서 ApiClient를 찾을 수 없습니다. 설치된 SDK 버전의 export 이름을 확인 후 src/lib/amazon.ts를 수정하세요."
      );
    }
    const client = new ApiClientCtor();
    client.credentialId = credentialId;
    client.credentialSecret = credentialSecret;
    client.version = version;
    cachedClient = client;
  }

  const TypedDefaultApiCtor = sdk.TypedDefaultApi ?? sdk.default?.TypedDefaultApi;
  if (!TypedDefaultApiCtor) {
    throw new Error(
      "amazon-creators-api 패키지에서 TypedDefaultApi를 찾을 수 없습니다. src/lib/amazon.ts의 import를 확인하세요."
    );
  }

  const api = new TypedDefaultApiCtor(cachedClient);
  return { api, partnerTag, marketplace };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as AmazonApiError)?.status;
      const isRetryable = status === 429 || (typeof status === "number" && status >= 500);
      attempt += 1;
      if (!isRetryable || attempt >= maxAttempts) break;
      const backoffMs = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 250;
      await sleep(backoffMs);
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Amazon Creators API 호출에 실패했습니다.");
}

/**
 * API 원본 응답 아이템 하나를 우리 DB 스키마에 맞는 형태로 정규화합니다.
 * 필드가 없거나 형태가 예상과 다르면 조용히 null/빈 값으로 처리해서 전체 갱신이
 * 한 상품 때문에 죽지 않도록 합니다.
 */
export function normalizeItem(item: unknown, expectedPartnerTag: string): NormalizedProduct {
  const record = (item ?? {}) as Record<string, any>;

  const asin: string = typeof record.asin === "string" ? record.asin : record.ASIN ?? "";

  const listing = record.offersV2?.listings?.[0] ?? record.offers?.listings?.[0];
  const priceMoney = listing?.price?.money ?? listing?.price;
  const priceAmount =
    typeof priceMoney?.amount === "number"
      ? priceMoney.amount
      : typeof priceMoney?.Amount === "number"
        ? priceMoney.Amount
        : null;
  const priceDisplay: string | null =
    priceMoney?.displayAmount ?? priceMoney?.DisplayAmount ?? null;
  const currency: string | null = priceMoney?.currency ?? priceMoney?.Currency ?? null;

  const availability: string | null =
    listing?.availability?.message ??
    listing?.availability?.type ??
    listing?.Availability?.Message ??
    null;

  const featuresRaw: unknown =
    record.itemInfo?.features?.displayValues ?? record.ItemInfo?.Features?.DisplayValues;
  const features = Array.isArray(featuresRaw)
    ? featuresRaw.filter((f): f is string => typeof f === "string").slice(0, 6)
    : [];

  const title: string | null =
    record.itemInfo?.title?.displayValue ?? record.ItemInfo?.Title?.DisplayValue ?? null;

  const imageUrl: string | null =
    record.images?.primary?.large?.url ??
    record.images?.primary?.medium?.url ??
    record.Images?.Primary?.Large?.URL ??
    null;

  return {
    asin,
    title,
    imageUrl,
    features,
    priceAmount,
    priceDisplay,
    currency,
    availability,
    affiliateUrl: resolveAffiliateLink(record, expectedPartnerTag),
  };
}

/**
 * 여러 ASIN의 최신 상품 정보를 가져옵니다. 10개씩 배치로 나눠 호출하고,
 * 배치 하나가 실패해도 나머지 배치는 계속 진행합니다(부분 실패 허용).
 */
export async function fetchProductsByAsins(asins: string[]): Promise<FetchProductsResult> {
  const uniqueAsins = Array.from(new Set(asins.filter((a) => a && a.trim().length > 0)));
  if (uniqueAsins.length === 0) {
    return { results: [], failures: [] };
  }

  const { api, partnerTag, marketplace } = getApiClient();
  const sdk = AmazonCreatorsSdk as any;
  const GetItemsRequestContentCtor =
    sdk.GetItemsRequestContent ?? sdk.default?.GetItemsRequestContent;
  if (!GetItemsRequestContentCtor) {
    throw new Error(
      "amazon-creators-api 패키지에서 GetItemsRequestContent를 찾을 수 없습니다. src/lib/amazon.ts의 import를 확인하세요."
    );
  }

  const results: NormalizedProduct[] = [];
  const failures: FetchProductsResult["failures"] = [];

  for (const batch of chunk(uniqueAsins, MAX_BATCH_SIZE)) {
    try {
      const request = new GetItemsRequestContentCtor(partnerTag, batch);
      request.resources = REQUESTED_RESOURCES;

      // <any>로 명시하지 않으면 api.getItems(...)가 SDK 타입 부재로 인해 TS 제네릭 추론이
      // 모호해져 컴파일 오류가 날 수 있어 명시적으로 any를 지정합니다.
      const response = await callWithBackoff<any>(() => api.getItems(marketplace, request));

      const items: unknown[] =
        response?.itemsResult?.items ?? response?.ItemsResult?.Items ?? response?.items ?? [];

      const errorsForBatch: unknown[] = response?.errors ?? response?.Errors ?? [];

      const foundAsins = new Set<string>();
      for (const rawItem of items) {
        const normalized = normalizeItem(rawItem, partnerTag);
        if (normalized.asin) foundAsins.add(normalized.asin);
        results.push(normalized);
      }

      for (const asin of batch) {
        if (foundAsins.has(asin)) continue;
        const matchedError = (errorsForBatch as any[]).find(
          (e) => e?.asin === asin || e?.Asin === asin
        );
        failures.push({
          asin,
          error:
            matchedError?.message ?? matchedError?.Message ?? "API 응답에 해당 상품 정보가 없습니다.",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류로 호출에 실패했습니다.";
      for (const asin of batch) {
        failures.push({ asin, error: message });
      }
    }
  }

  return { results, failures };
}
