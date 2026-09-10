/**
 * 네이버 블로그 자동 업로드 CLI.
 *
 *   npm run blog:login                       # 창을 띄워 한 번 직접 로그인 → 세션 저장
 *   npm run blog:preview -- --all            # 브라우저 없이 글 초안만 파일로 뽑아 확인
 *   npm run blog:publish -- --slug=best-pans # 한 편 발행
 *   npm run blog:publish -- --all --draft    # 전체를 임시저장만 (눈으로 확인 후 직접 발행)
 *
 * 자세한 설명은 README의 "네이버 블로그 자동 업로드" 절을 봐주세요.
 */

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { buildBlogPost } from "@/lib/naver-blog/post-builder";
import { listPublishableSlugs, loadBlogSource } from "@/lib/naver-blog/source";
import { createLoginSession, publishToNaverBlog } from "@/lib/naver-blog/publisher";
import { askToPublish, formatConfirmationSummary } from "@/lib/naver-blog/confirm";
import type { BlogPostDraft } from "@/lib/naver-blog/types";

interface CliOptions {
  slugs: string[];
  all: boolean;
  dryRun: boolean;
  draft: boolean;
  headed: boolean;
  force: boolean;
  login: boolean;
  assumeYes: boolean;
  help: boolean;
  outDir: string;
  delayMs: number;
}

const USAGE = `
네이버 블로그 자동 업로드

사용법: tsx scripts/publish-naver-blog.ts [옵션]

  --slug=<slug>   발행할 비교 페이지 slug. 여러 번 쓸 수 있습니다.
  --all           활성 상태인 비교 페이지를 전부 대상으로 합니다.
  --dry-run       브라우저를 띄우지 않고 글 초안만 파일로 저장합니다.
  --draft         발행하지 않고 네이버에 임시저장만 합니다.
  --headed        브라우저 창을 띄운 채로 실행합니다(무슨 일이 벌어지는지 볼 때).
  --force         내용이 지난번과 같아도 다시 발행합니다.
  --yes, -y       발행 전 확인을 묻지 않습니다 (기본은 매번 물어봅니다).
  --login         창을 띄워 직접 로그인하고 세션만 저장한 뒤 끝냅니다.
  --out=<dir>     --dry-run 결과를 저장할 폴더 (기본: .naver-blog/preview)
  --delay=<초>    글과 글 사이 대기 시간 (기본: 90초)
  --help          이 도움말
`.trim();

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    slugs: [],
    all: false,
    dryRun: false,
    draft: false,
    headed: false,
    force: false,
    login: false,
    assumeYes: false,
    help: false,
    outDir: ".naver-blog/preview",
    delayMs: 90_000,
  };

  for (const arg of argv) {
    if (arg === "--all") options.all = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--draft") options.draft = true;
    else if (arg === "--headed") options.headed = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--login") options.login = true;
    else if (arg === "--yes" || arg === "-y") options.assumeYes = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--slug=")) options.slugs.push(arg.slice("--slug=".length));
    else if (arg.startsWith("--out=")) options.outDir = arg.slice("--out=".length);
    else if (arg.startsWith("--delay=")) {
      const seconds = Number(arg.slice("--delay=".length));
      if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error(`--delay 값이 숫자가 아닙니다: ${arg}`);
      }
      options.delayMs = seconds * 1000;
    } else {
      throw new Error(`알 수 없는 옵션입니다: ${arg}\n\n${USAGE}`);
    }
  }

  return options;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 이 내용이 이미 같은 페이지로 발행된 적이 있는지. --force면 확인하지 않습니다. */
async function alreadyPublished(comparisonPageId: string, contentHash: string): Promise<boolean> {
  const existing = await prisma.naverBlogPost.findFirst({
    where: { comparisonPageId, contentHash, status: "PUBLISHED" },
    select: { id: true },
  });
  return existing !== null;
}

function reportDraftNotes(slug: string, draft: BlogPostDraft): void {
  if (draft.pendingAsins.length > 0) {
    console.warn(
      `  · [${slug}] 아직 갱신되지 않아 글에서 뺀 상품: ${draft.pendingAsins.join(", ")} ` +
        `(예약 갱신이 상품 정보를 채운 뒤 다시 올려주세요)`
    );
  }
  if (draft.unlinkedAsins.length > 0) {
    console.warn(
      `  · [${slug}] 제휴 링크가 확인되지 않아 링크 없이 실은 상품: ${draft.unlinkedAsins.join(", ")}`
    );
  }
}

function writePreview(outDir: string, slug: string, draft: BlogPostDraft): string {
  const dir = path.resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const htmlPath = path.join(dir, `${slug}.html`);
  writeFileSync(
    htmlPath,
    `<!doctype html>\n<meta charset="utf-8">\n<title>${draft.title}</title>\n<h1>${draft.title}</h1>\n${draft.html}\n`,
    "utf8"
  );
  writeFileSync(path.join(dir, `${slug}.txt`), `${draft.title}\n\n${draft.text}\n`, "utf8");
  return htmlPath;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(USAGE);
    return;
  }

  if (options.login) {
    const sessionPath = await createLoginSession();
    console.log(`[naver-blog] 로그인 세션을 저장했습니다: ${sessionPath}`);
    console.log("[naver-blog] 이 파일에는 로그인 쿠키가 들어 있습니다. 커밋하거나 공유하지 마세요.");
    return;
  }

  const slugs = options.all ? await listPublishableSlugs() : options.slugs;
  if (slugs.length === 0) {
    throw new Error(`발행할 대상이 없습니다. --slug=<slug> 또는 --all을 지정해 주세요.\n\n${USAGE}`);
  }

  let failures = 0;

  for (const [index, slug] of slugs.entries()) {
    console.log(`\n[naver-blog] (${index + 1}/${slugs.length}) ${slug}`);

    const loaded = await loadBlogSource(slug);
    if (!loaded) {
      console.error(`  · 활성 상태인 비교 페이지 "${slug}"를 찾지 못했습니다.`);
      failures += 1;
      continue;
    }

    const draft = buildBlogPost(loaded.source);
    reportDraftNotes(slug, draft);

    if (draft.includedCount === 0) {
      console.error(
        `  · 글에 실을 상품이 없어 건너뜁니다. 예약 갱신(/api/cron/refresh)이 먼저 돌아야 합니다.`
      );
      failures += 1;
      continue;
    }

    if (options.dryRun) {
      const file = writePreview(options.outDir, slug, draft);
      console.log(`  · 초안 저장: ${file} (상품 ${draft.includedCount}개, 태그 ${draft.tags.join(", ")})`);
      continue;
    }

    if (!options.force && (await alreadyPublished(loaded.comparisonPageId, draft.contentHash))) {
      console.log("  · 지난번과 내용이 같아 건너뜁니다. 다시 올리려면 --force를 쓰세요.");
      continue;
    }

    // 실제 발행은 되돌리기 번거로우므로 매번 사람에게 확인받습니다.
    // (--draft는 남에게 보이지 않는 임시저장이라 묻지 않습니다.)
    if (!options.draft && !options.assumeYes) {
      const outcome = await askToPublish(formatConfirmationSummary(slug, draft));
      if (outcome === "no-tty") {
        console.error(
          "  · 확인을 받을 터미널이 없어 발행하지 않았습니다. " +
            "사람 없이 돌리시려면 --yes를 명시하거나, --draft로 임시저장만 하세요."
        );
        failures += 1;
        continue;
      }
      if (outcome === "declined") {
        console.log("  · 발행하지 않고 넘어갑니다.");
        continue;
      }
    }

    try {
      const result = await publishToNaverBlog(draft, {
        draft: options.draft,
        ...(options.headed ? { headless: false } : {}),
      });

      await prisma.naverBlogPost.create({
        data: {
          comparisonPageId: loaded.comparisonPageId,
          status: result.status,
          postTitle: draft.title,
          postUrl: result.postUrl,
          contentHash: draft.contentHash,
        },
      });

      if (result.pastedAsPlainText) {
        console.warn("  · 본문이 평문으로 들어갔습니다. 발행된 글에서 표·링크 서식을 확인해 주세요.");
      }
      console.log(
        result.status === "DRAFT"
          ? "  · 임시저장 완료. 네이버 블로그에서 확인 후 직접 발행해 주세요."
          : `  · 발행 완료: ${result.postUrl ?? "(글 주소를 확인하지 못했습니다 — 블로그에서 직접 확인해 주세요)"}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures += 1;
      console.error(`  · 발행 실패: ${message}`);
      await prisma.naverBlogPost.create({
        data: {
          comparisonPageId: loaded.comparisonPageId,
          status: "FAILED",
          postTitle: draft.title,
          contentHash: draft.contentHash,
          error: message.slice(0, 2000),
        },
      });
    }

    const isLast = index === slugs.length - 1;
    if (!isLast && options.delayMs > 0) {
      console.log(`  · 다음 글까지 ${Math.round(options.delayMs / 1000)}초 대기합니다.`);
      await sleep(options.delayMs);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
    console.error(`\n[naver-blog] ${failures}건 실패했습니다.`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
