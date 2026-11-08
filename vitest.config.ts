import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
