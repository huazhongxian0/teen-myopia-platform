import { Card, Space, Typography } from 'antd'

const { Title, Text } = Typography

/**
 * 指标卡片组件
 * @param {Object} props - 组件属性
 * @param {string} props.title - 指标标题
 * @param {string} props.value - 指标值
 * @param {string} props.description - 指标描述
 * @param {string} props.from - 渐变起始颜色
 * @param {string} props.to - 渐变结束颜色
 * @param {string} props.sparkW - 火花条宽度
 * @param {string} props.sparkFrom - 火花条渐变起始颜色
 * @param {string} props.sparkTo - 火花条渐变结束颜色
 */
export default function MetricCard({ title, value, description, from, to, sparkW, sparkFrom, sparkTo }) {
  return (
    <Card
      size="small"
      bordered={false}
      className="softCard lift metricCard section delay2"
      style={{
        '--metricFrom': from,
        '--metricTo': to,
        '--sparkW': sparkW,
        '--sparkFrom': sparkFrom,
        '--sparkTo': sparkTo,
      }}
      bodyStyle={{ padding: 0 }}
    >
      <div className="metricCardBody">
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Text type="secondary" className="metricTitle metricTitleText">
            {title}
          </Text>
          <Title level={2} className="metricValue metricValueText" style={{ margin: 0, color: from.includes('24,144,255') ? '#1677ff' : from.includes('82,196,26') ? '#52c41a' : '#fa8c16' }}>
            {value}
          </Title>
          <div className="spark" style={{ margin: '8px 0' }}>
            <i />
          </div>
          <Text type="secondary" className="metricDescription">{description}</Text>
        </Space>
      </div>
    </Card>
  )
}