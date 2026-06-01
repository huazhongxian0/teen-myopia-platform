import { Card, Table, Tag, Space, Typography, Button, message, Spin, Select, Row, Col } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WarningOutlined, TeamOutlined, BarChartOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useAccount } from '../../hooks/useAccount.js'
import { listClassWarnings, batchEvaluateRisk } from '../../services/riskWarning.js'
import { httpClient } from '../../services/http/index.js'
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

export default function RiskWarningTeacherPage({ onLogout }) {
  const { account } = useAccount()
  const displayName = account?.name ?? account?.accountName ?? '-'
  const navigate = useNavigate()

  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState(null)

  const [warningsLoading, setWarningsLoading] = useState(false)
  const [warningsList, setWarningsList] = useState([])
  const [warningsTotal, setWarningsTotal] = useState(0)
  const [warningsPage, setWarningsPage] = useState(1)
  const [warningsPageSize, setWarningsPageSize] = useState(10)

  const [batchLoading, setBatchLoading] = useState(false)

  async function fetchClasses() {
    const teacherAccountId = account?.accountId
    if (!teacherAccountId) return
    try {
      setClassesLoading(true)
      const data = await httpClient.post('/api/school/teacher/classes', { teacherAccountId })
      const list = data?.list || []
      setClasses(list)
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id)
      }
    } catch (e) {
      message.error(e?.message || '加载班级失败')
      setClasses([])
    } finally {
      setClassesLoading(false)
    }
  }

  async function loadWarnings({ pageNo = warningsPage, pageSize = warningsPageSize, classId = selectedClassId } = {}) {
    if (!classId) return
    setWarningsLoading(true)
    try {
      const data = await listClassWarnings({ classId, pageNo, pageSize })
      setWarningsList(Array.isArray(data?.list) ? data.list : [])
      setWarningsTotal(Number(data?.total ?? 0))
    } catch (e) {
      message.error(e?.message || '加载班级预警失败')
      setWarningsList([])
      setWarningsTotal(0)
    } finally {
      setWarningsLoading(false)
    }
  }

  useEffect(() => {
    void fetchClasses()
  }, [account?.accountId])

  useEffect(() => {
    if (selectedClassId) {
      setWarningsPage(1)
      void loadWarnings({ pageNo: 1, classId: selectedClassId })
    }
  }, [selectedClassId])

  async function handleBatchEvaluate() {
    if (!selectedClassId) {
      message.error('请先选择班级')
      return
    }
    setBatchLoading(true)
    try {
      await batchEvaluateRisk(selectedClassId)
      message.success('批量评估完成')
      void loadWarnings({ pageNo: 1, classId: selectedClassId })
    } catch (e) {
      message.error(e?.message || '批量评估失败')
    } finally {
      setBatchLoading(false)
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

  const classOptions = useMemo(() => {
    return classes.map((c) => ({ value: c.id, label: c.name || `班级${c.id}` }))
  }, [classes])

  const summary = useMemo(() => {
    const high = warningsList.filter((w) => w.level === '高度预警').length
    const medium = warningsList.filter((w) => w.level === '中度预警').length
    const low = warningsList.filter((w) => w.level === '轻度预警').length
    const unresolved = warningsList.filter((w) => w.status === '未处置').length
    return { high, medium, low, unresolved }
  }, [warningsList])

  const columns = [
    { title: '学生姓名', dataIndex: 'studentName', width: 120, render: (v) => v || '-' },
    { title: '风险等级', dataIndex: 'level', width: 120, render: (v) => {
      const cfg = levelMap[v] || { color: 'default' }
      return <Tag color={cfg.color}>{v || '-'}</Tag>
    }},
    { title: '触发类型', dataIndex: 'triggerType', width: 120, render: (v) => v || '-' },
    { title: '触发原因', dataIndex: 'triggerReason', render: (v) => v || '-', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 100, render: (v) => {
      const cfg = statusMap[v] || { color: 'default' }
      return <Tag color={cfg.color}>{v || '-'}</Tag>
    }},
    { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (v) => formatDate(v) },
  ]

  return (
    <div className="pageRoot">
      <div className="decoration decoration-1" />
      <div className="decoration decoration-2" />

      <Space direction="vertical" size={24} className="pageWrap">
        <PageHeader
          className="heroCard"
          avatar={<div className="avatar">👨‍🏫</div>}
          title={`${displayName}的班级风险预警`}
          subtitle="查看和管理您所负责班级的视力风险预警"
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
              <Col xs={24} md={6}>
                <StatSummaryCard
                  className="statCard statCard-orange"
                  bordered={false}
                  icon={<WarningOutlined className="statIcon" />}
                  label="高度预警"
                  value={<Title level={2} className="statValue">{summary.high}</Title>}
                  decoration={<WarningOutlined />}
                />
              </Col>
              <Col xs={24} md={6}>
                <StatSummaryCard
                  className="statCard statCard-blue"
                  bordered={false}
                  icon={<BarChartOutlined className="statIcon" />}
                  label="中度预警"
                  value={<Title level={2} className="statValue">{summary.medium}</Title>}
                  decoration={<BarChartOutlined />}
                />
              </Col>
              <Col xs={24} md={6}>
                <StatSummaryCard
                  className="statCard statCard-green"
                  bordered={false}
                  icon={<TeamOutlined className="statIcon" />}
                  label="轻度预警"
                  value={<Title level={2} className="statValue">{summary.low}</Title>}
                  decoration={<TeamOutlined />}
                />
              </Col>
              <Col xs={24} md={6}>
                <StatSummaryCard
                  className="statCard statCard-purple"
                  bordered={false}
                  icon={<CheckCircleOutlined className="statIcon" />}
                  label="待处置"
                  value={<Title level={2} className="statValue">{summary.unresolved}</Title>}
                  decoration={<CheckCircleOutlined />}
                />
              </Col>
            </Row>

            <Card
              className="sectionCard"
              title={<span className="sectionTitle">📋 班级预警列表</span>}
              bordered={false}
              extra={
                <Space>
                  <Select
                    style={{ width: 200 }}
                    placeholder="选择班级"
                    options={classOptions}
                    value={selectedClassId}
                    onChange={setSelectedClassId}
                    loading={classesLoading}
                    allowClear
                  />
                  <Button type="primary" loading={batchLoading} onClick={handleBatchEvaluate}>
                    批量评估
                  </Button>
                  <Button onClick={() => loadWarnings({ pageNo: warningsPage })} loading={warningsLoading}>
                    刷新
                  </Button>
                </Space>
              }
            >
              <Spin spinning={warningsLoading}>
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={warningsList}
                  pagination={{
                    current: warningsPage,
                    pageSize: warningsPageSize,
                    total: warningsTotal,
                    showSizeChanger: true,
                    onChange: (p, ps) => {
                      setWarningsPage(p)
                      setWarningsPageSize(ps)
                      void loadWarnings({ pageNo: p, pageSize: ps })
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
                  <Text strong style={{ fontSize: 16 }}>预警规则说明</Text>
                  <div style={{ marginTop: 12, color: 'rgba(81,96,122,0.9)', lineHeight: 1.8 }}>
                    <p><strong>阈值规则：</strong>平均度数≥500为高度预警，≥300为中度，≥150为轻度。</p>
                    <p><strong>趋势规则：</strong>近两次检测单眼度数下降≥0.2度触发中度预警。</p>
                    <p><strong>超期规则：</strong>超过180天未复查触发轻度预警。</p>
                  </div>
                </div>
                <div>
                  <Text strong style={{ fontSize: 16 }}>操作建议</Text>
                  <div style={{ marginTop: 12, color: 'rgba(81,96,122,0.9)', lineHeight: 1.8 }}>
                    定期使用"批量评估"功能对班级学生进行风险扫描，及时发现视力异常学生并通知家长复查。
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
