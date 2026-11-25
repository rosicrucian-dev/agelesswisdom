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
    // `let` means "this is reassigned below".
    files: [
      "src/**/*.{ts,tsx}",
      "scripts/**/*.ts",
      "test/**/*.ts",
      "plugins/**/*.mjs",
      "*.{mjs,tsx}",
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
