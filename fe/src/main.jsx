import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#5b3df5',
          colorInfo: '#2f6bff',
          colorSuccess: '#00b894',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorLink: '#2f6bff',
          colorLinkHover: '#1f57ff',
          borderRadius: 14,
          borderRadiusLG: 20,
          fontFamily:
            '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Helvetica, Arial, sans-serif',
          boxShadow:
            '0 10px 30px rgba(91, 61, 245, 0.14), 0 4px 10px rgba(15, 23, 42, 0.08)',
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>,
)
