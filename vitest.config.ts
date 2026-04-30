import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    environmentMatchGlobs: [
      ['src/__tests__/components/**', 'jsdom'],
    ],
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
