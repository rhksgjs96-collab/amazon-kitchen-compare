import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductCompareView, { type ProductForDisplay } from "@/components/ProductCompareView";
import PriceDisclaimer from "@/components/PriceDisclaimer";

export const dynamic = "force-dynamic";

export default async function ComparePage({ params }: { params: { slug: string } }) {
  const page = await prisma.comparisonPage.findUnique({
    where: { slug: params.slug },
    include: {
      category: true,
      products: {
        where: { active: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!page || !page.active) notFound();

  const products: ProductForDisplay[] = page.products.map((p) => ({
    id: p.id,
    asin: p.asin,
    title: p.title,
    imageUrl: p.imageUrl,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
    priceDisplay: p.priceDisplay,
    availability: p.availability,
    affiliateUrl: p.affiliateUrl,
    lastFetchedAt: p.lastFetchedAt,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/category/${page.category.slug}`} className="hover:underline">
          {page.category.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{page.title}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
      {page.description && <p className="mt-2 max-w-2xl text-gray-600">{page.description}</p>}

      <div className="mt-8">
        <ProductCompareView products={products} />
      </div>

      <PriceDisclaimer />
    </main>
  );
}
