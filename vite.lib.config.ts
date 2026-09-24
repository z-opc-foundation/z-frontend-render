import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// react / antd / echarts / dnd-kit / dayjs / icons 由消费方提供 (peerDependencies), 产物里只留渲染引擎本体
const PEERS = [
  'react',
  'react-dom',
  'antd',
  'echarts',
  'dayjs',
  '@ant-design/icons',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
]

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
      // 两个入口 = 两个消费面: root 是报表渲染半边, ./fields 是低代码字段注册表半边。
      // 分成入口而不是共用一个 barrel, 既避开两套契约里 FieldType 的同名冲突,
      // 也让 z-report 不必为字段层装上 dayjs / @ant-design/icons。
      entry: { index: 'src/index.ts', fields: 'src/fields/index.ts' },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: { external: isPeer },
  },
})
