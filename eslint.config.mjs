import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-verify/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // `let` means "this is reassigned below". The files shared byte-for-byte
    // with botatoolbox are exempt: they carry that project's style, and a
    // fix here would break the invariant that scripts/check-shared.ts guards.
    files: [
      "src/**/*.{ts,tsx}",
      "scripts/**/*.ts",
      "test/**/*.ts",
      "plugins/**/*.mjs",
      "*.{mjs,tsx}",
    ],
    ignores: [
      "src/lib/search-engine.ts",
      "src/lib/use-search-index.ts",
      "src/lib/use-highlight-query.ts",
      "src/lib/use-snippets.ts",
      "src/lib/use-chunked-limit.ts",
      "test/search-engine.test.ts",
      "scripts/check-shared.ts",
    ],
    rules: {
      "prefer-const": "error",
    },
  },
  {
    // All internal navigation must go through the locale-aware wrappers
    // in components/locale-link.tsx (Link, useLocaleRouter) so /de/
    // pages link within /de/. Raw next/link would drop the locale
    // prefix. locale-link itself is the sole importer. Same convention
    // as ../botatoolbox.
    files: ["src/**/*.{ts,tsx}", "mdx-components.tsx"],
    ignores: ["src/components/locale-link.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Use Link from @/components/locale-link so hrefs stay locale-aware.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
