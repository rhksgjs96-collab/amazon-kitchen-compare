import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Frame, type Locator, type Page } from "playwright";
import { requireEnv, optionalEnv } from "@/lib/env";
import { loadSelectors, type NaverSelectors } from "./selectors";
import type { BlogPostDraft } from "./types";

/**
 * Playwright로 네이버 블로그에 글을 올립니다.
 *
 * 왜 브라우저 자동화인가: 네이버의 "블로그 글쓰기" 오픈API는 서비스가 종료되어, 지금은
 * 외부에서 글을 등록하는 공식 경로가 없습니다. 그래서 사람이 하는 조작을 그대로 재현합니다.
 *
 * 알고 쓰셔야 하는 점 (README에도 같은 내용을 적어두었습니다):
 * - 자동화 도구로 로그인·글쓰기를 반복하면 네이버가 캡차를 띄우거나 계정을 제한할 수 있습니다.
 *   매번 로그인하지 않도록 세션(쿠키)을 파일에 저장해 재사용하고, 한 번에 여러 글을 올릴 때는
 *   글 사이에 간격을 둡니다.
 * - 첫 로그인은 `--login`으로 창을 띄워 직접 하시는 편이 안전합니다. 2단계 인증이나 캡차가
 *   나와도 사람이 바로 처리할 수 있고, 그렇게 만든 세션 파일을 이후 자동 발행이 재사용합니다.
 * - 세션 파일에는 로그인 쿠키가 그대로 들어 있습니다. 절대 커밋하거나 공유하지 마세요.
 */

export interface NaverConfig {
  blogId: string;
  loginId: string | null;
  loginPassword: string | null;
  /** 발행 레이어에서 고를 블로그 카테고리 이름. 없으면 네이버 기본값을 씁니다. */
  categoryName: string | null;
}

export interface PublishOptions {
  /** 창을 띄우지 않고 돌릴지. 첫 로그인은 headless=false를 권합니다. */
  headless: boolean;
  /** true면 발행 대신 임시저장만 합니다. */
  draft: boolean;
  sessionPath: string;
  screenshotDir: string;
  timeoutMs: number;
  slowMoMs: number;
}

export interface PublishResult {
  status: "PUBLISHED" | "DRAFT";
  postUrl: string | null;
  /** 클립보드(서식 유지) 대신 평문 타이핑으로 본문을 넣었는지. */
  pastedAsPlainText: boolean;
}

const LOGIN_URL = "https://nid.naver.com/nidlogin.login?mode=form&url=https%3A%2F%2Fwww.naver.com%2F";

export function resolveNaverConfig(): NaverConfig {
  return {
    blogId: requireEnv("NAVER_BLOG_ID"),
    loginId: process.env.NAVER_ID?.trim() || null,
    loginPassword: process.env.NAVER_PW || null,
    categoryName: process.env.NAVER_BLOG_CATEGORY?.trim() || null,
  };
}

export function resolvePublishOptions(overrides: Partial<PublishOptions> = {}): PublishOptions {
  return {
    headless: overrides.headless ?? optionalEnv("NAVER_HEADLESS", "true") !== "false",
    draft: overrides.draft ?? false,
    sessionPath: overrides.sessionPath ?? optionalEnv("NAVER_SESSION_PATH", ".naver-blog/session.json"),
    screenshotDir: overrides.screenshotDir ?? optionalEnv("NAVER_SCREENSHOT_DIR", ".naver-blog/screenshots"),
    timeoutMs: overrides.timeoutMs ?? Number(optionalEnv("NAVER_TIMEOUT_MS", "30000")),
    slowMoMs: overrides.slowMoMs ?? Number(optionalEnv("NAVER_SLOWMO_MS", "120")),
  };
}

/* ------------------------------------------------------------------ *
 * 선택자 도우미
 * ------------------------------------------------------------------ */

/** 후보 선택자들 중 화면에 실제로 보이는 첫 번째를 찾습니다. */
async function firstVisible(
  page: Page,
  scope: Page | Frame,
  candidates: string[],
  label: string,
  timeoutMs = 8000
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  do {
    for (const selector of candidates) {
      const locator = scope.locator(selector).first();
      try {
        if ((await locator.count()) > 0 && (await locator.isVisible())) {
          return locator;
        }
      } catch {
        // 선택자 문법 오류나 프레임 소멸 — 다음 후보로 넘어갑니다.
      }
    }
    await page.waitForTimeout(250);
  } while (Date.now() < deadline);

  throw new Error(
    `${label}을(를) 찾지 못했습니다. 네이버 화면 구조가 바뀐 것 같습니다.\n` +
      `시도한 선택자: ${candidates.join(" | ")}\n` +
      `NAVER_SELECTORS_FILE로 선택자를 덮어쓰면 코드 수정 없이 고칠 수 있습니다 (README 참고).`
  );
}

/** 있으면 누르고, 없으면 조용히 넘어갑니다(팝업처럼 뜰 수도 안 뜰 수도 있는 것들). */
async function clickIfPresent(
  page: Page,
  scope: Page | Frame,
  candidates: string[],
  waitMs = 2000
): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  do {
    for (const selector of candidates) {
      const locator = scope.locator(selector).first();
      try {
        if ((await locator.count()) > 0 && (await locator.isVisible())) {
          await locator.click({ timeout: 3000 });
          return true;
        }
      } catch {
        // 무시하고 계속
      }
    }
    await page.waitForTimeout(200);
  } while (Date.now() < deadline);
  return false;
}

async function isPresent(scope: Page | Frame, candidates: string[]): Promise<boolean> {
  for (const selector of candidates) {
    const locator = scope.locator(selector).first();
    try {
      if ((await locator.count()) > 0 && (await locator.isVisible())) return true;
    } catch {
      // 무시
    }
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * 브라우저 수명 관리
 * ------------------------------------------------------------------ */

async function withBrowser<T>(
  options: PublishOptions,
  run: (page: Page, context: BrowserContext) => Promise<T>
): Promise<T> {
  mkdirSync(path.dirname(path.resolve(options.sessionPath)), { recursive: true });
  mkdirSync(path.resolve(options.screenshotDir), { recursive: true });

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({ headless: options.headless, slowMo: options.slowMoMs });
    context = await browser.newContext({
      // 네이버는 한국어/한국 시간대를 전제로 화면을 그립니다. 맞춰두면 선택자가 덜 흔들립니다.
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      viewport: { width: 1440, height: 960 },
      storageState: await readStorageState(options.sessionPath),
    });
    // 본문을 서식 그대로 붙여넣으려면 클립보드 쓰기 권한이 필요합니다.
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "https://blog.naver.com",
    });
    context.setDefaultTimeout(options.timeoutMs);

    page = await context.newPage();
    // 에디터가 가끔 confirm/alert를 띄웁니다. 응답하지 않으면 그대로 멈춰버립니다.
    page.on("dialog", (dialog) => void dialog.accept().catch(() => undefined));

    return await run(page, context);
  } catch (err) {
    if (page) {
      const file = path.join(
        path.resolve(options.screenshotDir),
        `error-${new Date().toISOString().replace(/[:.]/g, "-")}.png`
      );
      await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${message}\n실패 시점 화면을 저장했습니다: ${file}`);
    }
    throw err;
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

async function readStorageState(sessionPath: string): Promise<string | undefined> {
  const { existsSync } = await import("node:fs");
  return existsSync(sessionPath) ? sessionPath : undefined;
}

/* ------------------------------------------------------------------ *
 * 로그인
 * ------------------------------------------------------------------ */

function writeUrl(blogId: string): string {
  return `https://blog.naver.com/${blogId}/postwrite`;
}

async function isLoginPage(page: Page): Promise<boolean> {
  return page.url().includes("nid.naver.com");
}

/**
 * 저장된 세션으로 글쓰기 화면까지 들어갑니다. 세션이 없거나 만료됐으면 ID/PW로 로그인합니다.
 * 캡차나 2단계 인증이 나오면 자동으로 뚫으려 하지 않고, 사람이 처리하도록 안내하며 멈춥니다.
 */
async function ensureWriteScreen(
  page: Page,
  context: BrowserContext,
  config: NaverConfig,
  options: PublishOptions,
  selectors: NaverSelectors
): Promise<void> {
  await page.goto(writeUrl(config.blogId), { waitUntil: "domcontentloaded" });

  if (await isLoginPage(page)) {
    await performLogin(page, config, options, selectors);
    await page.goto(writeUrl(config.blogId), { waitUntil: "domcontentloaded" });
  }

  if (await isLoginPage(page)) {
    throw new Error(
      "로그인 후에도 계속 로그인 화면으로 돌아옵니다. `npm run blog:login`으로 창을 띄워 직접 로그인해 세션을 다시 만들어 주세요."
    );
  }

  await context.storageState({ path: options.sessionPath });
}

async function performLogin(
  page: Page,
  config: NaverConfig,
  options: PublishOptions,
  selectors: NaverSelectors
): Promise<void> {
  if (!config.loginId || !config.loginPassword) {
    throw new Error(
      "저장된 세션이 없거나 만료됐는데 NAVER_ID/NAVER_PW가 없습니다. " +
        "`npm run blog:login`으로 직접 로그인하거나 .env에 계정을 넣어주세요."
    );
  }
  if (options.headless) {
    console.warn(
      "[naver-blog] 창 없이(headless) 로그인을 시도합니다. 네이버가 캡차를 띄울 확률이 높습니다. " +
        "막히면 `npm run blog:login`으로 한 번만 직접 로그인해 주세요."
    );
  }

  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

  // fill()로 값을 한 번에 넣으면 네이버의 자동입력 감지에 걸립니다.
  // 클릭 후 keyboard.insertText로 넣으면 실제 입력과 같은 이벤트가 발생합니다.
  const idInput = await firstVisible(page, page, selectors.loginIdInput, "로그인 아이디 입력란");
  await idInput.click();
  await page.keyboard.insertText(config.loginId);

  const pwInput = await firstVisible(page, page, selectors.loginPwInput, "로그인 비밀번호 입력란");
  await pwInput.click();
  await page.keyboard.insertText(config.loginPassword);

  const submit = await firstVisible(page, page, selectors.loginSubmit, "로그인 버튼");
  await submit.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);

  if (await isPresent(page, selectors.captchaIndicator)) {
    throw new Error(
      "네이버가 자동입력 방지문자(캡차)를 요구했습니다. 자동으로는 통과할 수 없습니다.\n" +
        "`npm run blog:login`을 실행해 창에서 직접 로그인하시면, 이후 발행은 저장된 세션을 재사용합니다."
    );
  }

  // "새로운 기기 등록" 안내가 나오면 등록하지 않고 넘어갑니다.
  await clickIfPresent(page, page, selectors.deviceRegisterSkip, 3000);
  await page.waitForTimeout(1000);
}

/**
 * 창을 띄워 사람이 직접 로그인하게 하고, 끝나면 세션을 저장합니다.
 * 2단계 인증·캡차가 있는 계정은 이 방법이 유일하게 확실합니다.
 */
export async function createLoginSession(
  overrides: Partial<PublishOptions> = {}
): Promise<string> {
  const config = resolveNaverConfig();
  const options = resolvePublishOptions({ ...overrides, headless: false });

  return withBrowser(options, async (page, context) => {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    console.log(
      "[naver-blog] 열린 창에서 네이버에 로그인해 주세요. 로그인이 끝나면 자동으로 세션을 저장합니다. (최대 5분 대기)"
    );

    await page.waitForURL((url) => !url.href.includes("nid.naver.com"), { timeout: 5 * 60_000 });
    await page.goto(writeUrl(config.blogId), { waitUntil: "domcontentloaded" });

    if (await isLoginPage(page)) {
      throw new Error("아직 로그인되지 않았습니다. 다시 시도해 주세요.");
    }

    await context.storageState({ path: options.sessionPath });
    return path.resolve(options.sessionPath);
  });
}

/* ------------------------------------------------------------------ *
 * 에디터 조작
 * ------------------------------------------------------------------ */

/** 에디터는 보통 #mainFrame 안에 있지만, 최상위 문서에 바로 그려질 때도 있습니다. */
async function resolveEditorFrame(
  page: Page,
  selectors: NaverSelectors,
  timeoutMs: number
): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  do {
    const candidates: Frame[] = [page.mainFrame(), ...page.frames()];
    for (const frame of candidates) {
      for (const selector of selectors.titleInput) {
        try {
          if ((await frame.locator(selector).count()) > 0) return frame;
        } catch {
          // 프레임이 아직 이동 중 — 다음 기회에.
        }
      }
    }
    await page.waitForTimeout(300);
  } while (Date.now() < deadline);

  throw new Error(
    "스마트에디터를 찾지 못했습니다. 글쓰기 화면이 열렸는지, 선택자(titleInput)가 아직 유효한지 확인해 주세요."
  );
}

/** 처음 글쓰기 화면에 들어가면 뜨는 팝업들을 치웁니다. */
async function dismissEditorPopups(page: Page, frame: Frame, selectors: NaverSelectors): Promise<void> {
  // "작성 중이던 글이 있습니다. 이어서 쓰시겠어요?" — [취소]를 눌러 빈 글로 시작합니다.
  await clickIfPresent(page, frame, selectors.restorePopupCancel, 3000);
  await clickIfPresent(page, frame, selectors.helpPanelClose, 1500);
}

/**
 * 본문을 서식 그대로 넣기 위해 클립보드에 text/html을 올리고 붙여넣습니다.
 * 브라우저가 클립보드를 막으면 false를 돌려주고, 호출한 쪽이 평문 타이핑으로 대체합니다.
 */
async function pasteHtml(page: Page, frame: Frame, html: string, text: string): Promise<boolean> {
  let written = false;
  try {
    written = await frame.evaluate(
      async ({ html, text }: { html: string; text: string }) => {
        try {
          if (!navigator.clipboard || typeof ClipboardItem === "undefined") return false;
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([text], { type: "text/plain" }),
            }),
          ]);
          return true;
        } catch {
          return false;
        }
      },
      { html, text }
    );
  } catch {
    written = false;
  }

  if (!written) return false;

  await page.keyboard.press("Control+V");
  await page.waitForTimeout(1500);
  return true;
}

/** 클립보드가 막혔을 때: 줄 단위로 타이핑합니다. 링크는 URL 그대로 들어갑니다. */
async function typePlainText(page: Page, text: string): Promise<void> {
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line !== "") {
      await page.keyboard.insertText(line);
    }
    if (index < lines.length - 1) {
      await page.keyboard.press("Enter");
    }
  }
}

async function fillEditor(
  page: Page,
  frame: Frame,
  draft: BlogPostDraft,
  selectors: NaverSelectors
): Promise<boolean> {
  const titleField = await firstVisible(page, frame, selectors.titleInput, "글 제목 입력 영역");
  await titleField.click();
  await page.keyboard.insertText(draft.title);
  await page.waitForTimeout(400);

  const bodyField = await firstVisible(page, frame, selectors.bodyInput, "본문 입력 영역");
  await bodyField.click();
  await page.waitForTimeout(400);

  const pasted = await pasteHtml(page, frame, draft.html, draft.text);
  if (!pasted) {
    console.warn(
      "[naver-blog] 클립보드 붙여넣기가 막혀 평문으로 입력합니다. 표와 링크는 글자 그대로 들어갑니다."
    );
    await typePlainText(page, draft.text);
  }
  return !pasted;
}

/* ------------------------------------------------------------------ *
 * 발행
 * ------------------------------------------------------------------ */

async function selectCategory(
  page: Page,
  scope: Page | Frame,
  selectors: NaverSelectors,
  categoryName: string
): Promise<void> {
  try {
    const button = await firstVisible(page, scope, selectors.categorySelectButton, "카테고리 선택 버튼", 4000);
    await button.click();
    await page.waitForTimeout(500);

    for (const selector of selectors.categoryOption) {
      const option = scope.locator(selector).filter({ hasText: categoryName }).first();
      if ((await option.count()) > 0 && (await option.isVisible())) {
        await option.click();
        await page.waitForTimeout(400);
        return;
      }
    }
    console.warn(
      `[naver-blog] 카테고리 "${categoryName}"을(를) 목록에서 찾지 못했습니다. 블로그 기본 카테고리로 발행합니다.`
    );
  } catch {
    console.warn(
      "[naver-blog] 카테고리 선택 UI를 열지 못했습니다. 블로그 기본 카테고리로 발행합니다."
    );
  }
}

async function applyTags(
  page: Page,
  scope: Page | Frame,
  selectors: NaverSelectors,
  tags: string[]
): Promise<void> {
  if (tags.length === 0) return;
  try {
    const input = await firstVisible(page, scope, selectors.tagInput, "태그 입력란", 4000);
    await input.click();
    for (const tag of tags) {
      await page.keyboard.insertText(tag);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
    }
  } catch {
    console.warn("[naver-blog] 태그 입력란을 찾지 못해 태그 없이 발행합니다.");
  }
}

/** 발행 직후 이동한 주소에서 글 URL을 뽑습니다. 못 찾으면 null(발행 자체는 성공). */
async function capturePostUrl(page: Page, blogId: string, timeoutMs: number): Promise<string | null> {
  try {
    await page.waitForURL(
      (url) => url.href.includes(`blog.naver.com/${blogId}`) && !url.href.includes("postwrite"),
      { timeout: timeoutMs }
    );
  } catch {
    return null;
  }

  const current = new URL(page.url());
  const logNo = current.searchParams.get("logNo");
  if (logNo) return `https://blog.naver.com/${blogId}/${logNo}`;

  const fromPath = current.pathname.match(/^\/[^/]+\/(\d+)/);
  return fromPath ? `https://blog.naver.com/${blogId}/${fromPath[1]}` : page.url();
}

/**
 * 글 한 편을 네이버 블로그에 올립니다.
 * options.draft가 true면 발행 대신 임시저장만 하고 끝냅니다(먼저 눈으로 확인하고 싶을 때).
 */
export async function publishToNaverBlog(
  draft: BlogPostDraft,
  overrides: Partial<PublishOptions> = {}
): Promise<PublishResult> {
  if (draft.includedCount === 0) {
    throw new Error("글에 실을 상품이 하나도 없습니다. 예약 갱신이 상품 정보를 채운 뒤에 다시 시도해 주세요.");
  }

  const config = resolveNaverConfig();
  const options = resolvePublishOptions(overrides);
  const selectors = loadSelectors();

  return withBrowser(options, async (page, context) => {
    await ensureWriteScreen(page, context, config, options, selectors);

    const frame = await resolveEditorFrame(page, selectors, options.timeoutMs);
    await dismissEditorPopups(page, frame, selectors);
    const pastedAsPlainText = await fillEditor(page, frame, draft, selectors);

    if (options.draft) {
      const saveButton = await firstVisible(page, frame, selectors.saveDraftButton, "임시저장 버튼");
      await saveButton.click();
      await page.waitForTimeout(3000);
      return { status: "DRAFT", postUrl: null, pastedAsPlainText };
    }

    const publishButton = await firstVisible(page, frame, selectors.publishOpenButton, "발행 버튼");
    await publishButton.click();
    await page.waitForTimeout(1200);

    if (config.categoryName) {
      await selectCategory(page, frame, selectors, config.categoryName);
    }
    await applyTags(page, frame, selectors, draft.tags);

    const confirmButton = await firstVisible(
      page,
      frame,
      selectors.publishConfirmButton,
      "발행 설정 레이어의 최종 발행 버튼"
    );
    await confirmButton.click();

    const postUrl = await capturePostUrl(page, config.blogId, options.timeoutMs);
    await context.storageState({ path: options.sessionPath });

    return { status: "PUBLISHED", postUrl, pastedAsPlainText };
  });
}
