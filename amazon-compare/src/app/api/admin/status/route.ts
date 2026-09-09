import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { isStale } from "@/lib/staleness";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const [recentLogs, activeProducts] = await Promise.all([
    prisma.refreshLog.findMany({ orderBy: { ranAt: "desc" }, take: 10 }),
    prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        asin: true,
        lastError: true,
        lastFetchedAt: true,
        affiliateUrl: true,
        comparisonPage: { select: { title: true, slug: true } },
      },
    }),
  ]);

  const failedProducts = activeProducts.filter((p) => Boolean(p.lastError) || !p.affiliateUrl);
  const staleProducts = activeProducts.filter((p) => isStale(p.lastFetchedAt));

  return NextResponse.json({
    recentLogs,
    failedProducts,
    staleCount: staleProducts.length,
    activeCount: activeProducts.length,
  });
}
