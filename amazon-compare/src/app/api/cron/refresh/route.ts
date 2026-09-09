import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchProductsByAsins } from "@/lib/amazon";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 예약 갱신 엔드포인트. GitHub Actions 워크플로(.github/workflows/refresh-prices.yml)가
 * 주기적으로 이 경로를 호출합니다. CRON_SECRET 헤더가 일치하지 않으면 거부합니다.
 *
 * 동작:
 * 1. 활성 상품(active=true)의 ASIN 목록을 모읍니다.
 * 2. Amazon Creators API로 최신 가격/재고/이미지/제휴링크를 가져옵니다.
 * 3. 성공한 상품은 기존 값 위에 덮어쓰고(overwrite — 과거 데이터를 쌓아두지 않음),
 *    실패한 ASIN은 lastError에 사유를 기록합니다.
 * 4. 제휴 링크 검증에 실패한 상품은 affiliateUrl이 비워져 구매 버튼이 자동으로 숨겨집니다.
 */
export async function POST(req: NextRequest) {
  const providedSecret = req.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: "서버에 CRON_SECRET이 설정되어 있지 않습니다." }, { status: 500 });
  }
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const activeProducts = await prisma.product.findMany({
    where: { active: true },
    select: { asin: true },
  });
  const uniqueAsins = Array.from(new Set(activeProducts.map((p) => p.asin)));

  if (uniqueAsins.length === 0) {
    await prisma.refreshLog.create({
      data: { success: true, itemsRequested: 0, itemsSucceeded: 0, itemsFailed: 0 },
    });
    return NextResponse.json({ message: "활성 ASIN이 없어 아무 작업도 하지 않았습니다." });
  }

  let results: Awaited<ReturnType<typeof fetchProductsByAsins>>["results"] = [];
  let failures: Awaited<ReturnType<typeof fetchProductsByAsins>>["failures"] = [];

  try {
    const outcome = await fetchProductsByAsins(uniqueAsins);
    results = outcome.results;
    failures = outcome.failures;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Amazon Creators API 호출 중 알 수 없는 오류";
    await prisma.refreshLog.create({
      data: {
        success: false,
        itemsRequested: uniqueAsins.length,
        itemsSucceeded: 0,
        itemsFailed: uniqueAsins.length,
        errorSummary: message.slice(0, 2000),
      },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const now = new Date();

  await Promise.all(
    results.map((r) =>
      prisma.product.updateMany({
        where: { asin: r.asin, active: true },
        data: {
          title: r.title,
          imageUrl: r.imageUrl,
          features: r.features,
          priceAmount: r.priceAmount,
          priceDisplay: r.priceDisplay,
          currency: r.currency,
          availability: r.availability,
          affiliateUrl: r.affiliateUrl,
          lastFetchedAt: now,
          lastError: r.affiliateUrl
            ? null
            : "파트너 태그가 확인된 제휴 링크를 찾지 못해 구매 버튼을 숨겼습니다.",
        },
      })
    )
  );

  await Promise.all(
    failures.map((f) =>
      prisma.product.updateMany({
        where: { asin: f.asin, active: true },
        data: { lastError: f.error, lastFetchedAt: now },
      })
    )
  );

  await prisma.refreshLog.create({
    data: {
      success: failures.length === 0,
      itemsRequested: uniqueAsins.length,
      itemsSucceeded: results.length,
      itemsFailed: failures.length,
      errorSummary: failures.length
        ? failures.map((f) => `${f.asin}: ${f.error}`).join("; ").slice(0, 2000)
        : null,
    },
  });

  return NextResponse.json({
    requested: uniqueAsins.length,
    succeeded: results.length,
    failed: failures.length,
  });
}
