import { Card, Space, Typography } from 'antd'
import LogoutEntry from '../components/LogoutEntry.jsx'
const { Title, Text } = Typography

export default function Main({ account, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', width: '100%', boxSizing: 'border-box', padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              平台首页
            </Title>
            <Text type="secondary">
              当前用户：{account?.name ?? account?.accountName ?? '-'}（{account?.roleId ?? '-'}）
            </Text>
          </div>
          <Space>
            <LogoutEntry onLogout={onLogout}>退出登录</LogoutEntry>
          </Space>
        </div>

        <Card title="入口" bordered>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Text>后台管理入口（仅管理员可见）</Text>
          </Space>
        </Card>
      </Space>
    </div>
  )
}
