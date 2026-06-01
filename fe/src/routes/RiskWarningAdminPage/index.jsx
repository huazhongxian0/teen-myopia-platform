import { Card, Tag, Space, Typography, Button, message, Spin, Statistic, Row, Col } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WarningOutlined, BellOutlined, CheckCircleOutlined, BarChartOutlined } from '@ant-design/icons'
import { adminOverview } from '../../services/riskWarning.js'
import LogoutButton from '../../components/LogoutButton.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import StatSummaryCard from '../../components/StatSummaryCard.jsx'
import '../StudentPage/index.css'
import * as echarts from 'echarts'

const { Title, Text } = Typography

const mockRiskWarningOverview = {
  totalWarningCount: 86,
  unresolvedCount: 23,
  highRiskCount: 12,
  midRiskCount: 21,
  lowRiskCount: 27,
  normalCount: 26,
  responseRate: 73.3,
  levelDistribution: [
    { name: '高度预警', value: 12 },
    { name: '中度预警', value: 21 },
    { name: '轻度预警', value: 27 },
    { name: '正常关注', value: 26 },
  ],
  trendDistribution: [
    { date: '04-18', count: 3 },
    { date: '04-19', count: 6 },
    { date: '04-20', count: 9 },
    { date: '04-21', count: 7 },
    { date: '04-22', count: 11 },
    { date: '04-23', count: 8 },
    { date: '04-24', count: 5 },
  ],
  recentWarnings: [
    { id: 1, studentName: '王晨曦', level: '高度预警', triggerReason: '平均度数达到 560 度', status: '未处置' },
    { id: 2, studentName: '李思远', level: '中度预警', triggerReason: '近两次复查下降明显', status: '处理中' },
    { id: 3, studentName: '赵雨桐', level: '轻度预警', triggerReason: '超过建议复查周期', status: '已通知' },
  ],
}

const levelMap = {
  高度预警: { color: 'red' },
  中度预警: { color: 'orange' },
  轻度预警: { color: 'gold' },
  正常关注: { color: 'green' },
}

function normalizeLevelDistribution(list) {
  const source = Array.isArray(list) ? list : []
  const total = source.reduce((sum, item) => sum + Number(item?.count ?? item?.value ?? 0), 0)
  return source.map((item) => {
    const count = Number(item?.count ?? item?.value ?? 0)
    return {
      level: item?.level ?? item?.name ?? '-',
      count,
      percentage: total > 0 ? Math.round((count * 1000) / total) / 10 : 0,
    }
  })
}

function normalizeTrendDistribution(source) {
  const trendList = Array.isArray(source?.trendDistribution) ? source.trendDistribution : []
  if (trendList.length > 0) {
    return trendList.map((item) => ({
      date: item?.date ?? '-',
      count: Number(item?.count ?? item?.value ?? 0),
    }))
  }
  return []
}

function normalizeOverview(source) {
  const data = source && typeof source === 'object' ? source : {}
  return {
    totalWarnings: Number(data.totalWarnings ?? data.totalWarningCount ?? 0),
    unresolvedWarnings: Number(data.unresolvedWarnings ?? data.unresolvedCount ?? 0),
    todayNewWarnings: Number(data.todayNewWarnings ?? data.highRiskCount ?? 0),
    responseRate: Number(data.responseRate ?? 0),
    levelDistribution: normalizeLevelDistribution(data.levelDistribution),
    trendDistribution: normalizeTrendDistribution(data),
    recentWarnings: Array.isArray(data.recentWarnings) ? data.recentWarnings : [],
  }
}

export default function RiskWarningAdminPage({ onLogout }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState(null)
  const [usingMockData, setUsingMockData] = useState(false)

  const levelChartRef = useRef(null)
  const levelChartInstanceRef = useRef(null)
  const trendChartRef = useRef(null)
  const trendChartInstanceRef = useRef(null)

  async function loadOverview() {
    setLoading(true)
    try {
      const data = await adminOverview()
      const normalized = normalizeOverview(data)
      const hasRemoteData =
        normalized.totalWarnings > 0 ||
        normalized.levelDistribution.length > 0 ||
        normalized.trendDistribution.length > 0
      if (hasRemoteData) {
        setOverview(normalized)
        setUsingMockData(false)
      } else {
        setOverview(normalizeOverview(mockRiskWarningOverview))
        setUsingMockData(true)
      }
    } catch (e) {
      message.warning(e?.message || '加载总览数据失败，已切换为测试数据')
      setOverview(normalizeOverview(mockRiskWarningOverview))
      setUsingMockData(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  const levelStats = useMemo(() => {
    if (!overview?.levelDistribution) return []
    return overview.levelDistribution
  }, [overview])

  const trendStats = useMemo(() => {
    if (!overview?.trendDistribution) return []
    return overview.trendDistribution
  }, [overview])

  useEffect(() => {
    if (!levelChartRef.current) return
    let chart = levelChartInstanceRef.current
    if (!chart) {
      chart = echarts.init(levelChartRef.current)
      levelChartInstanceRef.current = chart
    }

    const data = levelStats.map((s) => ({ name: s.level, value: s.count }))
    const colors = ['#ff4d4f', '#faad14', '#52c41a', '#1890ff']

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 10, left: 'center' },
      series: [
        {
          name: '风险等级分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
          data,
          color: colors,
        },
      ],
    }, true)
    chart.resize()

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [levelStats])

  useEffect(() => {
    if (!trendChartRef.current) return
    let chart = trendChartInstanceRef.current
    if (!chart) {
      chart = echarts.init(trendChartRef.current)
      trendChartInstanceRef.current = chart
    }

    const dates = trendStats.map((s) => s.date)
    const values = trendStats.map((s) => s.count)

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 30, left: 50, right: 24, bottom: 30 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: 'rgba(15,23,42,0.62)' },
        axisLine: { lineStyle: { color: 'rgba(15,23,42,0.12)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(15,23,42,0.55)' },
        splitLine: { lineStyle: { color: 'rgba(15,23,42,0.08)' } },
      },
      series: [
        {
          name: '新增预警数',
          type: 'line',
          smooth: true,
          data: values,
          itemStyle: { color: '#2f6bff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(47,107,255,0.3)' },
                { offset: 1, color: 'rgba(47,107,255,0.04)' },
              ],
            },
          },
        },
      ],
    }, true)
    chart.resize()

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [trendStats])

  useEffect(() => {
    return () => {
      if (levelChartInstanceRef.current) {
        levelChartInstanceRef.current.dispose()
        levelChartInstanceRef.current = null
      }
      if (trendChartInstanceRef.current) {
        trendChartInstanceRef.current.dispose()
        trendChartInstanceRef.current = null
      }
    }
  }, [])

  const totalWarnings = overview?.totalWarnings ?? 0
  const unresolvedWarnings = overview?.unresolvedWarnings ?? 0
  const todayNewWarnings = overview?.todayNewWarnings ?? 0

  return (
    <div className="pageRoot">
      <div className="decoration decoration-1" />
      <div className="decoration decoration-2" />

      <Space direction="vertical" size={24} className="pageWrap">
        <PageHeader
          className="heroCard"
          avatar={<div className="avatar">🛡️</div>}
          title="风险预警总览"
          subtitle="全局视角查看平台视力风险预警数据"
          actions={
            <Space>
              <Button onClick={() => navigate('/home')}>返回首页</Button>
              <LogoutButton onLogout={onLogout} />
            </Space>
          }
        />

        {usingMockData ? (
          <Card bordered={false} style={{ borderRadius: 18, background: 'rgba(255,248,220,0.88)', border: '1px solid rgba(250,173,20,0.22)' }}>
            <Space size={10}>
              <CheckCircleOutlined style={{ color: '#d48806' }} />
              <Text strong style={{ color: '#8c6a00' }}>当前为测试数据模式，可直接用于页面演示与图表联调</Text>
            </Space>
          </Card>
        ) : null}

        <Spin spinning={loading}>
          <div className="pageLayout">
            <div className="mainColumn">
              <Row gutter={[20, 20]}>
                <Col xs={24} md={8}>
                  <StatSummaryCard
                    className="statCard statCard-orange"
                    bordered={false}
                    icon={<WarningOutlined className="statIcon" />}
                    label="预警总数"
                    value={<Title level={2} className="statValue">{totalWarnings}</Title>}
                    decoration={<WarningOutlined />}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <StatSummaryCard
                    className="statCard statCard-red"
                    bordered={false}
                    icon={<BellOutlined className="statIcon" />}
                    label="待处置"
                    value={<Title level={2} className="statValue">{unresolvedWarnings}</Title>}
                    decoration={<BellOutlined />}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <StatSummaryCard
                    className="statCard statCard-green"
                    bordered={false}
                    icon={<BarChartOutlined className="statIcon" />}
                    label="今日新增"
                    value={<Title level={2} className="statValue">{todayNewWarnings}</Title>}
                    decoration={<BarChartOutlined />}
                  />
                </Col>
              </Row>

              <Row gutter={[20, 20]}>
                <Col xs={24} md={12}>
                  <Card className="sectionCard" title={<span className="sectionTitle">📊 风险等级分布</span>} bordered={false}>
                    <div ref={levelChartRef} style={{ width: '100%', height: 320 }} />
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card className="sectionCard" title={<span className="sectionTitle">📈 预警趋势</span>} bordered={false}>
                    <div ref={trendChartRef} style={{ width: '100%', height: 320 }} />
                  </Card>
                </Col>
              </Row>

              <Card className="sectionCard" title={<span className="sectionTitle">📋 各等级详情</span>} bordered={false}>
                <Row gutter={[16, 16]}>
                  {levelStats.map((s) => (
                    <Col xs={24} sm={12} md={6} key={s.level}>
                      <Card bordered={false} style={{ textAlign: 'center', borderRadius: 16, background: 'rgba(255,255,255,0.6)' }}>
                        <Tag color={(levelMap[s.level]?.color) || 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
                          {s.level}
                        </Tag>
                        <div style={{ marginTop: 12 }}>
                          <Statistic value={s.count} suffix="人" valueStyle={{ fontSize: 28, fontWeight: 700 }} />
                        </div>
                        <Text type="secondary">占比 {s.percentage || 0}%</Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            </div>

            <div className="sideColumn">
              <Card className="sideCard" bordered={false}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>平台预警概况</Text>
                    <div style={{ marginTop: 12, color: 'rgba(81,96,122,0.9)', lineHeight: 1.8 }}>
                      <p>本平台基于三类规则进行风险识别：</p>
                      <p>• 阈值规则：根据平均度数分级预警</p>
                      <p>• 趋势规则：检测视力下降幅度</p>
                      <p>• 超期规则：监控复查周期</p>
                    </div>
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>管理建议</Text>
                    <div style={{ marginTop: 12, color: 'rgba(81,96,122,0.9)', lineHeight: 1.8 }}>
                      重点关注高度预警和中度预警学生，督促学校和家长配合进行视力复查与干预。定期查看趋势图表，评估区域近视防控成效。
                    </div>
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>演示数据提示</Text>
                    <div style={{ marginTop: 12, color: 'rgba(81,96,122,0.9)', lineHeight: 1.8 }}>
                      当前页面已内置风险等级分布、预警趋势和近期样例数据。当后端接口无返回或联调未完成时，系统会自动切换到测试数据，确保图表和统计卡片始终可见。
                    </div>
                  </div>
                </Space>
              </Card>
            </div>
          </div>
        </Spin>
      </Space>
    </div>
  )
}
