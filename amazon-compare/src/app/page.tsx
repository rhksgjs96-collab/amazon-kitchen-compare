import Link from "next/link";
import { prisma } from "@/lib/prisma";

// DB content can change at any time (prices/stock refresh automatically), so we
// render on every request instead of statically generating this page.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, popularPages] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: "asc" } }),
    prisma.comparisonPage.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      take: 6,
      include: { category: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900">
          Compare kitchen gear before you buy
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          We round up top-selling kitchen products on Amazon and compare their price, stock
          status, and key features side by side &mdash; no reviews, no fluff, just the product
          details you need to make a smart choice.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Categories</h2>
        {categories.length === 0 ? (
          <EmptyState message="No categories yet. Add one from the admin page (/admin) to get started." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="rounded-lg border border-gray-200 p-4 transition hover:border-gray-400 hover:shadow-sm"
              >
                <div className="font-medium text-gray-800">{category.name}</div>
                {category.description && (
                  <div className="mt-1 text-xs text-gray-500">{category.description}</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Popular comparisons</h2>
        {popularPages.length === 0 ? (
          <EmptyState message="No comparison pages yet. Add a category, comparison page, and ASINs from the admin page." />
        ) : (
          <ul className="space-y-3">
            {popularPages.map((page) => (
              <li key={page.id} className="rounded-lg border border-gray-100 p-4">
                <Link href={`/compare/${page.slug}`} className="font-medium text-blue-600 hover:underline">
                  {page.title}
                </Link>
                <span className="ml-2 text-xs text-gray-400">{page.category.name}</span>
                {page.description && <p className="mt-1 text-sm text-gray-500">{page.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
      {message}
    </div>
  );
}
