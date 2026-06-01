import { Card, Table, Tag, Space, Typography, Button, message, Spin, Input, Modal, Row, Col } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WarningOutlined, MedicineBoxOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useAccount } from '../../hooks/useAccount.js'
import { listMyMessages, resolveWarning } from '../../services/riskWarning.js'
import LogoutButton from '../../components/LogoutButton.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import StatSummaryCard from '../../components/StatSummaryCard.jsx'
import '../StudentPage/index.css'

const { Title, Text } = Typography

const levelMap = {
  高度预警: { color: 'red' },
  中度预警: { color: 'orange' },
  轻度预警: { color: 'gold' },
  正常关注: { color: 'green' },
}

const statusMap = {
  未处置: { color: 'red' },
  已处置: { color: 'green' },
}

export default function RiskWarningDoctorPage({ onLogout }) {
  const { account } = useAccount()
  const displayName = account?.name ?? account?.accountName ?? '-'
  const navigate = useNavigate()

  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesList, setMessagesList] = useState([])
  const [messagesTotal, setMessagesTotal] = useState(0)
  const [messagesPage, setMessagesPage] = useState(1)
  const [messagesPageSize, setMessagesPageSize] = useState(10)

  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [resolveNote, setResolveNote] = useState('')
  const [resolveLoading, setResolveLoading] = useState(false)

  async function loadMessages({ pageNo = messagesPage, pageSize = messagesPageSize } = {}) {
    setMessagesLoading(true)
    try {
      const data = await listMyMessages({ pageNo, pageSize })
      setMessagesList(Array.isArray(data?.list) ? data.list : [])
      setMessagesTotal(Number(data?.total ?? 0))
    } catch (e) {
      message.error(e?.message || '加载消息失败')
      setMessagesList([])
      setMessagesTotal(0)
    } finally {
      setMessagesLoading(false)
    }
  }

  useEffect(() => {
    void loadMessages()
  }, [messagesPage, messagesPageSize])

  function openResolve(record) {
    setResolveTarget(record)
    setResolveNote('')
    setResolveModalOpen(true)
  }

  async function handleResolve() {
    if (!resolveTarget) return
    if (!resolveNote.trim()) {
      message.error('请输入处置说明')
      return
    }
    setResolveLoading(true)
    try {
      await resolveWarning(resolveTarget.warningId, resolveNote.trim())
      message.success('处置成功')
      setResolveModalOpen(false)
      void loadMessages({ pageNo: messagesPage })
    } catch (e) {
      message.error(e?.message || '处置失败')
    } finally {
      setResolveLoading(false)
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

  const summary = useMemo(() => {
    const total = messagesList.length
    const unread = messagesList.filter((m) => !m.readStatus).length
    return { total, unread }
  }, [messagesList])

  const columns = [
    { title: '预警编号', dataIndex: 'warningId', width: 100, render: (v) => v || '-' },
    { title: '风险等级', dataIndex: 'warningLevel', width: 120, render: (v) => {
      const cfg = levelMap[v] || { color: 'default' }
      return <Tag color={cfg.color}>{v || '-'}</Tag>
    }},
    { title: '触发类型', dataIndex: 'triggerType', width: 120, render: (v) => v || '-' },
    { title: '触发原因', dataIndex: 'triggerReason', render: (v) => v || '-', ellipsis: true },
    { title: '状态', dataIndex: 'warningStatus', width: 100, render: (v) => {
      const cfg = statusMap[v] || { color: 'default' }
      return <Tag color={cfg.color}>{v || '-'}</Tag>
    }},
    { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (v) => formatDate(v) },
    { title: '操作', key: 'action', width: 120, render: (_, record) => (
      record.warningStatus === '未处置' ? (
        <Button size="small" type="primary" onClick={() => openResolve(record)}>
          处置
        </Button>
      ) : (
        <Text type="secondary">已处置</Text>
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
          avatar={<div className="avatar">👨‍⚕️</div>}
          title={`${displayName}的待干预预警`}
          subtitle="查看和处理需要医生干预的视力风险预警"
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
                  icon={<ExclamationCircleOutlined className="statIcon" />}
                  label="待处理消息"
                  value={<Title level={2} className="statValue">{summary.unread}</Title>}
                  decoration={<ExclamationCircleOutlined />}
                />
              </Col>
              <Col xs={24} md={8}>
                <StatSummaryCard
                  className="statCard statCard-blue"
                  bordered={false}
                  icon={<MedicineBoxOutlined className="statIcon" />}
                  label="消息总数"
                  value={<Title level={2} className="statValue">{summary.total}</Title>}
                  decoration={<MedicineBoxOutlined />}
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
                      {messagesList.filter((m) => m.warningStatus === '已处置').length}
                    </Title>
                  }
                  decoration={<CheckCircleOutlined />}
                />
              </Col>
            </Row>

            <Card
              className="sectionCard"
              title={<span className="sectionTitle">📋 预警处置列表</span>}
              bordered={false}
              extra={
                <Button onClick={() => loadMessages({ pageNo: messagesPage })} loading={messagesLoading}>
                  刷新
                </Button>
              }
            >
              <Spin spinning={messagesLoading}>
                <Table
                  rowKey="id"
                  columns={columns}
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
            </Card>
          </div>

          <div className="sideColumn">
            <Card className="sideCard" bordered={false}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ fontSize: 16 }}>医生处置指南</Text>
                  <div style={{ marginTop: 12, color: 'rgba(81,96,122,0.9)', lineHeight: 1.8 }}>
                    <p>1. 查看收到的预警消息，了解学生的视力风险情况。</p>
                    <p>2. 对于未处置的预警，点击"处置"按钮填写干预措施。</p>
                    <p>3. 建议安排学生进行复查，并在处置说明中记录诊疗建议。</p>
                    <p>4. 高度预警学生应优先安排专业检查。</p>
                  </div>
                </div>
                <div>
                  <Text strong style={{ fontSize: 16 }}>干预建议</Text>
                  <div style={{ marginTop: 12, color: 'rgba(81,96,122,0.9)', lineHeight: 1.8 }}>
                    根据预警等级采取不同干预策略：轻度预警建议改善用眼习惯；中度预警需安排复查并考虑配镜；高度预警需立即进行专业眼科检查。
                  </div>
                </div>
              </Space>
            </Card>
          </div>
        </div>
      </Space>

      <Modal
        title="处置预警"
        open={resolveModalOpen}
        onOk={handleResolve}
        onCancel={() => setResolveModalOpen(false)}
        confirmLoading={resolveLoading}
        okText="确认处置"
        cancelText="取消"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text strong>预警编号：</Text>
            <Text>{resolveTarget?.warningId || '-'}</Text>
          </div>
          <div>
            <Text strong>风险等级：</Text>
            <Tag color={(levelMap[resolveTarget?.warningLevel]?.color) || 'default'}>
              {resolveTarget?.warningLevel || '-'}
            </Tag>
          </div>
          <div>
            <Text strong>处置说明：</Text>
          </div>
          <Input.TextArea
            rows={4}
            placeholder="请输入诊疗建议或干预措施"
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  )
}
