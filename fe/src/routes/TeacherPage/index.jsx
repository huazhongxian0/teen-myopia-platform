import { Col, Row, Space, Typography, Card, Tabs, Button, Empty, Spin, message, Select, Input } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChartOutlined, BellOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons'
import { useAccount } from '../../hooks/useAccount.js'
import { httpClient } from '../../services/http/index.js'
import LogoutButton from '../../components/LogoutButton.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import StudentManager from '../AllBackUp/StudentManager.jsx'
import ClassCameraDetectPage from '../ClassCameraDetectPage/index.jsx'
import StatSummaryCard from '../../components/StatSummaryCard.jsx'
import './index.css'
import * as echarts from 'echarts'

const { Title, Text } = Typography

export default function TeacherPage({ onLogout }) {
  const { account } = useAccount()
  const displayName = account?.name ?? account?.accountName ?? '-'
  const roleId = account?.roleId ?? '-'
  const [activeTab, setActiveTab] = useState('overview')
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedPanel, setSelectedPanel] = useState('students')
  const [visionClassId, setVisionClassId] = useState('all')
  const [visionKeyword, setVisionKeyword] = useState('')
  const [visionBackTarget, setVisionBackTarget] = useState('overview')
  const [visionList, setVisionList] = useState([])
  const [visionLoading, setVisionLoading] = useState(false)
  const visionChartRef = useRef(null)
  const visionChartInstanceRef = useRef(null)

  async function fetchClasses() {
    const teacherAccountId = account?.accountId
    if (!teacherAccountId) return
    try {
      setLoading(true)
      const data = await httpClient.post('/api/school/teacher/classes', { 
        teacherAccountId
      })
      setClasses(data?.list || [])
    } catch (e) {
      message.error(e?.message || '加载班级失败')
      setClasses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchClasses()
  }, [account?.accountId])

  function normalizeVisionValue(value) {
    if (value === undefined || value === null) return null
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return null
    if (n >= 10) return n / 10
    return n
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

  const visionClassOptions = useMemo(() => {
    const opts = [{ value: 'all', label: '全部班级' }]
    for (const c of classes) {
      if (!c?.id) continue
      opts.push({ value: String(c.id), label: c.name || `班级${c.id}` })
    }
    return opts
  }, [classes])

  const visionFilteredList = useMemo(() => {
    let list = visionList
    if (visionClassId !== 'all') {
      const cid = Number(visionClassId)
      if (Number.isFinite(cid)) {
        list = list.filter((x) => Number(x?.classId) === cid)
      }
    }

    const keyword = visionKeyword.trim()
    if (!keyword) return list
    const lower = keyword.toLowerCase()
    return list.filter((x) => {
      const studentName = String(x?.studentName ?? '')
      const className = String(x?.className ?? '')
      return studentName.toLowerCase().includes(lower) || className.toLowerCase().includes(lower)
    })
  }, [visionClassId, visionKeyword, visionList])

  const visionSummary = useMemo(() => {
    const total = visionFilteredList.length
    const withData = visionFilteredList.filter((x) => x?.od !== null && x?.od !== undefined && x?.os !== null && x?.os !== undefined).length
    const lastTime = visionFilteredList.reduce((acc, cur) => {
      const t = Number(cur?.eyesTime ?? 0)
      if (!Number.isFinite(t) || t <= 0) return acc
      return Math.max(acc, t)
    }, 0)
    return { total, withData, lastTime: lastTime || null }
  }, [visionFilteredList])

  async function fetchVision() {
    const teacherAccountId = account?.accountId
    if (!teacherAccountId) return
    setVisionLoading(true)
    try {
      const payload = {
        teacherAccountId,
        ...(visionClassId === 'all' ? {} : { classId: Number(visionClassId) }),
      }
      const data = await httpClient.post('/api/school/teacher/eyesight/list', payload)
      const list = Array.isArray(data?.list) ? data.list : []
      setVisionList(list)
    } catch (e) {
      setVisionList([])
      message.error(e?.message || '加载视力统计失败')
    } finally {
      setVisionLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'vision') return
    void fetchVision()
  }, [activeTab, visionClassId, account?.accountId])

  useEffect(() => {
    if (activeTab !== 'vision') return
    if (!visionChartRef.current) return

    let chart = visionChartInstanceRef.current
    if (!chart) {
      chart = echarts.init(visionChartRef.current)
      visionChartInstanceRef.current = chart
    }

    const list = visionFilteredList.slice().sort((a, b) => {
      const ac = String(a?.className ?? '')
      const bc = String(b?.className ?? '')
      if (ac !== bc) return ac.localeCompare(bc, 'zh-Hans-CN')
      const an = String(a?.studentName ?? '')
      const bn = String(b?.studentName ?? '')
      return an.localeCompare(bn, 'zh-Hans-CN')
    })

    const showClassPrefix = visionClassId === 'all'
    const categories = list.map((x) => {
      const studentName = x?.studentName || String(x?.studentAccountId ?? '-')
      if (!showClassPrefix) return studentName
      const className = x?.className || '未命名班级'
      return `${className} · ${studentName}`
    })

    const leftData = list.map((x) => normalizeVisionValue(x?.os))
    const rightData = list.map((x) => normalizeVisionValue(x?.od))

    const allValues = [...leftData, ...rightData].filter((v) => typeof v === 'number' && Number.isFinite(v))
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 5
    const yMax = Math.max(5, Math.ceil(maxValue * 10) / 10 + 0.2)

    chart.setOption(
      {
        backgroundColor: 'transparent',
        grid: { top: 42, left: 46, right: 24, bottom: 92 },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const idx = params?.[0]?.dataIndex ?? 0
            const row = list[idx]
            const className = row?.className || '未命名班级'
            const studentName = row?.studentName || String(row?.studentAccountId ?? '-')
            const timeText = row?.eyesTime ? formatDate(row.eyesTime) : '暂无'
            const lines = [
              `${className} · ${studentName}`,
              `上次测量：${timeText}`,
            ]
            for (const p of params) {
              const v = p?.value
              const show = typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : '-'
              lines.push(`${p.marker}${p.seriesName}：${show}`)
            }
            return lines.join('<br/>')
          },
        },
        legend: { top: 10, right: 10, textStyle: { color: 'rgba(15, 23, 42, 0.72)' } },
        dataZoom: categories.length > 12
          ? [
            { type: 'inside', start: 0, end: 45 },
            { type: 'slider', start: 0, end: 45, height: 18, bottom: 24 },
          ]
          : [],
        xAxis: {
          type: 'category',
          data: categories,
          axisLabel: {
            color: 'rgba(15, 23, 42, 0.62)',
            rotate: categories.length > 8 ? 24 : 0,
            formatter: (v) => (String(v).length > 16 ? `${String(v).slice(0, 16)}…` : v),
          },
          axisTick: { alignWithLabel: true },
          axisLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.12)' } },
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: yMax,
          axisLabel: { color: 'rgba(15, 23, 42, 0.55)' },
          splitLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.08)' } },
        },
        series: [
          {
            name: '左眼',
            type: 'bar',
            barWidth: categories.length > 18 ? 10 : 14,
            itemStyle: { color: 'rgba(91, 61, 245, 0.78)', borderRadius: [8, 8, 0, 0] },
            emphasis: { focus: 'series' },
            data: leftData,
          },
          {
            name: '右眼',
            type: 'bar',
            barWidth: categories.length > 18 ? 10 : 14,
            itemStyle: { color: 'rgba(47, 107, 255, 0.74)', borderRadius: [8, 8, 0, 0] },
            emphasis: { focus: 'series' },
            data: rightData,
          },
        ],
      },
      true
    )
    chart.resize()

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [activeTab, visionClassId, visionFilteredList])

  useEffect(() => {
    return () => {
      if (visionChartInstanceRef.current) {
        visionChartInstanceRef.current.dispose()
        visionChartInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="pageRoot">
      <div className="decoration decoration-1" />
      <div className="decoration decoration-2" />
      
      <Space direction="vertical" size={24} className="pageWrap">
        <PageHeader
          className="heroCard"
          avatar={<div className="avatar">👨‍🏫</div>}
          title={`欢迎，${displayName}`}
          subtitle={`老师端 · ${roleId}`}
          actions={<LogoutButton onLogout={onLogout} />}
        />

        <div className="pageLayout">
          <div className="mainColumn">
            {activeTab === 'overview' && (
              <>
                <Row gutter={[20, 20]}>
                  <Col xs={24} md={8}>
                    <StatSummaryCard
                      className="statSummaryCard statSummaryCard-purple"
                      bordered={false}
                      icon={<TeamOutlined className="statIcon" />}
                      label="管理班级"
                      value={<Title level={2} className="statValue">{classes.length}</Title>}
                      decoration={<TeamOutlined />}
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <StatSummaryCard
                      className="statSummaryCard statSummaryCard-orange"
                      bordered={false}
                      icon={<BellOutlined className="statIcon" />}
                      label="待关注"
                      value={<Title level={2} className="statValue">-</Title>}
                      decoration={<BellOutlined />}
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <StatSummaryCard
                      className="statSummaryCard statSummaryCard-green"
                      bordered={false}
                      icon={<FileTextOutlined className="statIcon" />}
                      label="筛查记录"
                      value={<Title level={2} className="statValue">-</Title>}
                      decoration={<FileTextOutlined />}
                    />
                  </Col>
                </Row>

                <Row gutter={[20, 20]}>
                  <Col xs={24} md={12}>
                    <Card className="sectionCard" title="快速操作">
                      <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                          <Card
                            className="actionCard"
                            hoverable
                            variant="borderless"
                            onClick={() => setActiveTab('classes')}
                          >
                            <div className="actionCardInner">
                              <div className="actionIconBox actionIconBox-purple">
                                <TeamOutlined className="actionIcon" />
                              </div>
                              <div className="actionContent">
                                <Text strong className="actionTitle">班级管理</Text>
                                <Text type="secondary" className="actionDesc">
                                  管理您的班级和学生
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
                            variant="borderless"
                            onClick={() => {
                              setVisionBackTarget('overview')
                              setVisionClassId('all')
                              setVisionKeyword('')
                              setActiveTab('vision')
                            }}
                          >
                            <div className="actionCardInner">
                              <div className="actionIconBox actionIconBox-green">
                                <BarChartOutlined className="actionIcon" />
                              </div>
                              <div className="actionContent">
                                <Text strong className="actionTitle">视力统计</Text>
                                <Text type="secondary" className="actionDesc">
                                  查看班级学生视力统计数据
                                </Text>
                              </div>
                              <div className="actionArrow">→</div>
                            </div>
                          </Card>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card className="sectionCard" title="护眼知识">
                      <div className="healthTip">
                        <div className="tipIcon">💡</div>
                        <div className="tipContent">
                          <Text strong>今日护眼小贴士</Text>
                          <Text type="secondary">
                            提醒学生保持充足的户外活动时间，每天至少2小时，可以有效预防近视。
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </>
            )}

            {activeTab === 'vision' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div className="visionHeaderRow">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Button
                      className="classBackBtn"
                      onClick={() => {
                        setActiveTab(visionBackTarget)
                      }}
                    >
                      ← 返回
                    </Button>
                    <div style={{ minWidth: 0 }}>
                      <Title level={4} className="theme-gradient-title">视力统计</Title>
                      <Text type="secondary">
                        共 {visionSummary.total} 人，已测量 {visionSummary.withData} 人，最近测量：{visionSummary.lastTime ? formatDate(visionSummary.lastTime) : '-'}
                      </Text>
                    </div>
                  </div>
                  <div className="visionActions">
                    <Select
                      value={visionClassId}
                      options={visionClassOptions}
                      onChange={(v) => {
                        setVisionClassId(v)
                      }}
                      style={{ width: 220 }}
                    />
                    <Input
                      allowClear
                      value={visionKeyword}
                      onChange={(e) => setVisionKeyword(e.target.value)}
                      placeholder="搜索学生或班级"
                      style={{ width: 220 }}
                    />
                    <Button onClick={fetchVision} loading={visionLoading}>
                      刷新
                    </Button>
                  </div>
                </div>

                <Card className="visionCard">
                  <Spin spinning={visionLoading}>
                    {visionFilteredList.length === 0 ? (
                      <Empty description="暂无视力数据" />
                    ) : (
                      <div ref={visionChartRef} className="visionChart" />
                    )}
                  </Spin>
                </Card>
              </Space>
            )}

            {activeTab === 'classes' && (
              selectedClass ? (
                selectedPanel === 'camera' ? (
                  <ClassCameraDetectPage
                    classInfo={selectedClass}
                    onBack={() => {
                      setSelectedClass(null)
                      setSelectedPanel('students')
                    }}
                  />
                ) : (
                  <StudentManager
                    classInfo={selectedClass}
                    onBack={() => {
                      setSelectedClass(null)
                      setSelectedPanel('students')
                    }}
                  />
                )
              ) : (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Button
                        className="classBackBtn"
                        onClick={() => {
                          setActiveTab('overview')
                        }}
                      >
                        ← 返回
                      </Button>
                      <div>
                        <Title level={4} className="theme-gradient-title">我的班级</Title>
                        <Text type="secondary">点击班级卡片进入学生管理</Text>
                      </div>
                    </div>
                    <Button onClick={fetchClasses} loading={loading}>
                      刷新
                    </Button>
                  </div>

                  <Spin spinning={loading}>
                    {classes.length === 0 ? (
                      <Card>
                        <Empty description="暂无管理的班级" />
                      </Card>
                    ) : (
                      <Row gutter={[20, 20]}>
                        {classes.map((cls) => (
                          <Col xs={24} sm={12} md={8} key={cls.id}>
                            <Card 
                              className="classCard"
                              hoverable
                              onClick={() => {
                                setSelectedPanel('students')
                                setSelectedClass(cls)
                              }}
                            >
                              <div className="classCardIcon">🏫</div>
                              <Title level={4} className="classCardTitle">{cls.name}</Title>
                              <Text type="secondary" className="classCardMeta">
                                创建于 {new Date(cls.createdAt).toLocaleDateString()}
                              </Text>
                              <div className="classCardAction">
                                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                  <Button
                                    type="primary"
                                    block
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPanel('students')
                                      setSelectedClass(cls)
                                    }}
                                  >
                                    管理学生
                                  </Button>
                                  <Button
                                    block
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPanel('camera')
                                      setSelectedClass(cls)
                                    }}
                                  >
                                    摄像头检测
                                  </Button>
                                  <Button
                                    block
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setVisionBackTarget('classes')
                                      setVisionClassId(String(cls.id))
                                      setVisionKeyword('')
                                      setActiveTab('vision')
                                    }}
                                  >
                                    查看视力统计
                                  </Button>
                                </Space>
                              </div>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </Spin>
                </Space>
              )
            )}
          </div>

          <div className="sideColumn">
            <Card className="sideCard">
              <Tabs
                activeKey={activeTab}
                onChange={(key) => {
                  if (key === 'vision') {
                    setVisionBackTarget('overview')
                  }
                  setActiveTab(key)
                }}
                tabPosition="left"
                size="large"
                items={[
                  { key: 'overview', label: '概览', children: <div className="sideEmpty">用于切换查看概览数据</div> },
                  { key: 'classes', label: '班级管理', children: <div className="sideEmpty">用于进入班级与学生管理</div> },
                  { key: 'vision', label: '视力统计', children: <div className="sideEmpty">用于查看学生视力数据可视化</div> },
                ]}
              />
            </Card>
          </div>
        </div>
      </Space>
    </div>
  )
}
