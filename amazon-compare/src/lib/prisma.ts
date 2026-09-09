import { PrismaClient } from "@prisma/client";

// Next.js 개발 모드의 hot-reload 시 PrismaClient가 매 요청마다 새로 생성되어
// DB 커넥션이 누적되는 것을 막기 위한 표준 패턴입니다.
// https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
