import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'api/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  splitting: false,
  clean: true,
  // Bundle the pure-JS, ESM-only deps inline so there are no runtime
  // ESM/CJS resolution issues. The native libsql chain stays external
  // and is resolved from node_modules at runtime (it does dynamic
  // require() of node builtins, which only works unbundled).
  noExternal: [
    'jose',
    'hono',
    'drizzle-orm',
    'zod',
    'ulidx',
    'bcryptjs',
    '@hono/zod-validator',
    '@vercel/blob',
  ],
  // esbuild's ESM output rewrites require() to a shim that throws on
  // dynamic requires. Injecting a real createRequire makes that shim
  // resolve node builtins (buffer, fs, path) used by bundled CJS deps.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'module';",
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
})
