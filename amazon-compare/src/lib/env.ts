/**
 * 필수 환경 변수를 안전하게 읽어옵니다.
 * 값이 없으면 즉시 에러를 던져서, 잘못된 설정으로 조용히 동작하는 것을 막습니다.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `환경 변수 ${name}가 설정되지 않았습니다. .env(.local) 또는 배포 환경의 환경 변수를 확인하세요.`
    );
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}
