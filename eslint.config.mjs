import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

/**
 * Flat config nativo (ESLint 9). Importamos os presets do `eslint-config-next`
 * diretamente — sem `FlatCompat`/`@eslint/eslintrc`, que causava o erro de
 * "Converting circular structure to JSON" ao carregar a config.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "prisma/generated/**"],
  },
];

export default eslintConfig;
