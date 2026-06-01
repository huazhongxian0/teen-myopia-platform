import { Card, Table, Tag, Space, Typography, Button, Badge, Tabs, message, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellOutlined, WarningOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useAccount } from '../../hooks/useAccount.js'
import { listMyWarnings, listMyMessages, readMessage } from '../../services/riskWarning.js'
import LogoutButton from '../../components/LogoutButton.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import StatSummaryCard from '../../components/StatSummaryCard.jsx'
import '../StudentPage/index.css'

const { Title, Text } = Typography

const levelMap = {
  高度预警: { color: 'red', icon: <WarningOutlined /> },
  中度预警: { color: 'orange', icon: <WarningOutlined /> },
  轻度预警: { color: 'gold', icon: <BellOutlined /> },
  正常关注: { color: 'green', icon: <CheckCircleOutlined /> },
}

const statusMap = {
  未处置: { color: 'red' },
  已处置: { color: 'green' },
}

export default function RiskWarningStudentPage({ onLogout }) {
  const { account } = useAccount()
  const displayName = account?.name ?? account?.accountName ?? '-'
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('warnings')

  const [warningsLoading, setWarningsLoading] = useState(false)
  const [warningsList, setWarningsList] = useState([])
  const [warningsTotal, setWarningsTotal] = useState(0)
  const [warningsPage, setWarningsPage] = useState(1)
  const [warningsPageSize, setWarningsPageSize] = useState(10)

  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesList, setMessagesList] = useState([])
  const [messagesTotal, setMessagesTotal] = useState(0)
  const [messagesPage, setMessagesPage] = useState(1)
  const [messagesPageSize, setMessagesPageSize] = useState(10)

  async function loadWarnings({ pageNo = warningsPage, pageSize = warningsPageSize } = {}) {
    setWarningsLoading(true)
    try {
      const data = await listMyWarnings({ pageNo, pageSize })
      setWarningsList(Array.isArray(data?.list) ? data.list : [])
      setWarningsTotal(Number(data?.total ?? 0))
    } catch (e) {
      message.error(e?.message || '加载预警列表失败')
      setWarningsList([])
      setWarningsTotal(0)
    } finally {
      setWarningsLoading(false)
    }
  }

  async function loadMessages({ pageNo = messagesPage, pageSize = messagesPageSize } = {}) {
    setMessagesLoading(true)
    try {
      const data = await listMyMessages({ pageNo, pageSize })
      setMessagesList(Array.isArray(data?.list) ? data.list : [])
      setMessagesTotal(Number(data?.total ?? 0))
    } catch (e) {
      message.error(e?.message || '加载消息列表失败')
      setMessagesList([])
      setMessagesTotal(0)
    } finally {
      setMessagesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'warnings') {
      void loadWarnings()
    } else {
      void loadMessages()
    }
  }, [activeTab, warningsPage, warningsPageSize, messagesPage, messagesPageSize])

  async function handleReadMessage(messageId) {
    try {
      await readMessage(messageId)
      message.success('标记已读成功')
      void loadMessages({ pageNo: messagesPage })
    } catch (e) {
      message.error(e?.message || '标记已读失败')
    }
  }

  function formatDate(ms) {
    if (!ms) return '-'
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return '-'
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const unreadCount = messagesList.filter((m) => !m.readStatus).length

  const warningColumns = [
    { title: '风险等级', dataIndex: 'level', width: 120, render: (v) => {
      const cfg = levelMap[v] || { color: 'default', icon: null }
      return <Tag color={cfg.color} icon={cfg.icon}>{v || '-'}</Tag>
    }},
    { title: '触发类型', dataIndex: 'triggerType', width: 120, render: (v) => v || '-' },
    { title: '触发原因', dataIndex: 'triggerReason', render: (v) => v || '-', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 100, render: (v) => {
      const cfg = statusMap[v] || { color: 'default' }
      return <Tag color={cfg.color}>{v || '-'}</Tag>
    }},
    { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (v) => formatDate(v) },
    { title: '处置时间', dataIndex: 'resolvedAt', width: 140, render: (v) => formatDate(v) },
    { title: '处置说明', dataIndex: 'resolutionNote', render: (v) => v || '-', ellipsis: true },
  ]

  const messageColumns = [
    { title: '预警编号', dataIndex: 'warningId', width: 100, render: (v) => v || '-' },
    { title: '接收角色', dataIndex: 'receiverRole', width: 100, render: (v) => v || '-' },
    { title: '状态', dataIndex: 'readStatus', width: 100, render: (v) => (
      v ? <Tag color="green">已读</Tag> : <Tag color="red">未读</Tag>
    )},
    { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (v) => formatDate(v) },
    { title: '操作', key: 'action', width: 120, render: (_, record) => (
      !record.readStatus ? (
        <Button size="small" type="primary" onClick={() => handleReadMessage(record.id)}>
          标记已读
        </Button>
      ) : (
        <Text type="secondary">-</Text>
      )
    )},
  ]

  return (
    <div className="pageRoot">
      <div className="decoration decoration-1" />
      <div className="decoration decoration-2" />

      <Space direction="vertical" size={24} className="pageWrap">
        <PageHeader
          className="heroCard"
          avatar={<div className="avatar">🛡️</div>}
          title={`${displayName}的风险预警中心`}
          subtitle="查看您的视力风险预警与消息通知"
          actions={
            <Space>
              <Button onClick={() => navigate('/home')}>返回首页</Button>
              <LogoutButton onLogout={onLogout} />
            </Space>
          }
        />

        <div className="pageLayout">
          <div className="mainColumn">
            <Row gutter={[20, 20]}>
              <Col xs={24} md={8}>
                <StatSummaryCard
                  className="statCard statCard-orange"
                  bordered={false}
                  icon={<WarningOutlined className="statIcon" />}
                  label="我的预警"
                  value={<Title level={2} className="statValue">{warningsTotal}</Title>}
                  decoration={<WarningOutlined />}
                />
              </Col>
              <Col xs={24} md={8}>
                <StatSummaryCard
                  className="statCard statCard-blue"
                  bordered={false}
                  icon={<BellOutlined className="statIcon" />}
                  label="未读消息"
                  value={
                    <Title level={2} className="statValue">
                      <Badge count={unreadCount} showZero color="#ff4d4f" />
                    </Title>
                  }
                  decoration={<BellOutlined />}
                />
              </Col>
              <Col xs={24} md={8}>
                <StatSummaryCard
                  className="statCard statCard-green"
                  bordered={false}
                  icon={<CheckCircleOutlined className="statIcon" />}
                  label="已处置"
                  value={
                    <Title level={2} className="statValue">
                      {warningsList.filter((w) => w.status === '已处置').length}
                    </Title>
                  }
                  decoration={<CheckCircleOutlined />}
                />
              </Col>
            </Row>

            <Card
              className="sectionCard"
              title={<span className="sectionTitle">📋 预警与消息</span>}
              bordered={false}
            >
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  {
                    key: 'warnings',
                    label: '我的预警',
                    children: (
                      <Spin spinning={warningsLoading}>
                        <Table
                          rowKey="id"
                          columns={warningColumns}
                          dataSource={warningsList}
                          pagination={{
                            current: warningsPage,
                            pageSize: warningsPageSize,
                            total: warningsTotal,
                            showSizeChanger: true,
                            onChange: (p, ps) => {
                              setWarningsPage(p)
                              setWarningsPageSize(ps)
                            },
                          }}
                        />
                      </Spin>
                    ),
                  },
                  {
                    key: 'messages',
                    label: '我的消息',
                    children: (
                      <Spin spinning={messagesLoading}>
                        <Table
                          rowKey="id"
                          columns={messageColumns}
                          dataSource={messagesList}
                          pagination={{
                            current: messagesPage,
                            pageSize: messagesPageSize,
                            total: messagesTotal,
                            showSizeChanger: true,
                            onChange: (p, ps) => {
                              setMessagesPage(p)
                              setMessagesPageSize(ps)
                            },
                          }}
                        />
                      </Spin>
                    ),
                  },
                ]}
              />
            </Card>
          </div>

          <div className="sideColumn">
            <Card className="sideCard" bordered={false}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ fontSize: 16 }}>风险等级说明</Text>
                  <div style={{ marginTop: 12 }}>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div><Tag color="red">高度预警</Tag><Text type="secondary">平均度数 ≥500度，需立即干预</Text></div>
                      <div><Tag color="orange">中度预警</Tag><Text type="secondary">平均度数 ≥300度或趋势下降明显</Text></div>
                      <div><Tag color="gold">轻度预警</Tag><Text type="secondary">平均度数 ≥150度或复查超期</Text></div>
                      <div><Tag color="green">正常关注</Tag><Text type="secondary">未触发任何预警规则</Text></div>
                    </Space>
                  </div>
                </div>
                <div>
                  <Text strong style={{ fontSize: 16 }}>护眼建议</Text>
                  <div style={{ marginTop: 12, color: 'rgba(81,96,122,0.9)', lineHeight: 1.8 }}>
                    定期复查视力，保持良好用眼习惯。若收到预警消息，请及时预约医生进行专业检查。
                  </div>
                </div>
              </Space>
            </Card>
          </div>
        </div>
      </Space>
    </div>
  )
}
