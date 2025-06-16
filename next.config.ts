import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    // 核心改动：只有在环境变量为 'true' 时才启用 'export' 模式
    output: process.env.IS_STATIC_EXPORT === 'true' ? 'export' : undefined,
};

export default nextConfig;
