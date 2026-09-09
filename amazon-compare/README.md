# 주방용품 비교 사이트 (Amazon Associates)

Amazon Creators API로 상품 정보를 자동으로 가져와, 카테고리별 비교표를 보여주는 사이트입니다.
"Amazon에서 보기" 버튼은 항상 **API가 응답으로 준, 내 파트너 태그가 확인된 링크만** 사용합니다.

- 대상 방문자: **해외(영어권) 고객** — 그래서 공개 페이지(홈/카테고리/비교표)는 영어로 되어 있습니다.
- 관리자 페이지(`/admin`)는 운영자인 나만 보는 화면이라 한국어로 되어 있습니다.

---

## ⚠️ 먼저 꼭 읽어주세요 — 이 코드는 아직 한 번도 실행해보지 못했습니다

이 프로젝트를 만든 개발 환경은 보안 정책상 `npm` 패키지 저장소(레지스트리)에 접속할 수 없었습니다.
그래서 `npm install`을 실행하지 못했고, 따라서 `next build`, `npm run lint`, 실제 화면 테스트를
**한 번도 돌려보지 못한 상태**로 코드만 작성했습니다. 대신 할 수 있는 한도 안에서 아래 검증은 마쳤습니다.

- 상품 데이터 변환 로직, 제휴 링크 검증 로직, 24시간 경과 판정 로직 — 실제로 Node.js에서 실행해서
  단위 테스트와 동일한 케이스로 통과 확인함 (19개 케이스 모두 통과)
- `src/` 아래 모든 `.ts`/`.tsx` 파일 — TypeScript 문법 오류 없음 확인
- 핵심 로직 파일들 — TypeScript 타입 오류 없음 확인 (이 과정에서 제네릭 타입 추론 버그 1건을 실제로 찾아 수정함)

하지만 Next.js 프레임워크 자체, Prisma, `amazon-creators-api` SDK가 실제로 설치된 상태에서의
빌드/타입체크/린트는 검증하지 못했습니다. **그러니 아래 "로컬에서 처음 실행하기"를 가장 먼저 진행해서
`npm install` 이후 오류가 없는지 직접 확인해주세요.** 만약 오류가 나면, 오류 메시지를 그대로
저에게(또는 다른 개발자에게) 보여주시면 빠르게 고칠 수 있습니다.

---

## 1. 이 사이트가 하는 일

1. 관리자 페이지에서 카테고리 → 비교 페이지 → 상품(ASIN)을 등록합니다.
2. 예약 작업(6시간마다, GitHub Actions)이 Amazon Creators API를 호출해 가격·재고·이미지·제휴링크를
   자동으로 갱신합니다. (직접 크롤링/브라우저 자동화는 절대 하지 않습니다.)
3. 방문자는 `/compare/[slug]` 페이지에서 상품들을 표(모바일에서는 카드)로 비교하고, "View on Amazon"
   버튼으로 이동합니다.
4. 제휴 링크에 내 파트너 태그가 확인되지 않으면 구매 버튼이 자동으로 숨겨지고, 관리자 페이지에
   오류로 기록됩니다.

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

## 8. 정책 준수 관련 메모

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

---

## 9. 자주 발생할 수 있는 문제

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

## 10. 직접 해야 하는 작업 체크리스트

- [ ] `npm install` 실행하고 오류 없는지 확인 (이 환경에서는 검증 못함 — **가장 먼저 해주세요**)
- [ ] `npm run typecheck`, `npm run lint`, `npm test` 모두 통과하는지 확인
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
