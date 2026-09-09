import { NextRequest, NextResponse } from "next/server";

/**
 * 관리자 API를 보호합니다. 요청 헤더 `x-admin-secret`이 ADMIN_SECRET과
 * 정확히 일치할 때만 통과시킵니다. 회원가입/로그인 시스템 없이 단일 비밀
 * 토큰으로만 접근을 제어하는 MVP 방식입니다.
 *
 * 사용법:
 *   const denied = requireAdmin(req);
 *   if (denied) return denied;
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "서버에 ADMIN_SECRET이 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  const provided = req.headers.get("x-admin-secret");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "관리자 인증에 실패했습니다." }, { status: 401 });
  }

  return null;
}
