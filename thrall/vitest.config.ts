import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    globals: true,
    env: {
      TURSO_DATABASE_URL: 'file::memory:?cache=shared',
      JWT_SECRET: 'test-secret-minimum-32-characters!!',
      BLOB_READ_WRITE_TOKEN: 'test-blob-token',
    },
  },
})
