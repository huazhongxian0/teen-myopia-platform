import { Button, Col, Row, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../../hooks/useAccount.js'
import LogoutButton from '../../components/LogoutButton.jsx'
import MetricCard from '../../components/MetricCard.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import ShortcutSection from '../../components/ShortcutSection.jsx'
import EyeCareSection from '../../components/EyeCareSection.jsx'
import './index.css'

/**
 * 管理员端页面
 * @param {Object} props - 组件属性
 * @param {Function} props.onLogout - 退出登录回调函数
 */
export default function ManagerPage({ onLogout }) {
  const { account, hasPermission } = useAccount()
  const navigate = useNavigate()

  const canManage = hasPermission('manager')
  const displayName = account?.name ?? account?.accountName ?? '-'
  const roleId = account?.roleId ?? '-'

  return (
    <div className="homeRoot">
      <Space direction="vertical" size={24} className="homeWrap">
        <PageHeader
          className="heroCard softCard section delay1"
          avatar={(
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                background: 'linear-gradient(135deg, rgba(91, 61, 245, 0.94), rgba(47, 107, 255, 0.94))',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
              }}
            >
              🛡️
            </div>
          )}
          title={`欢迎，${displayName}`}
          subtitle={`管理员端 · ${roleId}`}
          actions={(
            <>
              <Button
                size="middle"
                type="primary"
                disabled={!canManage}
                onClick={() => navigate('/allback/auth')}
              >
                进入管理平台
              </Button>
              <LogoutButton onLogout={onLogout} />
            </>
          )}
        />

        <Row gutter={[20, 20]}>
          <Col xs={24} md={8}>
            <MetricCard
              title="今日筛查"
              value="-"
              description="今日新增视力筛查记录"
              from="rgba(24,144,255,0.92)"
              to="rgba(41,209,152,0.92)"
              sparkW="56%"
              sparkFrom="rgba(24,144,255,0.92)"
              sparkTo="rgba(41,209,152,0.92)"
            />
          </Col>
          <Col xs={24} md={8}>
            <MetricCard
              title="本周复查"
              value="-"
              description="待复查学生人数"
              from="rgba(82,196,26,0.92)"
              to="rgba(250,173,20,0.92)"
              sparkW="44%"
              sparkFrom="rgba(82,196,26,0.92)"
              sparkTo="rgba(250,173,20,0.92)"
            />
          </Col>
          <Col xs={24} md={8}>
            <MetricCard
              title="风险提示"
              value="-"
              description="高风险近视人群预警"
              from="rgba(250,173,20,0.92)"
              to="rgba(250,140,22,0.92)"
              sparkW="28%"
              sparkFrom="rgba(250,173,20,0.92)"
              sparkTo="rgba(250,140,22,0.92)"
            />
          </Col>
        </Row>

        <Row gutter={[20, 20]}>
          <Col xs={24} md={16}>
            <ShortcutSection canManage={canManage} />
          </Col>
          <Col xs={24} md={8}>
            <EyeCareSection />
          </Col>
        </Row>
      </Space>
    </div>
  )
}
