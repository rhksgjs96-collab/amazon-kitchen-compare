/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Amazon 상품 이미지 도메인만 허용합니다. 마켓플레이스를 바꾸면(AMAZON_MARKETPLACE)
    // 해당 지역의 이미지 CDN 도메인이 다를 수 있으니 필요 시 추가하세요.
    remotePatterns: [
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
    ],
  },
};

export default nextConfig;
