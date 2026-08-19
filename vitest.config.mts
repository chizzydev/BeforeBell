import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
   coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: [
    "src/domain/**/*.ts",
    "src/application/**/*.ts",
  ],
  exclude: [
  "src/domain/types.ts",
  "src/application/action-result.ts",
  "src/application/store/beforebell-store.ts",
],
},
  },
});