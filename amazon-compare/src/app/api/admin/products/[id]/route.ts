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
  if (typeof body.active === "boolean") data.active = body.active;
  if (Number.isFinite(body.order)) data.order = Number(body.order);
  if (typeof body.asin === "string" && /^[A-Z0-9]{10}$/.test(body.asin.trim().toUpperCase())) {
    data.asin = body.asin.trim().toUpperCase();
  }

  try {
    const product = await prisma.product.update({ where: { id: params.id }, data });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "상품을 찾을 수 없거나 값이 올바르지 않습니다." }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
}
