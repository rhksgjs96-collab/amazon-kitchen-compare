import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const pages = await prisma.comparisonPage.findMany({
    orderBy: { order: "asc" },
    include: { category: true, _count: { select: { products: true } } },
  });
  return NextResponse.json(pages);
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const order = Number.isFinite(body?.order) ? Number(body.order) : 0;
  const active = typeof body?.active === "boolean" ? body.active : true;

  if (!slug || !title || !categoryId) {
    return NextResponse.json({ error: "slug, title, categoryId는 필수입니다." }, { status: 400 });
  }

  try {
    const page = await prisma.comparisonPage.create({
      data: { slug, title, description, categoryId, order, active },
    });
    return NextResponse.json(page, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "slug가 중복되었거나 categoryId가 올바르지 않습니다." },
      { status: 409 }
    );
  }
}
