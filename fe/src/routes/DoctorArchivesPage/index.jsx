import { Button, Card, Divider, Input, Space, Table, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoutEntry from '../../components/LogoutEntry.jsx'
import VisionArchiveTimeline from '../../components/VisionArchiveTimeline.jsx'
import { useAccount } from '../../hooks/useAccount.js'
import { httpClient } from '../../services/http/index.js'
import './index.css'

const { Title, Text } = Typography

function formatDate(ms) {
  if (!ms) return '-'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function roleText(roleId) {
  if (roleId === 'student') return '学生'
  if (roleId === 'teacher') return '老师'
  if (roleId === 'doctor') return '医生'
  if (roleId === 'admin') return '管理员'
  return roleId || '-'
}

export default function DoctorArchivesPage({ onLogout }) {
  const { account } = useAccount()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [activePatientId, setActivePatientId] = useState(null)
  const [activePatientName, setActivePatientName] = useState('')
  const [patientNameKeyword, setPatientNameKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')

  async function loadPatients({ pageNo: pNo = pageNo, pageSize: pSize = pageSize } = {}) {
    setLoading(true)
    try {
      const data = await httpClient.post('/api/visitHistory/listMyPatients', {
        patientNameKeyword: debouncedKeyword || null,
        pageNo: pNo,
        pageSize: pSize,
      })
      const list = Array.isArray(data?.list) ? data.list : []
      setPatients(list)
      setTotal(Number(data?.total ?? 0))
      if (!activePatientId && list.length > 0) {
        setActivePatientId(list[0]?.patientAccountId ?? null)
        setActivePatientName(list[0]?.patientName ?? '')
      }
    } catch (e) {
      message.error(e?.message || '加载病人列表失败')
      setPatients([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPatients()
  }, [pageNo, pageSize, debouncedKeyword])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedKeyword(patientNameKeyword.trim())
      setPageNo(1)
    }, 300)
    return () => window.clearTimeout(t)
  }, [patientNameKeyword])

  const columns = useMemo(() => {
    return [
      {
        title: '姓名',
        dataIndex: 'patientName',
        key: 'patientName',
        render: (v) => <span className="dapName">{v || '-'}</span>,
      },
      {
        title: '身份',
        dataIndex: 'patientRoleId',
        key: 'patientRoleId',
        width: 120,
        render: (v) => <Tag className="dapTag">{roleText(v)}</Tag>,
      },
      {
        title: '最近就诊',
        dataIndex: 'latestVisitDate',
        key: 'latestVisitDate',
        width: 140,
        render: (v) => <span className="dapTime">{formatDate(v)}</span>,
      },
      {
        title: '编号',
        dataIndex: 'patientAccountId',
        key: 'patientAccountId',
        width: 110,
        render: (v) => <Tag className="dapIdTag">#{v ?? '-'}</Tag>,
      },
    ]
  }, [])

  return (
    <div className="dapRoot">
      <div className="dapBg" />
      <div className="dapWrap">
        <div className="dapTopbar">
          <div>
            <Title level={3} className="dapTitle">
              诊断报告
            </Title>
            <Text className="dapSubtitle">
              {account?.name ?? account?.accountName ?? '-'} · 查看与管理我的病人档案
            </Text>
          </div>
          <Space size={10}>
            <Button onClick={() => navigate('/home')}>返回</Button>
            <LogoutEntry onLogout={onLogout}>退出登录</LogoutEntry>
          </Space>
        </div>

        <div className="dapGrid">
          <Card className="dapPanel" bordered={false}>
            <div className="dapPanelHead">
              <div className="dapPanelTitle">
                <span className="dapBadge">病人列表</span>
                <span className="dapPanelMeta">共 {total} 人</span>
              </div>
              <Input
                allowClear
                value={patientNameKeyword}
                placeholder="按姓名搜索"
                className="dapSearch"
                onChange={(e) => {
                  setPatientNameKeyword(e.target.value || '')
                }}
              />
            </div>
            <Divider className="dapDivider" />
            <Table
              rowKey="patientAccountId"
              loading={loading}
              columns={columns}
              dataSource={patients}
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
              rowClassName={(row) => (row?.patientAccountId === activePatientId ? 'dapActiveRow' : '')}
              onRow={(row) => {
                return {
                  onClick: () => {
                    setActivePatientId(row?.patientAccountId ?? null)
                    setActivePatientName(row?.patientName ?? '')
                  },
                }
              }}
            />
          </Card>

          <div className="dapArchive">
            <div className="dapArchiveHead">
              <div>
                <div className="dapArchiveTitle">个人档案</div>
                <div className="dapArchiveSub">{activePatientName ? `当前：${activePatientName}` : '请选择一个病人'}</div>
              </div>
            </div>
            <VisionArchiveTimeline
              mode="doctor"
              patientAccountId={activePatientId}
              title="检查记录"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
