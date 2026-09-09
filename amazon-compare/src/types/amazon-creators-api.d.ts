// amazon-creators-api 패키지가 자체 타입 선언을 제공하지 않거나 버전에 따라
// export 형태가 다를 경우를 대비한 안전장치입니다. 실제 사용은 src/lib/amazon.ts에서
// 네임스페이스 import + 방어적 접근으로 처리하므로, 여기서는 "any 모듈"로만 선언해
// 타입 체크가 존재하지 않는 export 때문에 막히지 않도록 합니다.
//
// 만약 npm install 후 이 패키지가 자체 .d.ts를 제공한다면(대부분 그렇습니다),
// 이 파일은 무시되거나 삭제해도 됩니다.
declare module "amazon-creators-api";
