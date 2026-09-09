// 정책 요구사항: 가격 표시 근처에 Amazon의 표준 가격 고지문을 표시해야 합니다.
export default function PriceDisclaimer() {
  return (
    <p className="mt-6 max-w-3xl text-xs leading-relaxed text-gray-400">
      Product prices and availability are accurate as of the date/time indicated and are subject to
      change. Any price and availability information displayed on Amazon at the time of purchase
      will apply to the purchase.
    </p>
  );
}
