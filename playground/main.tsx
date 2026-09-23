import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import { Playground } from './Playground'

createRoot(document.getElementById('root') ?? document.body).render(<Playground />)
