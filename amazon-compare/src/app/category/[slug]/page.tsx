import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
    include: {
      comparisonPages: {
        where: { active: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!category) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{category.name}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
      {category.description && <p className="mt-2 text-gray-600">{category.description}</p>}

      <div className="mt-8">
        {category.comparisonPages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            No comparison pages in this category yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {category.comparisonPages.map((page) => (
              <li key={page.id} className="rounded-lg border border-gray-100 p-4">
                <Link href={`/compare/${page.slug}`} className="font-medium text-blue-600 hover:underline">
                  {page.title}
                </Link>
                {page.description && <p className="mt-1 text-sm text-gray-500">{page.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
