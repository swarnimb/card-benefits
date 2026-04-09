import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    env: {
      DATABASE_URL: 'file:./dev.db',
      ADMIN_EMAIL: 'test@example.com',
      ADMIN_USER_ID: 'user_test',
      NEXTAUTH_SECRET: 'test-secret',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
