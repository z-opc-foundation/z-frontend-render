import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// playground: 独立跑起来验证渲染引擎, 不依赖 z-report / z-lc 后端
export default defineConfig({
  plugins: [react()],
  root: 'playground',
  server: { port: 5399 },
})
