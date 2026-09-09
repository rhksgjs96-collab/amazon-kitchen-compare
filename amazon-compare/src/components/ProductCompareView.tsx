import StaleBadge from "./StaleBadge";

export interface ProductForDisplay {
  id: string;
  asin: string;
  title: string | null;
  imageUrl: string | null;
  features: string[];
  priceDisplay: string | null;
  availability: string | null;
  affiliateUrl: string | null;
  lastFetchedAt: Date | null;
}

/**
 * Product comparison display.
 * - Desktop (>=md): a table you can scan side by side.
 * - Mobile (<md): a stacked card list instead of a horizontally-scrolling
 *   table, since that's usually easier to read on a phone.
 * Both layouts render the same data, so they never drift out of sync.
 */
export default function ProductCompareView({ products }: { products: ProductForDisplay[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
        No products to compare yet. Please check back soon.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="w-28 px-4 py-3">Image</th>
              <th className="px-4 py-3">Product</th>
              <th className="w-64 px-4 py-3">Key features</th>
              <th className="w-36 px-4 py-3">Price</th>
              <th className="w-28 px-4 py-3">Availability</th>
              <th className="w-36 px-4 py-3">Buy</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-4">
                  <ProductImage src={p.imageUrl} alt={p.title ?? p.asin} />
                </td>
                <td className="px-4 py-4 font-medium text-gray-800">
                  {p.title ?? `ASIN: ${p.asin}`}
                </td>
                <td className="px-4 py-4">
                  <FeatureList features={p.features} />
                </td>
                <td className="px-4 py-4">
                  <PriceCell priceDisplay={p.priceDisplay} lastFetchedAt={p.lastFetchedAt} />
                </td>
                <td className="px-4 py-4 text-gray-600">{p.availability ?? "Unknown"}</td>
                <td className="px-4 py-4">
                  <BuyButton affiliateUrl={p.affiliateUrl} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="grid gap-4 md:hidden">
        {products.map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex gap-4">
              <ProductImage src={p.imageUrl} alt={p.title ?? p.asin} />
              <div className="flex-1">
                <p className="font-medium text-gray-800">{p.title ?? `ASIN: ${p.asin}`}</p>
                <PriceCell priceDisplay={p.priceDisplay} lastFetchedAt={p.lastFetchedAt} />
                <p className="mt-1 text-xs text-gray-600">{p.availability ?? "Unknown"}</p>
              </div>
            </div>
            <div className="mt-3">
              <FeatureList features={p.features} />
            </div>
            <div className="mt-3">
              <BuyButton affiliateUrl={p.affiliateUrl} fullWidth />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400">
        No image
      </div>
    );
  }
  // Amazon product images must be listed under the remote image domains in next.config.mjs.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-20 w-20 shrink-0 rounded object-contain" loading="lazy" />;
}

function FeatureList({ features }: { features: string[] }) {
  if (features.length === 0) {
    return <p className="text-xs text-gray-400">No feature details available.</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
      {features.slice(0, 4).map((f, i) => (
        <li key={i}>{f}</li>
      ))}
    </ul>
  );
}

function PriceCell({
  priceDisplay,
  lastFetchedAt,
}: {
  priceDisplay: string | null;
  lastFetchedAt: Date | null;
}) {
  return (
    <div>
      <p className="font-semibold text-gray-900">{priceDisplay ?? "Price unavailable"}</p>
      <StaleBadge lastFetchedAt={lastFetchedAt} />
    </div>
  );
}

function BuyButton({ affiliateUrl, fullWidth }: { affiliateUrl: string | null; fullWidth?: boolean }) {
  if (!affiliateUrl) {
    return <span className="text-xs text-gray-400">Buy link unavailable</span>;
  }
  return (
    <a
      href={affiliateUrl}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={`inline-block rounded-md bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white hover:bg-amber-600 ${
        fullWidth ? "w-full" : ""
      }`}
    >
      View on Amazon
    </a>
  );
}
