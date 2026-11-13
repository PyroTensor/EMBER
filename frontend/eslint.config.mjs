import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const mocksPattern = {
  group: ["@/mocks", "@/mocks/*"],
  message: "Only src/app/providers.tsx (and src/mocks itself) may import mocks.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files:
    "public/mockServiceWorker.js",
  ]),
  // Mocks are loaded only through providers.tsx.
  {
    files: ["**/*.{ts,tsx,mts,js,mjs}"],
    ignores: ["src/mocks/**", "src/app/providers.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [mocksPattern] }],
    },
  },
  // components/ is feature-agnostic.
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            mocksPattern,
            {
              group: ["@/features", "@/features/*"],
              message: "components/** must not import from features/**.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
