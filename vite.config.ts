import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './', // 使用相对路径，确保部署在 GitHub Pages 子路径时不白屏
  plugins: [react()],
});
