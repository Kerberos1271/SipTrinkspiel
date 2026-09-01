import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(Date.now().toString()),
  },
  build: {
    target: 'es2022',
  },
});
