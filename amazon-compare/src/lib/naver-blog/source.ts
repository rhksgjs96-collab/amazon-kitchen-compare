import { prisma } from "@/lib/prisma";
import type { BlogProduct, BlogSource } from "./types";

/**
 * DB의 비교 페이지를 블로그 글 재료(BlogSource)로 읽어옵니다.
 *
 * 상품 정보는 예약 갱신(/api/cron/refresh)이 채워 넣은 값을 그대로 씁니다. 여기서 아마존을
 * 다시 호출하거나 값을 손보지 않습니다 — 사이트에 보이는 내용과 블로그 글이 어긋나면 안 되니까요.
 */

function toFeatureList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function resolveSiteUrl(slug: string): string | null {
  const base = process.env.SITE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/compare/${slug}`;
}

/** 발행 대상으로 삼을 만한 비교 페이지의 slug 목록 (활성 페이지만). */
export async function listPublishableSlugs(): Promise<string[]> {
  const pages = await prisma.comparisonPage.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { slug: true },
  });
  return pages.map((page) => page.slug);
}

export interface LoadedBlogSource {
  /** 발행 이력(NaverBlogPost)을 연결하기 위한 비교 페이지 ID. */
  comparisonPageId: string;
  source: BlogSource;
}

/** slug 하나에 해당하는 비교 페이지를 읽습니다. 없거나 비활성이면 null. */
export async function loadBlogSource(slug: string): Promise<LoadedBlogSource | null> {
  const page = await prisma.comparisonPage.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true } },
      products: {
        where: { active: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!page || !page.active) return null;

  const products: BlogProduct[] = page.products.map((product) => ({
    asin: product.asin,
    title: product.title,
    features: toFeatureList(product.features),
    priceDisplay: product.priceDisplay,
    availability: product.availability,
    affiliateUrl: product.affiliateUrl,
  }));

  return {
    comparisonPageId: page.id,
    source: {
      slug: page.slug,
      title: page.title,
      description: page.description,
      categoryName: page.category.name,
      products,
      siteUrl: resolveSiteUrl(page.slug),
    },
  };
}
