import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // Non-shipped Feature-9 design-reference prototypes: browser-global
    // `<script>` artifacts (React/BottomNav are runtime globals, not imports),
    // not ES modules — intentionally outside the module-based lint scope.
    "docs/design-source/**",
  ]),
]);

export default eslintConfig;
