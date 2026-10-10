import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/database/drizzle-schema.ts',
  out: './drizzle',
  dbCredentials: { url: './data/car.sqlite' },
  strict: true,
  verbose: true,
});
