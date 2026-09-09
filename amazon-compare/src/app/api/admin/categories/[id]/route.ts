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
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) data.description = body.description;
  if (Number.isFinite(body.order)) data.order = Number(body.order);
  if (typeof body.slug === "string" && body.slug.trim()) data.slug = body.slug.trim();

  try {
    const category = await prisma.category.update({ where: { id: params.id }, data });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "카테고리를 찾을 수 없거나 slug가 중복됩니다." }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    // onDelete: Cascade — 이 카테고리에 속한 비교 페이지와 상품도 함께 삭제됩니다.
    await prisma.category.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 404 });
  }
}
