import { Card, Col, Row, Space, Typography, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import LogoutEntry from './LogoutEntry.jsx'

const { Title, Text } = Typography

/**
 * 首页顶部英雄卡片组件
 * @param {Object} props - 组件属性
 * @param {boolean} props.canManage - 是否拥有管理权限
 * @param {string} props.displayName - 显示的用户名
 * @param {string} props.roleId - 角色ID
 * @param {Function} props.onLogout - 退出登录回调函数
 */
export default function HeroCard({ canManage, displayName, roleId, onLogout }) {
  const navigate = useNavigate()

  return (
    <Card
      bordered={false}
      className="heroCard softCard section delay1"
      bodyStyle={{ padding: 0 }}
    >
      <div className="heroCardBody">
        <div className="heroGlowA" />
        <div className="heroGlowB" />
        <div className="heroGrid" />

        <Row gutter={[24, 24]} align="center">
          <Col xs={24} md={16}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div className="pill">
                <span className="pillDot" />
                <Text style={{ fontSize: 13, color: 'rgba(15, 23, 42, 0.78)' }}>区域近视防控 · 校园健康数据中枢</Text>
                <span className="badge">{canManage ? '已启用管理权限' : '普通账号'}</span>
              </div>

              <div>
                <Title level={2} style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 600 }}>
                  区域性近视防控平台
                </Title>
                <Text type="secondary" style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
                  当前用户：{displayName}（{roleId}）
                </Text>
              </div>

              <Text style={{ maxWidth: 720, color: 'rgba(15, 23, 42, 0.72)', lineHeight: '1.6' }}>
                将筛查、复查与风险预警集中到一个工作台，支持校园—区域多层级协同，让防控工作“可追踪、可量化、可闭环”。
              </Text>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ marginTop: { xs: 16, md: 0 } }}>
            <Card
              bordered={false}
              className="softCard lift"
              bodyStyle={{ padding: 0 }}
            >
              <div className="actionCardBody">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div className="actionCardTitle">
                    <Text strong className="actionCardTitleText">常用操作</Text>
                    <Text type="secondary" className="actionCardSubtitle">
                      快捷导航
                    </Text>
                  </div>
                  <Space wrap style={{ gap: '12px' }}>
                    {canManage ? (
                      <Button size="middle" type="primary" className="primaryGlow" onClick={() => navigate('/allback/auth')}>
                        进入管理平台
                      </Button>
                    ) : (
                      <Button size="middle" disabled>进入管理平台</Button>
                    )}
                  </Space>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: '8px', flexWrap: 'wrap' }}>
                 
                    <LogoutEntry size="middle" type="primary" onLogout={onLogout}>
                      退出登录
                    </LogoutEntry>
                  </div>
                </Space>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </Card>
  )
}
