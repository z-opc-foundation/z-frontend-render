import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// react / antd / echarts / dnd-kit 由消费方提供 (peerDependencies), 产物里只留渲染引擎本体
const PEERS = ['react', 'react-dom', 'antd', 'echarts', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']

function isPeer(id: string): boolean {
  if (id.startsWith('react/')) return true // react/jsx-runtime 等子路径同样外部化
  return PEERS.some((p) => id === p || id.startsWith(`${p}/`))
}

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // dist 里还有 tsc 产出的 .d.ts, 不能整体清空
    sourcemap: true,
    target: 'es2020',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: { external: isPeer },
  },
})
