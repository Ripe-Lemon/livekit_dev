// next.config.mjs

import type { NextConfig } from 'next';

// 1. 定义 PWA 配置
const withPWA = require("next-pwa")({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    skipWaiting: true,
});


// 2. 定义你自己的 Next.js 核心配置
const nextConfig: NextConfig = {
    /* 你其他的配置项可以放在这里 */
    reactStrictMode: true,
    swcMinify: true,
    // 核心改动：只有在环境变量为 'true' 时才启用 'export' 模式
    output: process.env.IS_STATIC_EXPORT === 'true' ? 'export' : undefined,
};

// 3. 使用 withPWA 包裹你的配置并导出
export default withPWA(nextConfig);