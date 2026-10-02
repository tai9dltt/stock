// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Many SpreadJS / Vietstock payloads are still untyped; tighten once they are
    '@typescript-eslint/no-explicit-any': 'warn',
  },
})
