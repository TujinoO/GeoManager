/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ant-design/pro-components": "@ant-design/pro-components/es",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/admin2": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/static": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // 减少内存占用：不计算 gzip 大小
    reportCompressedSize: false,
    modulePreload: {
      resolveDependencies(_filename, deps, context) {
        if (context.hostType !== "html") {
          return deps;
        }
        return deps.filter(
          (dep) =>
            !/assets\/js\/(admin|mapbox)-/.test(dep) &&
            !/assets\/css\/mapbox-/.test(dep),
        );
      },
    },
    // 代码分割策略
    rollupOptions: {
      output: {
        // 控制 chunk 文件命名
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || "";
          if (/\.css$/.test(info)) {
            return "assets/css/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 调整 chunk 大小警告阈值（mapbox-gl 本身就很大）
    chunkSizeWarningLimit: 2000,
  },
  // 优化依赖预构建
  optimizeDeps: {
    // 预构建这些大型依赖，避免开发时重复编译
    include: [
      "mapbox-gl",
      "antd",
      "@ant-design/icons",
      "@ant-design/pro-components",
    ],
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    server: {
      deps: {
        inline: [/@ant-design\/pro-components/],
      },
    },
    deps: {
      optimizer: {
        web: {
          include: ["@ant-design/pro-components"],
        },
      },
    },
  },
});
