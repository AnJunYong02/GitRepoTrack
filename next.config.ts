import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // 클라이언트 Router Cache: 동적 페이지를 30초 동안 재사용한다.
    // 30초 안에 링크·뒤로가기로 같은 페이지에 다시 오면 서버 렌더링과 loading.tsx 화면 없이 즉시 표시된다.
    // 데이터를 바꾸는 작업은 router.refresh()로 즉시 최신화한다.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
