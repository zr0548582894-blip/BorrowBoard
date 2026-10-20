import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ quiet: true });

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error('יש להגדיר TEST_DATABASE_URL בקובץ .env (מסד נתונים נפרד לבדיקות - הוא נמחק בכל הרצה!)');
}

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
      JWT_SECRET: 'test-secret-that-is-long-enough-0123456789',
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
});
