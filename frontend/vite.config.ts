import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/admin": {
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
    // 代码分割策略
    rollupOptions: {
      output: {
        // 分包策略：只把最大的 mapbox-gl 单独拆分
        manualChunks(id) {
          // mapbox-gl 是最大的依赖（~1.8MB），单独分包
          if (id.includes("mapbox-gl")) {
            return "mapbox";
          }
          // 其他 node_modules 统一放入 vendor
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
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
    include: ["mapbox-gl", "antd", "lucide-react"],
  },
});
