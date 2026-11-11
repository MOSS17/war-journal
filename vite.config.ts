import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The Vercel Supabase integration names its public variables NEXT_PUBLIC_*.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
