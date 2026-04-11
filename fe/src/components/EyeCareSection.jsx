import { Card, Space, Typography } from 'antd'

const { Text } = Typography

/**
 * 护眼建议区域组件
 */
export default function EyeCareSection() {
  return (
    <Card
      bordered={false}
      title="护眼建议"
      className="softCard lift section delay3"
      bodyStyle={{ padding: 0 }}
      titleStyle={{ fontSize: '18px', fontWeight: 600 }}
    >
      <div className="eyeCareCardBody">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">以“预防为先、干预为要、随访为本”为原则。</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="pill" style={{ justifyContent: 'space-between' }}>
              <Text>20-20-20 用眼法则</Text>
              <Text type="secondary">提醒</Text>
            </div>
            <div className="pill" style={{ justifyContent: 'space-between' }}>
              <Text>户外活动 ≥ 2 小时</Text>
              <Text type="secondary">建议</Text>
            </div>
            <div className="pill" style={{ justifyContent: 'space-between' }}>
              <Text>定期复查与随访</Text>
              <Text type="secondary">追踪</Text>
            </div>
          </div>
        </Space>
      </div>
    </Card>
  )
}