import { Layout, Tabs, Typography } from 'antd'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMount } from 'ahooks'
import LogoutEntry from '../../components/LogoutEntry.jsx'
import '../AllBackUp/index.css'

const { Header, Content } = Layout
const { Text } = Typography

function getActiveKey(pathname) {
  if (pathname.includes('/allback/users')) return 'users'
  if (pathname.includes('/allback/roles')) return 'roles'
  if (pathname.includes('/allback/schools')) return 'schools'
  return 'auth'
}

/**
 * 后台管理页面
 * @param {Object} props - 组件属性
 * @param {Object} props.account - 用户账号信息
 * @param {Function} props.onLogout - 退出登录回调函数
 */
export default function AllBackUp({ account, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const activeKey = getActiveKey(location.pathname)

  useMount(() => {
    void import('./UserManager.jsx')
    void import('./RoleManager.jsx')
    void import('./SchoolManager.jsx')
    void import('./ClassManager.jsx')
  })

  return (
    <Layout className="backup-layout">
      <div className="backup-decoration backup-decoration-1" />
      <div className="backup-decoration backup-decoration-2" />
      
      <Header className="backup-header">
        <div className="header-left">
          <Link to="/" className="backup-logo">
            区域性青少年近视防控系统 - 后台管理
          </Link>
          <Text className="header-info">
            {account?.name ?? account?.accountName ?? '-'} / {account?.roleId ?? '-'}
          </Text>
        </div>
        <div className="header-right">
          <LogoutEntry as="a" onLogout={onLogout} className="logout-btn">
            退出登录
          </LogoutEntry>
        </div>
      </Header>

      <Content className="backup-content">
        <div className="content-wrapper">
          <Tabs
            className="backup-tabs"
            activeKey={activeKey}
            onChange={(key) => {
              if (key === 'users') {
                navigate('/allback/users')
              } else if (key === 'roles') {
                navigate('/allback/roles')
              } else if (key === 'schools') {
                navigate('/allback/schools')
              } else {
                navigate('/allback/auth')
              }
            }}
            items={[
              { key: 'auth', label: '权限管理' },
              { key: 'users', label: '账号管理' },
              { key: 'roles', label: '角色管理' },
              { key: 'schools', label: '学校管理' },
            ]}
          />
          <div className="backup-outlet">
            <Outlet />
          </div>
        </div>
      </Content>
    </Layout>
  )
}
