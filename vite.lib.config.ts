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
  'zustand',
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
      // 三个入口 = 三个消费面: root 报表渲染半边, ./fields 字段注册表半边,
      // ./tree 组件树渲染半边 (统一 Schema 的 elements + layout 树递归)。
      // 分成入口而不是共用一个 barrel, 既避开多套契约里 FieldType 的同名冲突,
      // 也让各消费方只装各自需要的 peer。
      entry: {
        index: 'src/index.ts',
        fields: 'src/fields/index.ts',
        tree: 'src/tree/index.ts',
        designer: 'src/designer/index.ts',
        // 物料库单独出包：运行态页面只需要物料，不该为此背上整个设计器
        materials: 'src/designer/materials/index.tsx',
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
      // 设计器样式单独出文件，消费方用 `@yuku123/z-frontend-render/designer.css` 引入
      cssFileName: 'designer',
    },
    rollupOptions: { external: isPeer },
  },
})
