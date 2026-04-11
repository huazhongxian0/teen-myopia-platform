import { Card, Col, Row, Space, Typography, Button, } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography

/**
 * 快捷入口区域组件
 * @param {Object} props - 组件属性
 * @param {boolean} props.canManage - 是否拥有管理权限
 */
export default function ShortcutSection({ canManage }) {
  const navigate = useNavigate()

  return (
    <Card
      bordered={false}
      title="快捷入口"
      className="softCard lift section delay3"
      bodyStyle={{ padding: 0 }}
      titleStyle={{ fontSize: '18px', fontWeight: 600 }}
    >
      <div className="eyeCareCardBody">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">根据你的权限展示可用功能入口。</Text>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card bordered={false} className="softCard lift" bodyStyle={{ padding: 0 }}>
                <div className="shortcutCardBody">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Text strong className="shortcutTitle">近视防控总览</Text>
                    <Text type="secondary" className="shortcutDescription">快速查看核心指标与风险分布（占位）。</Text>
                    <Button size="middle" onClick={() => navigate('/main')}>进入</Button>
                  </Space>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card bordered={false} className="softCard lift" bodyStyle={{ padding: 0 }}>
                <div className="shortcutCardBody">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Text strong className="shortcutTitle">管理平台</Text>
                    <Text type="secondary" className="shortcutDescription">角色、账号、权限点与后台配置。</Text>
                    <Space wrap style={{ gap: '12px' }}>
                      <Button size="middle" type="primary" className="primaryGlow" disabled={!canManage} onClick={() => navigate('/allback/auth')}>
                        进入
                      </Button>
                    </Space>
                  </Space>
                </div>
              </Card>
            </Col>
          </Row>
        </Space>
      </div>
    </Card>
  )
}