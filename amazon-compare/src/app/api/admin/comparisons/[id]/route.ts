import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string" || body.description === null) data.description = body.description;
  if (typeof body.slug === "string" && body.slug.trim()) data.slug = body.slug.trim();
  if (typeof body.categoryId === "string" && body.categoryId) data.categoryId = body.categoryId;
  if (Number.isFinite(body.order)) data.order = Number(body.order);
  if (typeof body.active === "boolean") data.active = body.active;

  try {
    const page = await prisma.comparisonPage.update({ where: { id: params.id }, data });
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "비교 페이지를 찾을 수 없거나 값이 올바르지 않습니다." }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    // onDelete: Cascade — 이 비교 페이지에 속한 상품(ASIN)도 함께 삭제됩니다.
    await prisma.comparisonPage.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "비교 페이지를 찾을 수 없습니다." }, { status: 404 });
  }
}
