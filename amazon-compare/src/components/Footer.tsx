// 정책 요구사항: 사이트의 모든 페이지 푸터에 Amazon Associate 고지문을 표시해야 합니다.
// 이 컴포넌트는 루트 레이아웃(src/app/layout.tsx)에서 모든 페이지에 공통으로 렌더링됩니다.
export default function Footer() {
  return (
    <footer className="mt-12 border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs leading-relaxed text-gray-500">
        <p className="font-medium text-gray-600">
          As an Amazon Associate I earn from qualifying purchases.
        </p>
        <p className="mt-1">
          This site is a participant in the Amazon Associates Program and may earn commissions on
          qualifying purchases made through links on this site.
        </p>
      </div>
    </footer>
  );
}
