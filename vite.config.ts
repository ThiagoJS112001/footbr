import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { proxy: { '/api': { target: `http://127.0.0.1:${process.env.FOOTBR_PORT ?? loadEnv(mode, process.cwd(), 'FOOTBR_').FOOTBR_PORT ?? 3001}`, changeOrigin: false } } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
}));
