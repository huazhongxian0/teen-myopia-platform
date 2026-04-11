import { Button, Card, DatePicker, Divider, Modal, Space, Table, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoutEntry from '../../components/LogoutEntry.jsx'
import { useAccount } from '../../hooks/useAccount.js'
import { httpClient } from '../../services/http/index.js'
import './index.css'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function formatDate(ms) {
  if (!ms) return '-'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateTime(ms) {
  if (!ms) return '-'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function parseYmdToStartMs(ymd) {
  if (!ymd) return null
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export default function DoctorAppointmentAllPage({ onLogout }) {
  const { account } = useAccount()
  const navigate = useNavigate()

  const [range, setRange] = useState([null, null])
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [editingYmd, setEditingYmd] = useState('')

  const rangePayload = useMemo(() => {
    const startVisitDate = parseYmdToStartMs(range?.[0])
    const endVisitDate = parseYmdToStartMs(range?.[1])
    if (!startVisitDate || !endVisitDate) return { startVisitDate: null, endVisitDate: null }
    return { startVisitDate, endVisitDate }
  }, [range])

  async function loadData({ pageNo: pNo = pageNo, pageSize: pSize = pageSize } = {}) {
    setLoading(true)
    try {
      const data = await httpClient.post('/api/visitRegistration/listMineRange', {
        ...rangePayload,
        pageNo: pNo,
        pageSize: pSize,
      })
      setList(Array.isArray(data?.list) ? data.list : [])
      setTotal(Number(data?.total ?? 0))
    } catch (e) {
      message.error(e?.message || '加载预约失败')
      setList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [pageNo, pageSize, rangePayload.startVisitDate, rangePayload.endVisitDate])

  function openEdit(row) {
    setEditingRow(row || null)
    setEditingYmd(formatDate(row?.visitDate))
    setEditOpen(true)
  }

  async function submitEdit() {
    const id = editingRow?.id
    const newVisitDate = parseYmdToStartMs(editingYmd)
    if (!id) return
    if (!newVisitDate) {
      message.error('请选择新的预约日期')
      return
    }
    setEditLoading(true)
    try {
      await httpClient.post('/api/visitRegistration/updateVisitDate', { id, newVisitDate })
      message.success('已更新预约日期')
      setEditOpen(false)
      setEditingRow(null)
      void loadData()
    } catch (e) {
      const status = e?.status ?? 0
      if (status === 409) {
        message.error('该学生在该日期已存在预约，无法调整')
      } else if (status === 404) {
        message.error('预约记录不存在')
      } else {
        message.error(e?.message || '更新失败')
      }
    } finally {
      setEditLoading(false)
    }
  }

  const columns = [
    {
      title: '学生',
      dataIndex: 'patientName',
      key: 'patientName',
      render: (v, row) => (
        <Space size={8}>
          <span className="allPatientName">{v || '-'}</span>
          <Tag className="allIdTag">编号 {row?.patientAccountId ?? '-'}</Tag>
        </Space>
      ),
    },
    {
      title: '预约日期',
      dataIndex: 'visitDate',
      key: 'visitDate',
      width: 140,
      render: (v) => <span className="allTimeText">{formatDate(v)}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v) => <span className="allTimeText">{formatDateTime(v)}</span>,
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: () => <Tag className="allMetaTag">已预约</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, row) => (
        <Space size={10}>
          <Button onClick={() => openEdit(row)}>修改日期</Button>
          <Button
            type="primary"
            className="primaryBtn"
            onClick={() => {
              navigate('/doctor/registration', { state: { visitDate: row?.visitDate } })
            }}
          >
            去接诊
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="allRoot">
      <div className="allBg" />
      <div className="allGlow allGlowA" />
      <div className="allGlow allGlowB" />

      <div className="allWrap">
        <div className="allTopbar">
          <div>
            <Title level={3} className="allTitle">
              预约总览
            </Title>
            <Text className="allSubtitle">
              {account?.name ?? account?.accountName ?? '-'} · 查看所有时间范围内的预约
            </Text>
          </div>
          <Space size={10} wrap>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              onChange={(_, dateStrings) => {
                const s0 = Array.isArray(dateStrings) ? dateStrings[0] : null
                const s1 = Array.isArray(dateStrings) ? dateStrings[1] : null
                setPageNo(1)
                setRange([s0 || null, s1 || null])
              }}
            />
            <Button onClick={() => navigate('/home')}>返回</Button>
            <LogoutEntry onLogout={onLogout}>退出登录</LogoutEntry>
          </Space>
        </div>

        <Card className="allHero" bordered={false}>
          <div className="allHeroInner">
            <div className="allHeroLeft">
              <div className="allKicker">预约池 · 全部</div>
              <div className="allHeadline">
                <span className="allHeadlineStrong">{total}</span>
                <span className="allHeadlineUnit"> 条预约记录</span>
              </div>
              <div className="allHint">可通过日期范围筛选；点击“去接诊”会跳转到对应日期的接诊页面。</div>
            </div>
            <div className="allHeroRight">
              <Button
                type="primary"
                className="primaryBtn"
                onClick={() => {
                  setRange([null, null])
                  setPageNo(1)
                }}
              >
                清空筛选
              </Button>
            </div>
          </div>
        </Card>

        <Card className="allTableCard" bordered={false}>
          <div className="allTableTop">
            <Text className="allSectionTitle">预约列表</Text>
            <Space size={8} wrap>
              {rangePayload.startVisitDate && rangePayload.endVisitDate ? (
                <Tag className="allMetaTag">
                  范围：{formatDate(rangePayload.startVisitDate)} ～ {formatDate(rangePayload.endVisitDate)}
                </Tag>
              ) : (
                <Tag className="allMetaTag">范围：全部</Tag>
              )}
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
        title="修改预约日期"
        open={editOpen}
        className="allEditModal"
        onCancel={() => {
          if (editLoading) return
          setEditOpen(false)
          setEditingRow(null)
        }}
        onOk={submitEdit}
        confirmLoading={editLoading}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div className="allEditHint">
            <div className="allEditKey">当前学生</div>
            <div className="allEditVal">{editingRow?.patientName ?? '-'}</div>
          </div>
          <div className="allEditHint">
            <div className="allEditKey">当前日期</div>
            <div className="allEditVal">{formatDate(editingRow?.visitDate)}</div>
          </div>
          <div className="allEditPickRow">
            <div className="allEditKey">新的日期</div>
            <DatePicker
              style={{ width: '100%' }}
              placeholder="选择新的预约日期"
              onChange={(_, dateString) => {
                setEditingYmd(dateString || '')
              }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}
