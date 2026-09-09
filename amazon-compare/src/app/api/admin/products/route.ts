import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const ASIN_PATTERN = /^[A-Z0-9]{10}$/;

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const products = await prisma.product.findMany({
    orderBy: [{ comparisonPageId: "asc" }, { order: "asc" }],
    include: { comparisonPage: { select: { id: true, title: true, slug: true } } },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const asin = typeof body?.asin === "string" ? body.asin.trim().toUpperCase() : "";
  const comparisonPageId = typeof body?.comparisonPageId === "string" ? body.comparisonPageId : "";
  const order = Number.isFinite(body?.order) ? Number(body.order) : 0;
  const active = typeof body?.active === "boolean" ? body.active : true;

  if (!ASIN_PATTERN.test(asin)) {
    return NextResponse.json(
      { error: "ASIN 형식이 올바르지 않습니다 (영문 대문자/숫자 10자리)." },
      { status: 400 }
    );
  }
  if (!comparisonPageId) {
    return NextResponse.json({ error: "comparisonPageId는 필수입니다." }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: { asin, comparisonPageId, order, active },
    });
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "이미 같은 비교 페이지에 등록된 ASIN이거나 comparisonPageId가 올바르지 않습니다." },
      { status: 409 }
    );
  }
}
