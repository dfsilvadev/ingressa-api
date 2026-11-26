/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,js,mjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
}
