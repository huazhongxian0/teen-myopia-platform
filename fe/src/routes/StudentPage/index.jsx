import { Col, Row, Space, Typography, Card, Button, Avatar, message, Tabs, Drawer, DatePicker, Select, Table, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { 
  LogoutOutlined, 
  BarChartOutlined, 
  CalendarOutlined, 
  LineChartOutlined, 
  FileTextOutlined, 
  MedicineBoxOutlined, 
  UserOutlined 
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../../hooks/useAccount.js'
import LogoutEntry from '../../components/LogoutEntry.jsx'
import EyeCareTipsPanel from '../../components/EyeCareTipsPanel.jsx'
import { httpClient } from '../../services/http/index.js'
import './index.css'

const { Title, Text } = Typography

/**
 * 学生端页面
 * @param {Object} props - 组件属性
 * @param {Function} props.onLogout - 退出登录回调函数
 */
export default function StudentPage({ onLogout }) {
  const { account } = useAccount()
  const displayName = account?.name ?? account?.accountName ?? '-'
  const roleId = account?.roleId ?? '-'
  const [eyeSight, setEyeSight] = useState(null)
  const [eyeSightLoading, setEyeSightLoading] = useState(false)
  const [panelTab, setPanelTab] = useState('overview')
  const navigate = useNavigate()

  function toTodayStartMs() {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now.getTime()
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

  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [doctorOptions, setDoctorOptions] = useState([])
  const [doctorLoading, setDoctorLoading] = useState(false)
  const [selectedDoctorId, setSelectedDoctorId] = useState(null)
  const [selectedYmd, setSelectedYmd] = useState(() => formatDate(toTodayStartMs()))
  const [creatingAppointment, setCreatingAppointment] = useState(false)

  const [myRegLoading, setMyRegLoading] = useState(false)
  const [myRegList, setMyRegList] = useState([])
  const [myRegTotal, setMyRegTotal] = useState(0)
  const [myRegPageNo, setMyRegPageNo] = useState(1)
  const [myRegPageSize, setMyRegPageSize] = useState(10)

  useEffect(() => {
    let cancelled = false

    async function loadEyeSight() {
      setEyeSightLoading(true)
      try {
        const data = await httpClient.post('/api/users/eyesight/getMine', {})
        if (cancelled) return
        setEyeSight(data?.exists ? data : null)
      } catch (e) {
        if (cancelled) return
        setEyeSight(null)
        message.error(e?.message || '加载最近视力失败')
      } finally {
        if (!cancelled) setEyeSightLoading(false)
      }
    }

    if (account?.accountId) {
      void loadEyeSight()
    } else {
      setEyeSight(null)
    }

    return () => {
      cancelled = true
    }
  }, [account?.accountId])

  function formatVision(value) {
    if (value === undefined || value === null) return '-'
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return '-'
    if (n >= 10) return (n / 10).toFixed(1)
    return n.toFixed(1)
  }

  const recentVisionText = useMemo(() => {
    if (eyeSightLoading) return '-'
    if (!eyeSight) return '-'
    return `${formatVision(eyeSight.od)} / ${formatVision(eyeSight.os)}`
  }, [eyeSight, eyeSightLoading])

  async function loadDoctors() {
    setDoctorLoading(true)
    try {
      const data = await httpClient.get('/api/users/accounts', { params: { roleId: 'doctor' } })
      const list = Array.isArray(data) ? data : []
      setDoctorOptions(list.map((d) => ({ value: d.id, label: `${d.name}（${d.accountName}）` })))
    } catch (e) {
      setDoctorOptions([])
    } finally {
      setDoctorLoading(false)
    }
  }

  async function loadMyRegistrations({ pageNo = myRegPageNo, pageSize = myRegPageSize } = {}) {
    setMyRegLoading(true)
    try {
      const data = await httpClient.post('/api/visitRegistration/listMineByPatient', { pageNo, pageSize })
      setMyRegList(Array.isArray(data?.list) ? data.list : [])
      setMyRegTotal(Number(data?.total ?? 0))
    } catch (e) {
      message.error(e?.message || '加载我的预约失败')
      setMyRegList([])
      setMyRegTotal(0)
    } finally {
      setMyRegLoading(false)
    }
  }

  useEffect(() => {
    if (!appointmentOpen) return
    void loadMyRegistrations()
  }, [appointmentOpen, myRegPageNo, myRegPageSize])

  useEffect(() => {
    if (!appointmentOpen) return
    if (doctorOptions.length > 0) return
    void loadDoctors()
  }, [appointmentOpen])

  async function createAppointment() {
    const doctorAccountId = selectedDoctorId
    const visitDate = parseYmdToStartMs(selectedYmd) ?? toTodayStartMs()
    if (!doctorAccountId) {
      message.error('请选择医生')
      return
    }
    if (!visitDate) {
      message.error('请选择日期')
      return
    }

    setCreatingAppointment(true)
    try {
      await httpClient.post('/api/visitRegistration/createByPatient', { doctorAccountId, visitDate })
      message.success('预约成功')
      setMyRegPageNo(1)
      void loadMyRegistrations({ pageNo: 1 })
    } catch (e) {
      message.error(e?.message || '预约失败')
    } finally {
      setCreatingAppointment(false)
    }
  }

  const myRegColumns = [
    { title: '预约日期', dataIndex: 'visitDate', width: 140, render: (v) => formatDate(v) },
    { title: '医生', dataIndex: 'doctorName', width: 120, render: (v) => v || '-' },
    { title: '创建时间', dataIndex: 'createdAt', width: 270, render: (v) => formatDateTime(v) },
    { title: '状态', key: 'status', width: 120, render: () => <Tag color="green">已预约</Tag> },
  ]

  return (
    <div className="pageRoot">
      <div className="decoration decoration-1" />
      <div className="decoration decoration-2" />
      
      <Space direction="vertical" size={24} className="pageWrap">
        <Card className="heroCard" bordered={false}>
          <div className="heroContent">
            <div className="heroLeft">
              <Avatar size={64} icon={<UserOutlined />} className="userAvatar" />
              <div>
                <Title level={3} style={{ margin: 0, color: '#1e293b' }}>
                  你好，{displayName}同学！
                </Title>
                <div className="roleTagWrapper">
                  <Text className="roleTag">
                    {roleId === 'student' ? '学生端' : roleId}
                  </Text>
                </div>
              </div>
            </div>
            <div className="heroRight">
              <LogoutEntry
                type="primary" 
                ghost 
                icon={<LogoutOutlined />} 
                onLogout={onLogout}
                className="logoutBtn"
              >
                退出登录
              </LogoutEntry>
            </div>
          </div>
        </Card>

        <div className="pageLayout">
          <div className="mainColumn">
            <Row gutter={[20, 20]}>
              <Col xs={24} md={8}>
                <Card className="statCard statCard-blue" bordered={false}>
                  <div className="statCardContent">
                    <div className="statIconWrapper">
                      <BarChartOutlined className="statIcon" />
                    </div>
                    <div className="statInfo">
                      <Text className="statLabel">最近视力 (左/右)</Text>
                      <Title level={2} className="statValue">{recentVisionText}</Title>
                    </div>
                  </div>
                  <div className="statDecoration">
                    <BarChartOutlined />
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="statCard statCard-green" bordered={false}>
                  <div className="statCardContent">
                    <div className="statIconWrapper">
                      <CalendarOutlined className="statIcon" />
                    </div>
                    <div className="statInfo">
                      <Text className="statLabel">下次复查</Text>
                      <Title level={2} className="statValue">2024-06-15</Title>
                    </div>
                  </div>
                  <div className="statDecoration">
                    <CalendarOutlined />
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="statCard statCard-orange" bordered={false}>
                  <div className="statCardContent">
                    <div className="statIconWrapper">
                      <LineChartOutlined className="statIcon" />
                    </div>
                    <div className="statInfo">
                      <Text className="statLabel">视力趋势</Text>
                      <Title level={2} className="statValue">稳定</Title>
                    </div>
                  </div>
                  <div className="statDecoration">
                    <LineChartOutlined />
                  </div>  
                </Card>
              </Col>
            </Row>

            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <Card className="sectionCard" title={<span className="sectionTitle">🌟 我的功能</span>} bordered={false}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                      <Card className="actionCard" hoverable bordered={false} onClick={() => navigate('/student/archive')}>
                        <div className="actionCardInner">
                          <div className="actionIconBox actionIconBox-blue">
                            <FileTextOutlined className="actionIcon" />
                          </div>
                          <div className="actionContent">
                            <Text strong className="actionTitle">视力档案</Text>
                            <Text type="secondary" className="actionDesc">
                              查看我的详细视力检查记录
                            </Text>
                          </div>
                          <div className="actionArrow">→</div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Card className="actionCard" hoverable bordered={false}>
                        <div className="actionCardInner">
                          <div className="actionIconBox actionIconBox-green">
                            <MedicineBoxOutlined className="actionIcon" />
                          </div>
                          <div className="actionContent">
                            <Text strong className="actionTitle">护眼计划</Text>
                            <Text type="secondary" className="actionDesc">
                              查看并执行我的每日护眼任务
                            </Text>
                          </div>
                          <div className="actionArrow">→</div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Card
                        className="actionCard"
                        hoverable
                        bordered={false}
                        onClick={() => {
                          setAppointmentOpen(true)
                          setMyRegPageNo(1)
                          void loadMyRegistrations({ pageNo: 1 })
                          void loadDoctors()
                        }}
                      >
                        <div className="actionCardInner">
                          <div className="actionIconBox actionIconBox-purple">
                            <CalendarOutlined className="actionIcon" />
                          </div>
                          <div className="actionContent">
                            <Text strong className="actionTitle">预约视力检查</Text>
                            <Text type="secondary" className="actionDesc">
                              选择医生与日期，提交预约
                            </Text>
                          </div>
                          <div className="actionArrow">→</div>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card className="sectionCard tipSection" title={<span className="sectionTitle">💡 护眼小课堂</span>} bordered={false}>
                  <EyeCareTipsPanel mode="student" />
                </Card>
              </Col>
            </Row>
          </div>

          <div className="sideColumn">
            <Card className="sideCard" bordered={false}>
              <Tabs
                activeKey={panelTab}
                onChange={setPanelTab}
                tabPosition="left"
                size="large"
                items={[
                  {
                    key: 'overview',
                    label: '概览',
                    children: <div className="sideEmpty">暂无更多内容</div>,
                  },
                  {
                    key: 'record',
                    label: '档案',
                    children: <div className="sideEmpty">暂无更多内容</div>,
                  },
                  {
                    key: 'plan',
                    label: '计划',
                    children: <div className="sideEmpty">暂无更多内容</div>,
                  },
                ]}
              />
            </Card>
          </div>
        </div>
      </Space>

      <Drawer
        title="预约视力检查"
        open={appointmentOpen}
        onClose={() => setAppointmentOpen(false)}
        width={640}
        className="appointmentDrawer"
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Card bordered={false} className="appointmentCard">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <div className="appointmentRow">
                <div className="appointmentLabel">选择医生</div>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择医生"
                  options={doctorOptions}
                  loading={doctorLoading}
                  value={selectedDoctorId}
                  onChange={setSelectedDoctorId}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </div>
              <div className="appointmentRow">
                <div className="appointmentLabel">预约日期</div>
                <Space size={10} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                  <DatePicker
                    style={{ minWidth: 220 }}
                    onChange={(_, dateString) => {
                      setSelectedYmd(dateString || formatDate(toTodayStartMs()))
                    }}
                    placeholder="默认今天"
                  />
                  <Tag className="appointmentTag">当前选择：{selectedYmd}</Tag>
                </Space>
              </div>
              <Button type="primary" onClick={createAppointment} loading={creatingAppointment} block>
                提交预约
              </Button>
            </Space>
          </Card>

          <Card bordered={false} className="appointmentListCard" title="我的预约">
            <Table
              rowKey="id"
              loading={myRegLoading}
              columns={myRegColumns}
              dataSource={myRegList}
              pagination={{
                current: myRegPageNo,
                pageSize: myRegPageSize,
                total: myRegTotal,
                showSizeChanger: true,
                onChange: (p, ps) => {
                  setMyRegPageNo(p)
                  setMyRegPageSize(ps)
                },
              }}
            />
          </Card>
        </Space>
      </Drawer>
    </div>
  )
}
