"use client";

import { FormEvent, useCallback, useState } from "react";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  order: number;
};

type ComparisonPage = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  order: number;
  active: boolean;
  categoryId: string;
  category: { id: string; name: string };
  _count?: { products: number };
};

type ProductRow = {
  id: string;
  asin: string;
  order: number;
  active: boolean;
  title: string | null;
  lastError: string | null;
  lastFetchedAt: string | null;
  affiliateUrl: string | null;
  comparisonPageId: string;
  comparisonPage: { id: string; title: string; slug: string };
};

type RefreshLog = {
  id: string;
  ranAt: string;
  success: boolean;
  itemsRequested: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errorSummary: string | null;
};

type StatusResponse = {
  recentLogs: RefreshLog[];
  failedProducts: ProductRow[];
  staleCount: number;
  activeCount: number;
};

// 이 페이지는 사이트 운영자(한국어 사용자)만 사용하므로 관리자 UI는 한국어로 작성했습니다.
// 공개 페이지(홈/카테고리/비교표)는 해외 고객 대상이라 영어로 되어 있습니다.
export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonPage[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [status, setStatus] = useState<StatusResponse | null>(null);

  const authedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          "x-admin-secret": secret,
          "Content-Type": "application/json",
        },
      });
      if (res.status === 401) {
        setAuthed(false);
        throw new Error("관리자 비밀 토큰이 올바르지 않습니다.");
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? `요청 실패 (${res.status})`);
      }
      return json;
    },
    [secret]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, comps, prods, st] = await Promise.all([
        authedFetch("/api/admin/categories"),
        authedFetch("/api/admin/comparisons"),
        authedFetch("/api/admin/products"),
        authedFetch("/api/admin/status"),
      ]);
      setCategories(cats);
      setComparisons(comps);
      setProducts(prods);
      setStatus(st);
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    await loadAll();
  }

  async function withReload(action: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    try {
      await action();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!authed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="mb-4 text-xl font-bold">관리자 로그인</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            placeholder="ADMIN_SECRET 입력"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !secret}
            className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "확인 중..." : "입장"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <button
          onClick={() => withReload(async () => {})}
          disabled={loading}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <StatusSection status={status} />
      <CategorySection
        categories={categories}
        onCreate={(data) => withReload(() => authedFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(data) }))}
        onDelete={(id) => withReload(() => authedFetch(`/api/admin/categories/${id}`, { method: "DELETE" }))}
      />
      <ComparisonSection
        comparisons={comparisons}
        categories={categories}
        onCreate={(data) => withReload(() => authedFetch("/api/admin/comparisons", { method: "POST", body: JSON.stringify(data) }))}
        onToggleActive={(id, active) =>
          withReload(() => authedFetch(`/api/admin/comparisons/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }))
        }
        onDelete={(id) => withReload(() => authedFetch(`/api/admin/comparisons/${id}`, { method: "DELETE" }))}
      />
      <ProductSection
        products={products}
        comparisons={comparisons}
        onCreate={(data) => withReload(() => authedFetch("/api/admin/products", { method: "POST", body: JSON.stringify(data) }))}
        onToggleActive={(id, active) =>
          withReload(() => authedFetch(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }))
        }
        onDelete={(id) => withReload(() => authedFetch(`/api/admin/products/${id}`, { method: "DELETE" }))}
      />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 rounded-lg border border-gray-200 p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function StatusSection({ status }: { status: StatusResponse | null }) {
  if (!status) return null;
  return (
    <Section title="갱신 상태">
      <p className="mb-3 text-sm text-gray-600">
        활성 상품 {status.activeCount}개 중 <span className="font-medium text-amber-600">{status.staleCount}개</span>가
        24시간 이상 갱신되지 않았습니다.
      </p>

      {status.failedProducts.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-red-600">오류/제휴 링크 미확인 상품</p>
          <ul className="space-y-1 text-xs text-gray-600">
            {status.failedProducts.map((p) => (
              <li key={p.id} className="rounded bg-red-50 px-2 py-1">
                [{p.comparisonPage.title}] {p.asin} — {p.lastError ?? "제휴 링크 미확인(태그 불일치 또는 누락)"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mb-2 text-sm font-medium">최근 갱신 로그</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 pr-4">시각</th>
              <th className="py-1 pr-4">결과</th>
              <th className="py-1 pr-4">요청/성공/실패</th>
              <th className="py-1">오류 요약</th>
            </tr>
          </thead>
          <tbody>
            {status.recentLogs.map((log) => (
              <tr key={log.id} className="border-t border-gray-100">
                <td className="py-1 pr-4 text-gray-500">{new Date(log.ranAt).toLocaleString("ko-KR")}</td>
                <td className="py-1 pr-4">{log.success ? "성공" : "일부 실패"}</td>
                <td className="py-1 pr-4">
                  {log.itemsRequested} / {log.itemsSucceeded} / {log.itemsFailed}
                </td>
                <td className="py-1 text-gray-500">{log.errorSummary ?? "-"}</td>
              </tr>
            ))}
            {status.recentLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-gray-400">
                  아직 실행된 갱신이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function CategorySection({
  categories,
  onCreate,
  onDelete,
}: {
  categories: Category[];
  onCreate: (data: { slug: string; name: string; description: string; order: number }) => void;
  onDelete: (id: string) => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Section title="카테고리">
      <ul className="mb-4 space-y-2 text-sm">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2">
            <span>
              <span className="font-medium">{c.name}</span>{" "}
              <span className="text-gray-400">/{c.slug}</span>
            </span>
            <button onClick={() => onDelete(c.id)} className="text-xs text-red-600 hover:underline">
              삭제
            </button>
          </li>
        ))}
        {categories.length === 0 && <li className="text-sm text-gray-400">등록된 카테고리가 없습니다.</li>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!slug.trim() || !name.trim()) return;
          onCreate({ slug: slug.trim(), name: name.trim(), description: description.trim(), order: 0 });
          setSlug("");
          setName("");
          setDescription("");
        }}
        className="flex flex-wrap gap-2"
      >
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (예: cookware)" className="w-40 rounded border border-gray-300 px-2 py-1 text-sm" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (예: 조리도구)" className="w-40 rounded border border-gray-300 px-2 py-1 text-sm" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명 (선택)" className="w-56 rounded border border-gray-300 px-2 py-1 text-sm" />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white">
          추가
        </button>
      </form>
    </Section>
  );
}

function ComparisonSection({
  comparisons,
  categories,
  onCreate,
  onToggleActive,
  onDelete,
}: {
  comparisons: ComparisonPage[];
  categories: Category[];
  onCreate: (data: { slug: string; title: string; description: string; categoryId: string; order: number }) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  return (
    <Section title="비교 페이지">
      <ul className="mb-4 space-y-2 text-sm">
        {comparisons.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2">
            <span>
              <span className="font-medium">{p.title}</span>{" "}
              <span className="text-gray-400">/compare/{p.slug} · {p.category.name} · 상품 {p._count?.products ?? 0}개</span>
              {!p.active && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">비활성</span>}
            </span>
            <span className="flex gap-3">
              <button onClick={() => onToggleActive(p.id, !p.active)} className="text-xs text-blue-600 hover:underline">
                {p.active ? "비활성화" : "활성화"}
              </button>
              <button onClick={() => onDelete(p.id)} className="text-xs text-red-600 hover:underline">
                삭제
              </button>
            </span>
          </li>
        ))}
        {comparisons.length === 0 && <li className="text-sm text-gray-400">등록된 비교 페이지가 없습니다.</li>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!slug.trim() || !title.trim() || !categoryId) return;
          onCreate({ slug: slug.trim(), title: title.trim(), description: description.trim(), categoryId, order: 0 });
          setSlug("");
          setTitle("");
          setDescription("");
        }}
        className="flex flex-wrap gap-2"
      >
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
          <option value="">카테고리 선택</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (예: best-frying-pans)" className="w-56 rounded border border-gray-300 px-2 py-1 text-sm" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (예: Best frying pans)" className="w-56 rounded border border-gray-300 px-2 py-1 text-sm" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명 (선택)" className="w-56 rounded border border-gray-300 px-2 py-1 text-sm" />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white">
          추가
        </button>
      </form>
    </Section>
  );
}

function ProductSection({
  products,
  comparisons,
  onCreate,
  onToggleActive,
  onDelete,
}: {
  products: ProductRow[];
  comparisons: ComparisonPage[];
  onCreate: (data: { asin: string; comparisonPageId: string; order: number }) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [asin, setAsin] = useState("");
  const [comparisonPageId, setComparisonPageId] = useState("");

  return (
    <Section title="상품 (ASIN)">
      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 pr-4">ASIN</th>
              <th className="py-1 pr-4">비교 페이지</th>
              <th className="py-1 pr-4">제목</th>
              <th className="py-1 pr-4">마지막 갱신</th>
              <th className="py-1 pr-4">상태</th>
              <th className="py-1">작업</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-4 font-mono">{p.asin}</td>
                <td className="py-1.5 pr-4">{p.comparisonPage.title}</td>
                <td className="py-1.5 pr-4">{p.title ?? "-"}</td>
                <td className="py-1.5 pr-4 text-gray-500">
                  {p.lastFetchedAt ? new Date(p.lastFetchedAt).toLocaleString("ko-KR") : "없음"}
                </td>
                <td className="py-1.5 pr-4">
                  {!p.active && <span className="text-gray-400">비활성</span>}
                  {p.active && p.lastError && <span className="text-red-600">오류</span>}
                  {p.active && !p.lastError && p.affiliateUrl && <span className="text-green-600">정상</span>}
                  {p.active && !p.lastError && !p.affiliateUrl && <span className="text-amber-600">대기중</span>}
                </td>
                <td className="py-1.5">
                  <button onClick={() => onToggleActive(p.id, !p.active)} className="mr-3 text-blue-600 hover:underline">
                    {p.active ? "비활성화" : "활성화"}
                  </button>
                  <button onClick={() => onDelete(p.id)} className="text-red-600 hover:underline">
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="py-2 text-gray-400">
                  등록된 상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!asin.trim() || !comparisonPageId) return;
          onCreate({ asin: asin.trim().toUpperCase(), comparisonPageId, order: 0 });
          setAsin("");
        }}
        className="flex flex-wrap gap-2"
      >
        <select value={comparisonPageId} onChange={(e) => setComparisonPageId(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
          <option value="">비교 페이지 선택</option>
          {comparisons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <input
          value={asin}
          onChange={(e) => setAsin(e.target.value)}
          placeholder="ASIN (예: B0DLFMFBJW)"
          className="w-48 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white">
          추가
        </button>
      </form>
      <p className="mt-2 text-xs text-gray-400">
        추가 직후에는 아직 Amazon Creators API 정보가 없어 &ldquo;대기중&rdquo;으로 표시됩니다. 다음 예약 갱신(또는
        GitHub Actions에서 수동 실행)이 실행되면 채워집니다.
      </p>
    </Section>
  );
}
