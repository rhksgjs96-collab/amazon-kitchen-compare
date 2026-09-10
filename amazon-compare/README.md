# 주방용품 비교 사이트 (Amazon Associates)

Amazon Creators API로 상품 정보를 자동으로 가져와, 카테고리별 비교표를 보여주는 사이트입니다.
"Amazon에서 보기" 버튼은 항상 **API가 응답으로 준, 내 파트너 태그가 확인된 링크만** 사용합니다.

- 대상 방문자: **해외(영어권) 고객** — 그래서 공개 페이지(홈/카테고리/비교표)는 영어로 되어 있습니다.
- 관리자 페이지(`/admin`)는 운영자인 나만 보는 화면이라 한국어로 되어 있습니다.

---

## 검증 상태

`npm install`이 되는 환경에서 아래를 실제로 실행해 확인했습니다.

- `npm install` — 성공
- `npm run typecheck` — 오류 없음
- `npm run lint` — 경고/오류 없음
- `npm test` — 56개 케이스 전부 통과
- `npx next build` — 성공 (13개 라우트 빌드 완료)

아직 확인하지 못한 것은 **실제 외부 서비스와 붙는 부분**입니다. 이건 각자의 계정과 자격증명이
있어야만 확인할 수 있습니다.

- Amazon Creators API 실제 호출 (자격증명 필요) — `src/lib/amazon.ts`의 SDK export 이름이
  실제와 다르면 10번 절의 안내대로 그 부분만 맞춰주세요.
- PostgreSQL 실제 연결 및 마이그레이션
- 네이버 블로그 실제 로그인·발행 (8번 절 참고)

---

## 1. 이 사이트가 하는 일

1. 관리자 페이지에서 카테고리 → 비교 페이지 → 상품(ASIN)을 등록합니다.
2. 예약 작업(6시간마다, GitHub Actions)이 Amazon Creators API를 호출해 가격·재고·이미지·제휴링크를
   자동으로 갱신합니다. (직접 크롤링/브라우저 자동화는 절대 하지 않습니다.)
3. 방문자는 `/compare/[slug]` 페이지에서 상품들을 표(모바일에서는 카드)로 비교하고, "View on Amazon"
   버튼으로 이동합니다.
4. 제휴 링크에 내 파트너 태그가 확인되지 않으면 구매 버튼이 자동으로 숨겨지고, 관리자 페이지에
   오류로 기록됩니다.
5. 원하면 비교 페이지 내용을 한국어 블로그 글로 만들어 내 네이버 블로그에 올릴 수 있습니다.
   (`npm run blog:publish` — 8번 절)

---

## 2. 로컬에서 처음 실행하기

### 2-1. 준비물 설치

- [Node.js 18 이상](https://nodejs.org) 설치 (LTS 버전 권장)
- 터미널(맥은 "터미널" 앱, 윈도우는 "PowerShell" 또는 WSL)

### 2-2. 프로젝트 압축 풀기 & 패키지 설치

```bash
cd amazon-compare
npm install
```

`npm install`을 실행하면 `package.json`에 적힌 버전들이 설치됩니다. 만약 `amazon-creators-api`
설치 중 버전 오류가 나면, `npm install amazon-creators-api@latest`로 최신 버전을 다시 설치해보세요
(이 SDK는 비교적 새로 나온 패키지라 버전이 빠르게 바뀔 수 있습니다).

### 2-3. 환경 변수 파일 만들기

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 채웁니다. (각 값을 어떻게 얻는지는 3~4번에서 설명합니다.)

### 2-4. 데이터베이스 준비 및 마이그레이션

```bash
npm run db:generate     # Prisma 클라이언트 생성
npm run db:migrate      # 테이블 생성 (이름을 물어보면 아무 이름이나, 예: init)
```

### 2-5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 홈페이지가, `http://localhost:3000/admin`을 열면
관리자 페이지가 나옵니다. `.env`의 `ADMIN_SECRET` 값을 입력하면 로그인됩니다.

### 2-6. 타입체크 / 린트 / 테스트 (꼭 실행해서 결과를 확인해주세요)

```bash
npm run typecheck
npm run lint
npm test
```

세 명령 모두 오류 없이 끝나야 정상입니다. 오류가 나면 메시지를 캡처해서 알려주세요.

---

## 3. Amazon Associates 가입 + Creators API 신청

1. [Amazon Associates](https://affiliate-program.amazon.com)에 가입하고 파트너 태그(스토어 ID)를
   발급받습니다. 이 값이 `.env`의 `AMAZON_PARTNER_TAG`입니다.
2. **중요**: Creators API는 **최근 30일 안에 10건 이상의 적격 판매 실적**이 있어야 신청·사용할 수
   있습니다. 실적이 아직 없다면, 링크만 걸어두고(수기로) 먼저 판매를 만든 뒤 API를 신청하는 것도
   방법입니다.
3. Associates Central의 "Creators API" 메뉴에서 API 자격증명을 발급받습니다. 이때 나오는
   **Credential ID**와 **Credential Secret**을 즉시 안전한 곳에 저장하세요 (Secret은 그 순간만
   보여주고 다시 볼 수 없습니다).
4. 화면에 표시된 인증 버전(예: `3.3`)을 `.env`의 `AMAZON_CREDENTIAL_VERSION`에 그대로 입력합니다.

> 참고: 예전에 쓰던 "Product Advertising API(PA-API) 5.0"은 2026년에 단계적으로 폐지되고
> Creators API로 대체되었습니다. `AMAZON_ACCESS_KEY` / `AMAZON_SECRET_KEY`(AWS 서명 방식)는
> 더 이상 쓰지 않으니 헷갈리지 마세요.

---

## 4. 환경 변수 설명 (`.env`)

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열. 로컬은 Docker/Postgres.app, 배포는 [Neon](https://neon.tech)이나 Supabase의 무료 플랜을 추천합니다. |
| `AMAZON_CREDENTIAL_ID` | Associates Central에서 발급받은 Creators API Credential ID |
| `AMAZON_CREDENTIAL_SECRET` | 위와 함께 발급받는 Secret (한 번만 표시됨) |
| `AMAZON_CREDENTIAL_VERSION` | 인증 버전 (보통 `3.3`) |
| `AMAZON_PARTNER_TAG` | 내 Associates 파트너 태그 |
| `AMAZON_MARKETPLACE` | 조회할 마켓플레이스 도메인. 해외 고객 대상이면 보통 `www.amazon.com` |
| `CRON_SECRET` | GitHub Actions → `/api/cron/refresh` 호출을 보호하는 임의의 비밀 문자열 |
| `ADMIN_SECRET` | `/admin` 화면과 관리자 API를 보호하는 임의의 비밀 문자열 |
| `SITE_URL` | 배포된 사이트 주소. GitHub Actions 예약 갱신과, 네이버 블로그 글의 "비교 페이지 원본" 링크에 씁니다. |
| `NAVER_*` | 네이버 블로그 자동 업로드용. 8번 절에 따로 정리해 두었습니다. |

`CRON_SECRET`, `ADMIN_SECRET`은 터미널에서 아래처럼 만들 수 있습니다.

```bash
openssl rand -hex 32
```

---

## 5. 관리자 페이지 사용법

`/admin`에서 `ADMIN_SECRET`으로 로그인하면 3가지를 관리합니다.

1. **카테고리** — 예: `cookware` / "Cookware"
2. **비교 페이지** — 카테고리에 속하며, 실제 비교표가 보이는 페이지. 예: `best-frying-pans` /
   "Best Non-Stick Frying Pans"
3. **상품(ASIN)** — 비교 페이지에 속하는 개별 상품의 Amazon ASIN(상품 10자리 코드). 추가 직후에는
   아직 API에서 정보를 안 가져온 상태라 "대기중"으로 보이고, 다음 예약 갱신(또는 GitHub Actions에서
   수동 실행) 후 정보가 채워집니다.

같은 화면 위쪽에서 최근 갱신 로그와, 오류가 난 상품(제휴 링크 미확인 포함)을 확인할 수 있습니다.

---

## 6. 예약 갱신 설정 (GitHub Actions)

이 저장소를 GitHub에 올린 뒤, 저장소 **Settings → Secrets and variables → Actions**에서 아래
두 Secret을 등록하세요.

| Secret 이름 | 값 |
| --- | --- |
| `SITE_URL` | 배포된 사이트 주소, 예: `https://your-app.vercel.app` (끝에 슬래시 없이) |
| `CRON_SECRET` | `.env`에 넣은 값과 **반드시 동일하게** |

`.github/workflows/refresh-prices.yml`이 6시간마다 자동으로 `/api/cron/refresh`를 호출합니다.
저장소의 **Actions** 탭에서 "Run workflow" 버튼을 누르면 즉시 수동 실행도 가능합니다 — 상품을
새로 추가한 직후 바로 정보를 채우고 싶을 때 유용합니다.

(Vercel Cron 대신 GitHub Actions를 선택한 이유: Vercel의 무료 플랜은 Cron 실행 주기에 제약이
있고 설정이 Vercel 프로젝트에 종속되는 반면, GitHub Actions는 무료로 원하는 주기를 쓸 수 있고
배포 플랫폼과 분리되어 있어 더 간단합니다.)

---

## 7. 배포 (Vercel)

1. [Neon](https://neon.tech) 등에서 무료 PostgreSQL 데이터베이스를 만들고 연결 문자열을 복사합니다.
2. GitHub에 이 프로젝트를 올립니다.
3. [Vercel](https://vercel.com)에서 "Add New Project"로 이 저장소를 가져옵니다.
4. Vercel 프로젝트 설정 → Environment Variables에 `.env`와 동일한 값들을 모두 등록합니다.
5. 배포가 끝나면, 배포 후 처음 한 번은 아래 명령으로 DB에 테이블을 만들어야 합니다 (로컬 터미널에서,
   `DATABASE_URL`을 Vercel에 등록한 것과 동일하게 잠깐 `.env`에 넣고 실행).

```bash
npm run db:migrate:deploy
```

6. `/admin`에서 카테고리·비교 페이지·상품을 등록합니다.
7. GitHub Actions Secrets(`SITE_URL`, `CRON_SECRET`)을 등록하고 "Run workflow"로 첫 갱신을
   수동 실행해봅니다.

---

## 8. 네이버 블로그 자동 업로드

비교 페이지 하나를 한국어 블로그 글 한 편으로 만들어, 내 네이버 블로그에 올립니다.
제목·본문·태그를 DB에 있는 상품 정보(가격·재고·주요 사양·제휴 링크)로 자동 생성합니다.

### 8-1. 시작하기 전에 꼭 읽어주세요

**네이버의 "블로그 글쓰기" 오픈API는 서비스가 종료되어, 지금은 외부에서 글을 등록하는 공식
경로가 없습니다.** 그래서 이 기능은 사람이 하는 조작을 브라우저(Playwright)로 그대로 재현합니다.
이 방식에는 아래 위험이 따릅니다. 감수하실 수 있는지 먼저 판단해 주세요.

- 자동화 도구로 로그인·글쓰기를 반복하면 네이버가 캡차를 띄우거나 계정을 제한할 수 있습니다.
  그래서 세션(쿠키)을 파일에 저장해 매번 로그인하지 않도록 했고, 여러 글을 올릴 때는 기본 90초씩
  간격을 둡니다. 하루에 수십 편씩 몰아 올리는 식으로는 쓰지 마세요.
- 한 번 올라간 글은 되돌리기 번거롭고 제휴 링크가 걸려 있어서, **실제 발행 전에는 무엇이
  올라가는지 보여주고 매번 확인을 받습니다** (8-5). 확인 없이 올리려면 `--yes`를 명시해야 합니다.
- 네이버가 화면 구조를 바꾸면 언제든 깨질 수 있습니다. 깨졌을 때 코드를 고치지 않고 대응하는
  방법은 8-7에 적어두었습니다.
- 세션 파일(`.naver-blog/session.json`)에는 **네이버 로그인 쿠키가 그대로** 들어 있습니다.
  `.gitignore`에 넣어두었지만, 커밋하거나 남에게 보내는 일이 없도록 주의해 주세요.

Amazon 쪽 정책은 사이트와 똑같이 지킵니다.

- 아마존을 크롤링하지 않습니다. 예약 갱신이 Creators API로 받아 DB에 넣어둔 값만 씁니다.
- 파트너 태그가 검증된 링크(`affiliateUrl`)가 있는 상품에만 링크를 겁니다. 검증되지 않은 상품은
  링크 없이 싣고, 그 사실을 글에도 적습니다.
- 아마존 상품 이미지는 넣지 않습니다. 네이버 블로그는 외부 이미지를 자기 서버로 복사해 저장하는데,
  이는 아마존이 허용하는 이미지 사용 방식이 아닙니다.
- 대가성 표시(공정거래위원회 추천·보증 심사지침)를 **본문 맨 위에** 넣고, 아마존이 요구하는 영문
  고지와 가격 고지문을 글 끝에 넣습니다. 이 문구들은 옵션이 아니라 항상 들어갑니다.

### 8-2. 준비

```bash
npx playwright install chromium   # 자동화에 쓸 브라우저 내려받기 (최초 1회)
npm run db:migrate                # 발행 이력 테이블(NaverBlogPost) 생성 (최초 1회)
```

`.env`에 아래 값을 채웁니다. 자세한 설명은 8-8의 표에 있습니다.

```
NAVER_BLOG_ID="내_블로그_아이디"      # blog.naver.com/<여기>
NAVER_BLOG_CATEGORY="해외직구"        # 비워두면 블로그 기본 카테고리
SITE_URL="https://your-app.vercel.app"  # 글에 넣을 "비교 페이지 원본" 링크 (선택)
```

### 8-3. 처음 한 번: 로그인 세션 만들기

```bash
npm run blog:login
```

브라우저 창이 뜹니다. **직접** 네이버에 로그인해 주세요. 2단계 인증이나 캡차가 나와도 사람이
바로 처리할 수 있습니다. 로그인이 끝나면 세션이 `.naver-blog/session.json`에 저장되고, 이후
발행은 이 세션을 재사용합니다.

`.env`에 `NAVER_ID`/`NAVER_PW`를 넣어두면 세션이 만료됐을 때 자동으로 다시 로그인을 시도하지만,
캡차에 걸릴 확률이 높습니다. 세션이 만료되면 `npm run blog:login`을 한 번 더 돌리는 쪽을 권합니다.

### 8-4. 올리기 전에 글을 먼저 확인하기

브라우저를 전혀 띄우지 않고, 어떤 글이 만들어지는지만 파일로 뽑아봅니다.

```bash
npm run blog:preview -- --all
```

`.naver-blog/preview/<slug>.html`(브라우저로 열어 확인)과 `<slug>.txt`가 생깁니다.
아직 갱신되지 않아 글에서 빠진 상품, 제휴 링크가 확인되지 않은 상품도 함께 알려줍니다.

### 8-5. 발행하기

```bash
npm run blog:publish -- --slug=best-nonstick-frying-pans   # 한 편만
npm run blog:publish -- --all --draft                      # 전부 임시저장만
npm run blog:publish -- --all                              # 전부 발행
```

처음에는 `--draft`(임시저장)로 한 번 돌려보시길 권합니다. 네이버 블로그의 "내가 쓴 글 → 임시저장"
에서 결과를 눈으로 확인한 뒤, 마음에 들면 `--draft` 없이 다시 돌리면 됩니다.

**실제 발행 전에는 매번 확인을 묻습니다.** 무엇이 올라가는지 보여주고, `y`를 눌러야만 올라갑니다.
그냥 엔터를 치면 올리지 않고 넘어갑니다.

```
──────────────────────────────────────────────────────────────────────────────
  올릴 글
    Best Non-Stick Frying Pans — 아마존 3종 가격·스펙 비교 (2026.09 기준)

  비교 페이지 best-nonstick-frying-pans
  상품        3개 (제휴 링크 없음 1개, 갱신 전이라 제외 1개)
  태그        아마존직구, 해외직구, 직구추천, 주방용품, Cookware, Stick, Fryi…

  본문 앞부분
    ※ 이 글에는 Amazon 어소시에이트 제휴 링크가 포함되어 있습니다. 링크를 통…
    안녕하세요. 이번 글에서는 Cookware 카테고리의 "Best Non-Stick Frying Pans…
    …
──────────────────────────────────────────────────────────────────────────────
  이대로 네이버 블로그에 발행할까요? [y/N]
```

`--all`로 여러 편을 올릴 때는 글마다 따로 묻습니다. 확인 없이 쭉 올리고 싶다면 `--yes`를
명시하세요. 그리고 터미널이 아닌 곳(스크립트, cron 등)에서 실행되면 물어볼 사람이 없으므로
**발행하지 않고 멈춥니다** — 확인 없이 올라가는 경우가 생기면 이 장치가 무의미해지니까요.
임시저장(`--draft`)과 초안 생성(`--dry-run`)은 남에게 보이지 않으므로 묻지 않습니다.

| 옵션 | 뜻 |
| --- | --- |
| `--slug=<slug>` | 발행할 비교 페이지. 여러 번 쓸 수 있습니다. |
| `--all` | 활성 상태(`active=true`)인 비교 페이지 전부 |
| `--dry-run` | 브라우저 없이 초안 파일만 저장 (`npm run blog:preview`가 이 옵션입니다) |
| `--draft` | 발행하지 않고 네이버에 임시저장만 |
| `--headed` | 브라우저 창을 띄운 채 실행 — 무슨 일이 벌어지는지 보고 싶을 때 |
| `--force` | 내용이 지난번과 같아도 다시 발행 |
| `--yes`, `-y` | 발행 전 확인을 묻지 않음. 기본은 매번 묻습니다 |
| `--delay=<초>` | 글과 글 사이 대기 시간 (기본 90초) |
| `--out=<폴더>` | `--dry-run` 결과를 저장할 폴더 |

### 8-6. 같은 글을 두 번 올리지 않는 방법

발행에 성공하면 제목+본문의 SHA-256 해시를 `NaverBlogPost` 테이블에 남깁니다. 다음에 같은
페이지를 다시 올리려 할 때 해시가 같으면 "지난번과 내용이 같다"며 건너뜁니다. 가격이 바뀌면
해시도 바뀌므로 자연스럽게 다시 올라갑니다. 굳이 같은 내용을 또 올리고 싶다면 `--force`를 쓰세요.

이 테이블에는 상품 원본 데이터(가격·재고)를 저장하지 않습니다. 제목, 발행 결과, 글 주소,
본문 해시만 남기므로 "상품 데이터 24시간 보관" 정책과 충돌하지 않습니다.

### 8-7. 네이버 화면이 바뀌어 실패할 때

실패하면 그 시점 화면을 `.naver-blog/screenshots/`에 저장하고, 어떤 요소를 못 찾았는지와
시도한 선택자를 그대로 알려줍니다. 스크린샷과 오류 메시지를 보고 실제 요소의 클래스/ID를
찾았다면, **코드를 고칠 필요 없이** JSON 파일로 덮어쓸 수 있습니다.

```bash
cat > naver-selectors.json <<'JSON'
{ "publishOpenButton": ["button.새로_확인한_클래스"] }
JSON
```

`.env`에 `NAVER_SELECTORS_FILE="naver-selectors.json"`을 넣으면 지정한 키만 교체되고
나머지는 기본값을 그대로 씁니다. 쓸 수 있는 키 목록은 `src/lib/naver-blog/selectors.ts`에
주석과 함께 정리해 두었습니다.

그래도 안 되면 `--headed`로 창을 띄워 어디서 멈추는지 직접 보시는 게 가장 빠릅니다.

### 8-8. 환경 변수

| 변수 | 설명 |
| --- | --- |
| `NAVER_BLOG_ID` | **필수.** `blog.naver.com/<여기>` 부분 |
| `NAVER_ID` / `NAVER_PW` | 선택. 세션이 만료됐을 때 자동 재로그인에 씁니다. 비워두면 `blog:login`으로 직접 로그인해야 합니다. |
| `NAVER_BLOG_CATEGORY` | 선택. 글을 넣을 블로그 카테고리 이름. 비워두면 기본 카테고리 |
| `NAVER_SESSION_PATH` | 로그인 쿠키 저장 위치 (기본 `.naver-blog/session.json`) |
| `NAVER_SCREENSHOT_DIR` | 실패 화면 저장 위치 (기본 `.naver-blog/screenshots`) |
| `NAVER_HEADLESS` | `"false"`면 항상 창을 띄웁니다 (기본 `"true"`) |
| `NAVER_TIMEOUT_MS` | 요소를 기다리는 최대 시간 (기본 30000) |
| `NAVER_SLOWMO_MS` | 조작 사이 간격 (기본 120). 0으로 두면 사람 손보다 훨씬 빨라져 자동화로 감지되기 쉽습니다. |
| `NAVER_SELECTORS_FILE` | 선택자 덮어쓰기 JSON 경로 (8-7 참고) |

### 8-9. 예약 발행은 왜 넣지 않았나

GitHub Actions에서 주기적으로 돌리는 방법도 생각했지만 권하지 않습니다. Actions 러너는 매번
다른 데이터센터 IP를 쓰기 때문에 네이버가 거의 확실하게 캡차나 새 기기 인증을 요구하고, 그러면
사람이 없는 자동 실행은 그 자리에서 멈춥니다. 가격 갱신(6시간마다)은 공식 API를 쓰므로 자동화가
안전하지만, 블로그 발행은 **평소 쓰시는 컴퓨터에서 직접 실행**하는 편이 훨씬 안정적입니다.

---

## 9. 정책 준수 관련 메모

- 상품 정보는 Amazon Creators API 응답만 사용하며, 스크래핑이나 브라우저 자동화는 전혀 쓰지 않습니다.
- 구매 버튼은 API 응답의 `detailPageUrl`(또는 구버전 필드명 `DetailPageURL`)에서, 쿼리스트링의
  `tag` 값이 내 `AMAZON_PARTNER_TAG`와 정확히 일치할 때만 노출됩니다(`src/lib/affiliate-link.ts`).
  일치하지 않거나 링크 자체가 없으면 버튼을 숨기고 관리자 화면에 오류로 남깁니다.
- 가격/재고는 매 갱신마다 기존 값 위에 덮어쓰며, 별도의 과거 이력을 쌓지 않습니다(24시간 보관
  정책과 자연스럽게 맞음).
- 모든 페이지 푸터에 "As an Amazon Associate I earn from qualifying purchases." 문구가 있고,
  비교 페이지 하단에는 Amazon이 요구하는 가격 고지문이 표시됩니다.
- 고객 리뷰·별점은 이번 버전에서 아예 API에 요청조차 하지 않습니다(`src/lib/amazon.ts`의
  `REQUESTED_RESOURCES`에 리뷰 관련 항목 없음).
- 회원가입/로그인/결제 기능은 없습니다. 관리자 화면은 단일 비밀 토큰(`ADMIN_SECRET`)으로만 보호됩니다.
- 네이버 블로그 글도 같은 규칙을 따릅니다. 아마존을 다시 호출하거나 크롤링하지 않고 DB에 있는 값만
  쓰며, 파트너 태그가 검증된 링크만 걸고, 아마존 이미지는 넣지 않습니다. 대가성 표시는 본문 맨 위에
  들어가고 영문 고지와 가격 고지문은 글 끝에 들어갑니다 (`src/lib/naver-blog/post-builder.ts`).
- 네이버 블로그 발행만은 브라우저 자동화를 씁니다. 네이버 글쓰기 오픈API가 종료되어 다른 방법이
  없기 때문이며, 이때 따르는 위험은 8-1에 적어두었습니다.

---

## 10. 자주 발생할 수 있는 문제

**`amazon-creators-api` 관련 타입 오류가 난다** — 이 SDK는 새로 나온 패키지라 `src/lib/amazon.ts`
상단 주석에 적어둔 것처럼 export 이름이 문서와 다를 수 있습니다. `npm install` 후
`node_modules/amazon-creators-api`의 실제 export(클래스 이름)를 확인하고, `src/lib/amazon.ts`의
`getApiClient()` / `fetchProductsByAsins()` 안의 `sdk.ApiClient`, `sdk.TypedDefaultApi`,
`sdk.GetItemsRequestContent` 부분만 맞춰 고치면 됩니다. 나머지 코드(정규화, 검증, 라우트, 화면)는
전혀 손댈 필요 없습니다.

**상품을 추가했는데 계속 "대기중"이다** — 아직 예약 갱신이 실행되지 않은 것입니다. GitHub Actions
탭에서 워크플로를 수동 실행(Run workflow)하거나, `CRON_SECRET`을 넣어 아래처럼 직접 호출해볼 수
있습니다.

```bash
curl -X POST http://localhost:3000/api/cron/refresh -H "x-cron-secret: 여기에_CRON_SECRET"
```

**403 `AssociateNotEligible` 오류** — 최근 30일 10건 판매 조건을 아직 못 채운 상태입니다. 판매
실적을 쌓은 뒤 다시 시도해주세요.

---

## 11. 직접 해야 하는 작업 체크리스트

- [ ] `npm install` 후 `npm run typecheck`, `npm run lint`, `npm test`가 내 환경에서도 통과하는지 확인
- [ ] PostgreSQL 데이터베이스 생성 (Neon/Supabase 등) 후 `DATABASE_URL` 채우기
- [ ] Amazon Associates 가입 및 파트너 태그 발급
- [ ] 최근 30일 10건 판매 조건 충족 후 Creators API 자격증명 발급 (`AMAZON_CREDENTIAL_ID`,
      `AMAZON_CREDENTIAL_SECRET`, `AMAZON_CREDENTIAL_VERSION`)
- [ ] `CRON_SECRET`, `ADMIN_SECRET` 값 생성해서 `.env`에 채우기
- [ ] `npm run db:migrate`로 로컬 DB 마이그레이션
- [ ] `npm run dev`로 로컬 확인, `/admin`에서 카테고리·비교 페이지·상품 등록
- [ ] GitHub 저장소 생성 및 푸시
- [ ] Vercel(또는 유사 서비스)에 배포하고 환경 변수 등록
- [ ] 배포 DB에 `npm run db:migrate:deploy` 실행
- [ ] GitHub Actions Secrets(`SITE_URL`, `CRON_SECRET`) 등록 후 워크플로 수동 실행으로 첫 갱신
      테스트
- [ ] (블로그 업로드를 쓸 경우) `npx playwright install chromium` 실행
- [ ] (블로그 업로드를 쓸 경우) `.env`에 `NAVER_BLOG_ID` 채우고 `npm run blog:login`으로 세션 만들기
- [ ] (블로그 업로드를 쓸 경우) `npm run blog:preview -- --all`로 글 내용 확인 →
      `npm run blog:publish -- --slug=... --draft`로 임시저장 테스트 → 이상 없으면 실제 발행
