import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ant-design/pro-components": "@ant-design/pro-components/es",
    },
  },
  optimizeDeps: {
    include: [
      "mapbox-gl",
      "antd",
      "@ant-design/icons",
      "@ant-design/pro-components",
    ],
  },
  test: {
    include: ["src/**/*.browser.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
    setupFiles: ["./src/test/browserSetup.ts"],
    testTimeout: 30000,
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
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotDirectory: "test-results/browser-screenshots",
      instances: [
        {
          browser: "chromium",
          viewport: { width: 1600, height: 900 },
        },
      ],
    },
  },
});
