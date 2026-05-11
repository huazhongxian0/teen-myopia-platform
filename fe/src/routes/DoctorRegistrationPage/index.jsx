import { Badge, Button, Card, DatePicker, Divider, Form, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import LogoutEntry from '../../components/LogoutEntry.jsx'
import { useAccount } from '../../hooks/useAccount.js'
import { httpClient } from '../../services/http/index.js'
import './index.css'

const { Title, Text } = Typography

function toTodayStartMs() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

function parseYmdToStartMs(ymd) {
  if (!ymd) return null
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d.getTime()
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

function formatTime(ms) {
  if (!ms) return '-'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '-'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatVision(value) {
  if (value === undefined || value === null) return '-'
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return '-'
  if (n >= 10) return (n / 10).toFixed(1)
  return n.toFixed(1)
}

export default function DoctorRegistrationPage({ onLogout }) {
  const { account } = useAccount()
  const location = useLocation()
  const navigate = useNavigate()
  const [visitDate, setVisitDate] = useState(() => toTodayStartMs())

  const [loading, setLoading] = useState(false)
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [studentOptions, setStudentOptions] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()

  const [examOpen, setExamOpen] = useState(false)
  const [examForm] = Form.useForm()
  const [examTarget, setExamTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [doneMap, setDoneMap] = useState(() => new Map())
  const odWatch = Form.useWatch('od', examForm)
  const osWatch = Form.useWatch('os', examForm)

  async function loadStudents() {
    try {
      const data = await httpClient.get('/api/users/accounts', { params: { roleId: 'student' } })
      const options = (Array.isArray(data) ? data : []).map((a) => ({
        label: `${a?.name ?? '-'}（编号 ${a?.id ?? '-'}）`,
        value: a?.id,
      }))
      setStudentOptions(options.filter((o) => o.value))
    } catch (e) {
      message.error(e?.message || '加载学生列表失败')
      setStudentOptions([])
    }
  }

  async function loadRegistrations({ pageNo: pNo = pageNo, pageSize: pSize = pageSize } = {}) {
    setLoading(true)
    try {
      const data = await httpClient.post('/api/visitRegistration/listMine', {
        visitDate,
        pageNo: pNo,
        pageSize: pSize,
      })
      setList(Array.isArray(data?.list) ? data.list : [])
      setTotal(Number(data?.total ?? 0))
    } catch (e) {
      message.error(e?.message || '加载今日挂号失败')
      setList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStudents()
  }, [])

  useEffect(() => {
    void loadRegistrations()
  }, [pageNo, pageSize, visitDate])

  const stateVisitDate = location?.state?.visitDate
  useEffect(() => {
    const ms = Number(stateVisitDate)
    if (!Number.isFinite(ms) || ms <= 0) return
    setPageNo(1)
    setVisitDate(ms)
  }, [stateVisitDate])

  async function handleCreate() {
    const values = await createForm.validateFields()
    const patientAccountId = values?.patientAccountId
    if (!patientAccountId) return
    try {
      await httpClient.post('/api/visitRegistration/create', { patientAccountId, visitDate })
      message.success('挂号成功')
      setCreateOpen(false)
      createForm.resetFields()
      setPageNo(1)
      void loadRegistrations({ pageNo: 1 })
    } catch (e) {
      message.error(e?.message || '挂号失败')
    }
  }

  function openExam(row) {
    setExamTarget(row)
    setExamOpen(true)
    examForm.setFieldsValue({ od: 5.0, os: 5.0 })
  }

  async function handleSubmitExam() {
    const values = await examForm.validateFields()
    const odRaw = Number(values?.od)
    const osRaw = Number(values?.os)
    if (!examTarget?.id || !examTarget?.patientAccountId) return

    setSubmitting(true)
    try {
      await httpClient.post('/api/visitHistory/create', {
        registrationId: examTarget.id,
        patientAccountId: examTarget.patientAccountId,
        visitDate,
        od: Math.round(odRaw * 10),
        os: Math.round(osRaw * 10),
      })
      message.success('已保存接诊记录')
      setExamOpen(false)
      setDoneMap((prev) => {
        const next = new Map(prev)
        next.set(examTarget.id, true)
        return next
      })
    } catch (e) {
      message.error(e?.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: '患者',
      dataIndex: 'patientName',
      key: 'patientName',
      render: (v, row) => (
        <Space size={8}>
          <span className="patientName">{v || '-'}</span>
          <Tag className="idTag">编号 {row?.patientAccountId ?? '-'}</Tag>
        </Space>
      ),
    },
    {
      title: '挂号时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (v) => <span className="timeText">{formatTime(v)}</span>,
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, row) =>
        doneMap.get(row?.id) ? (
          <Badge status="success" text="已录入" />
        ) : (
          <Badge status="processing" text="待接诊" />
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button
            type="primary"
            className="primaryBtn"
            disabled={!!doneMap.get(row?.id)}
            onClick={() => openExam(row)}
          >
            录入检查
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="regRoot">
      <div className="regBg" />
      <div className="regGlow regGlowA" />
      <div className="regGlow regGlowB" />

      <div className="regWrap">
        <div className="regTopbar">
          <div>
            <Title level={3} className="regTitle">
              今日接诊
            </Title>
            <Text className="regSubtitle">
              {account?.name ?? account?.accountName ?? '-'} · {formatDate(visitDate)}
            </Text>
          </div>
          <Space size={10}>
            <DatePicker
              placeholder="选择日期"
              onChange={(_, dateString) => {
                const ms = parseYmdToStartMs(dateString)
                setPageNo(1)
                setVisitDate(ms ?? toTodayStartMs())
              }}
            />
            <Button onClick={() => navigate('/home')}>返回</Button>
            <LogoutEntry onLogout={onLogout}>退出登录</LogoutEntry>
          </Space>
        </div>

        <Card className="regHero" bordered={false}>
          <div className="regHeroInner">
            <div className="regHeroLeft">
              <div className="regKicker">挂号池</div>
              <div className="regHeadline">
                <span className="regHeadlineStrong">{total}</span>
                <span className="regHeadlineUnit"> 位患者等待接诊</span>
              </div>
              <div className="regHint">挂号后点击“录入检查”，会生成该学生的档案记录，并同步更新学生端“最近视力”。</div>
            </div>
            <div className="regHeroRight">
              <Button type="primary" size="large" className="primaryBtn" onClick={() => setCreateOpen(true)}>
                新建挂号
              </Button>
            </div>
          </div>
        </Card>

        <Card className="regTableCard" bordered={false}>
          <div className="regTableTop">
            <Text className="regSectionTitle">今日挂号列表</Text>
            <Space size={8}>
              <Tag className="metaTag">左眼/右眼 以 0.1 为步长</Tag>
              <Tag className="metaTag">系统存储为 ×10 的整数</Tag>
            </Space>
          </div>
          <Divider className="softDivider" />
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={list}
            pagination={{
              current: pageNo,
              pageSize,
              total,
              showSizeChanger: true,
              onChange: (p, ps) => {
                setPageNo(p)
                setPageSize(ps)
              },
            }}
          />
        </Card>
      </div>

      <Modal
        title="新建挂号"
        open={createOpen}
        okText="确认挂号"
        cancelText="取消"
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okButtonProps={{ className: 'primaryBtn' }}
      >
        <Form layout="vertical" form={createForm}>
          <Form.Item label="选择患者" name="patientAccountId" rules={[{ required: true, message: '请选择患者' }]}>
            <Select
              showSearch
              placeholder="输入姓名或编号搜索"
              options={studentOptions}
              filterOption={(input, option) => String(option?.label ?? '').includes(input)}
            />
          </Form.Item>
          <div className="mutedLine">
            <Text type="secondary">接诊日期：{formatDate(visitDate)}</Text>
          </div>
        </Form>
      </Modal>

      <Modal
        title={examTarget ? `录入检查：${examTarget?.patientName ?? '-'}（编号 ${examTarget?.patientAccountId ?? '-'}）` : '录入检查'}
        open={examOpen}
        okText="保存"
        cancelText="取消"
        onCancel={() => setExamOpen(false)}
        onOk={handleSubmitExam}
        confirmLoading={submitting}
        rootClassName="examModalRoot"
        okButtonProps={{ className: 'primaryBtn' }}
      >
        <div className="examModalBody">
          <div className="examModalIntro">
            <div className="examModalEyebrow">检查录入</div>
            <div className="examModalHint">录入后将生成该学生的诊断记录，并同步更新当前视力档案。</div>
          </div>
          <Form layout="vertical" form={examForm} className="examModalForm">
            <Form.Item
              label="左眼视力"
              name="od"
              rules={[
                { required: true, message: '请输入左眼视力' },
                {
                  validator: (_, v) => {
                    const n = Number(v)
                    if (!Number.isFinite(n) || n < 0 || n > 10) return Promise.reject(new Error('请输入 0.0 ~ 10.0 之间的数值'))
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} placeholder="例如 5.0" />
            </Form.Item>
            <Form.Item
              label="右眼视力"
              name="os"
              rules={[
                { required: true, message: '请输入右眼视力' },
                {
                  validator: (_, v) => {
                    const n = Number(v)
                    if (!Number.isFinite(n) || n < 0 || n > 10) return Promise.reject(new Error('请输入 0.0 ~ 10.0 之间的数值'))
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} placeholder="例如 5.0" />
            </Form.Item>

            <Card className="previewCard examPreviewCard" bordered={false}>
              <div className="previewRow">
                <div className="previewKey">视力预览</div>
                <div className="previewVal">
                  <span className="previewVision">{formatVision(Math.round(Number(odWatch ?? 0) * 10))}</span>
                  <span className="previewSep">/</span>
                  <span className="previewVision">{formatVision(Math.round(Number(osWatch ?? 0) * 10))}</span>
                </div>
              </div>
            </Card>
          </Form>
        </div>
      </Modal>
    </div>
  )
}
