import { Button, Card, Empty, Input, Select, Spin, Statistic, Table, Tag, Typography } from 'antd'
import * as echarts from 'echarts'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoutEntry from '../components/LogoutEntry.jsx'
import OverviewChart from '../components/OverviewChart.jsx'
import { httpClient } from '../services/http/index.js'
import { getOverviewRealtimeSnapshot, subscribeOverviewRealtimeSnapshot } from '../services/overviewRealtimeStore.js'
import './Main.css'

const { Title, Text } = Typography

function formatTime(ts) {
  if (!ts) return '-'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function createChartTextStyle() {
  return {
    color: '#5f6f8a',
    fontSize: 12,
  }
}

function createAxisLabelStyle() {
  return {
    color: '#4a5b76',
    fontSize: 12,
  }
}

function createEmptyOption() {
  return {
    animation: false,
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: '暂无数据',
          fill: '#6f7f99',
          fontSize: 14,
          fontWeight: 600,
        },
      },
    ],
  }
}

export default function Main({ account, onLogout }) {
  const navigate = useNavigate()
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [studentLoading, setStudentLoading] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [studentResult, setStudentResult] = useState({ total: 0, list: [] })
  const [keywordDraft, setKeywordDraft] = useState('')
  const [schoolDraft, setSchoolDraft] = useState(null)
  const [studentQuery, setStudentQuery] = useState({ keyword: '', schoolId: null, pageNo: 1, pageSize: 8 })
  const [realtimeSnapshot, setRealtimeSnapshot] = useState(() => getOverviewRealtimeSnapshot())

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setDashboardLoading(true)
      try {
        const data = await httpClient.post('/api/overview/dashboard', { topSchoolLimit: 8 })
        if (!cancelled) {
          setDashboard(data)
        }
      } catch {
        if (!cancelled) {
          setDashboard(null)
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false)
        }
      }
    }

    void loadDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadStudents() {
      setStudentLoading(true)
      try {
        const data = await httpClient.post('/api/overview/student/list', studentQuery)
        if (!cancelled) {
          setStudentResult({
            total: Number(data?.total || 0),
            list: Array.isArray(data?.list) ? data.list : [],
          })
        }
      } catch {
        if (!cancelled) {
          setStudentResult({ total: 0, list: [] })
        }
      } finally {
        if (!cancelled) {
          setStudentLoading(false)
        }
      }
    }

    void loadStudents()
    return () => {
      cancelled = true
    }
  }, [studentQuery])

  useEffect(() => {
    return subscribeOverviewRealtimeSnapshot((payload) => {
      setRealtimeSnapshot(payload)
    })
  }, [])

  const schoolOptions = useMemo(() => {
    const list = Array.isArray(dashboard?.schoolCoverage) ? dashboard.schoolCoverage : []
    return list.map((item) => ({
      label: item.schoolName,
      value: item.schoolId,
    }))
  }, [dashboard])

  const rankingOption = useMemo(() => {
    const list = dashboard?.schoolRanking ?? []
    if (!list.length) return createEmptyOption()
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: { left: 96, right: 24, top: 24, bottom: 18 },
      xAxis: {
        type: 'value',
        axisLabel: createAxisLabelStyle(),
        splitLine: { lineStyle: { color: 'rgba(91, 61, 245, 0.08)' } },
      },
      yAxis: {
        type: 'category',
        data: [...list].reverse().map((item) => item.schoolName),
        axisLabel: createAxisLabelStyle(),
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: [...list].reverse().map((item) => item.avgDegree),
          barWidth: 16,
          itemStyle: {
            borderRadius: [0, 10, 10, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#5b3df5' },
              { offset: 0.6, color: '#2f6bff' },
              { offset: 1, color: '#00c2a8' },
            ]),
          },
          label: {
            show: true,
            position: 'right',
            color: '#44536c',
            formatter: '{c}',
          },
        },
      ],
    }
  }, [dashboard])

  const riskOption = useMemo(() => {
    const list = dashboard?.riskDistribution ?? []
    if (!list.length) return createEmptyOption()
    return {
      tooltip: { trigger: 'item' },
      legend: {
        bottom: 0,
        textStyle: createChartTextStyle(),
      },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '42%'],
          label: {
            color: '#44536c',
            formatter: '{b}\n{d}%',
          },
          labelLine: { length: 12, length2: 10 },
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 4,
          },
          data: list.map((item, index) => ({
            name: item.name,
            value: item.value,
            itemStyle: {
              color: ['#2f6bff', '#00c2a8', '#ff8a3d', '#5b3df5'][index % 4],
            },
          })),
        },
      ],
    }
  }, [dashboard])

  const trendOption = useMemo(() => {
    const list = dashboard?.visitTrend ?? []
    if (!list.length) return createEmptyOption()
    return {
      tooltip: { trigger: 'axis' },
      legend: {
        top: 0,
        textStyle: createChartTextStyle(),
      },
      grid: { left: 40, right: 20, top: 36, bottom: 24 },
      xAxis: {
        type: 'category',
        data: list.map((item) => item.date),
        axisLabel: createAxisLabelStyle(),
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: createAxisLabelStyle(),
        splitLine: { lineStyle: { color: 'rgba(91, 61, 245, 0.08)' } },
      },
      series: [
        {
          name: '预约量',
          type: 'bar',
          barMaxWidth: 18,
          data: list.map((item) => item.registrationCount),
          itemStyle: {
            borderRadius: [10, 10, 0, 0],
            color: '#c7d6ff',
          },
        },
        {
          name: '就诊量',
          type: 'line',
          smooth: true,
          data: list.map((item) => item.visitCount),
          symbolSize: 8,
          lineStyle: { width: 3, color: '#5b3df5' },
          itemStyle: { color: '#2f6bff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(91, 61, 245, 0.18)' },
                { offset: 1, color: 'rgba(91, 61, 245, 0.02)' },
              ],
            },
          },
        },
      ],
    }
  }, [dashboard])

  const coverageOption = useMemo(() => {
    const list = dashboard?.schoolCoverage ?? []
    if (!list.length) return createEmptyOption()
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 96, right: 24, top: 20, bottom: 18 },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          ...createAxisLabelStyle(),
          formatter: '{value}%',
        },
        splitLine: { lineStyle: { color: 'rgba(91, 61, 245, 0.08)' } },
      },
      yAxis: {
        type: 'category',
        data: [...list].reverse().map((item) => item.schoolName),
        axisLabel: createAxisLabelStyle(),
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: [...list].reverse().map((item) => item.coverageRate),
          barWidth: 12,
          itemStyle: {
            borderRadius: [0, 8, 8, 0],
            color: '#00c2a8',
          },
          label: {
            show: true,
            position: 'right',
            color: '#44536c',
            formatter: ({ value }) => `${Number(value || 0).toFixed(1)}%`,
          },
        },
      ],
    }
  }, [dashboard])

  const glassesOption = useMemo(() => {
    const list = dashboard?.glassesDistribution ?? []
    if (!list.length) return createEmptyOption()
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        top: 0,
        textStyle: createChartTextStyle(),
      },
      grid: { left: 56, right: 20, top: 36, bottom: 24 },
      xAxis: {
        type: 'category',
        data: list.map((item) => item.schoolName),
        axisLabel: createAxisLabelStyle(),
      },
      yAxis: {
        type: 'value',
        axisLabel: createAxisLabelStyle(),
        splitLine: { lineStyle: { color: 'rgba(91, 61, 245, 0.08)' } },
      },
      series: [
        {
          name: '佩戴眼镜',
          type: 'bar',
          stack: 'school',
          data: list.map((item) => item.glassesCount),
          itemStyle: { color: '#5b3df5', borderRadius: [8, 8, 0, 0] },
        },
        {
          name: '未佩戴眼镜',
          type: 'bar',
          stack: 'school',
          data: list.map((item) => item.noGlassesCount),
          itemStyle: { color: '#9fc8ff', borderRadius: [8, 8, 0, 0] },
        },
      ],
    }
  }, [dashboard])

  const realtimeClassCounts = useMemo(() => {
    return Object.entries(realtimeSnapshot?.classCounts ?? {}).map(([name, value]) => ({
      name,
      value: Number(value || 0),
    }))
  }, [realtimeSnapshot])

  const realtimeOption = useMemo(() => {
    if (!realtimeClassCounts.length) return createEmptyOption()
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 72, right: 18, top: 18, bottom: 18 },
      xAxis: {
        type: 'value',
        axisLabel: createAxisLabelStyle(),
        splitLine: { lineStyle: { color: 'rgba(91, 61, 245, 0.08)' } },
      },
      yAxis: {
        type: 'category',
        data: realtimeClassCounts.map((item) => item.name),
        axisLabel: createAxisLabelStyle(),
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: realtimeClassCounts.map((item) => item.value),
          barWidth: 12,
          itemStyle: {
            borderRadius: [0, 8, 8, 0],
            color: '#2f6bff',
          },
        },
      ],
    }
  }, [realtimeClassCounts])

  const studentColumns = useMemo(() => {
    return [
      { title: '学校', dataIndex: 'schoolName', width: 160 },
      { title: '班级', dataIndex: 'className', width: 140 },
      { title: '学生', dataIndex: 'studentName', width: 120 },
      { title: '账号', dataIndex: 'accountName', width: 140 },
      { title: '手机号', dataIndex: 'phoneNumber', width: 150 },
      {
        title: '右眼',
        dataIndex: 'od',
        width: 90,
        render: (value) => value ?? '-',
      },
      {
        title: '左眼',
        dataIndex: 'os',
        width: 90,
        render: (value) => value ?? '-',
      },
      {
        title: '平均度数',
        dataIndex: 'avgDegree',
        width: 110,
        render: (value) => (value ? value.toFixed(1) : '-'),
      },
      {
        title: '风险等级',
        dataIndex: 'riskLevel',
        width: 120,
        render: (value) => {
          const colorMap = {
            正常关注: 'blue',
            轻度预警: 'green',
            中度预警: 'orange',
            高度预警: 'red',
          }
          return <Tag color={colorMap[value] ?? 'default'}>{value || '正常关注'}</Tag>
        },
      },
      {
        title: '戴眼镜',
        dataIndex: 'hasGlasses',
        width: 100,
        render: (value) => (value ? '是' : '否'),
      },
      {
        title: '最近筛查',
        dataIndex: 'eyesTime',
        width: 180,
        render: (value) => formatTime(value),
      },
    ]
  }, [])

  const summaryItems = useMemo(() => {
    const summary = dashboard?.summary
    return [
      { key: 'school', label: '覆盖学校', value: summary?.schoolCount ?? 0, suffix: '所' },
      { key: 'class', label: '班级总量', value: summary?.classCount ?? 0, suffix: '个' },
      { key: 'student', label: '学生总量', value: summary?.studentCount ?? 0, suffix: '人' },
      { key: 'avg', label: '平均近视度数', value: summary?.avgDegree ?? 0, precision: 1 },
      { key: 'glasses', label: '戴镜比例', value: summary?.glassesRate ?? 0, suffix: '%' },
      { key: 'visit', label: '当日就诊量', value: summary?.todayVisitCount ?? 0, suffix: '次' },
    ]
  }, [dashboard])

  const hasDashboardData = Boolean(dashboard)
  const canManage = useMemo(() => {
    const points = account?.permissionPoints
    const hasManagerPoint =
      Array.isArray(points) &&
      points.some((p) => (typeof p === 'string' ? p === 'manager' : p?.name === 'manager'))
    return account?.roleId === 'admin' || hasManagerPoint
  }, [account])

  return (
    <div className="overviewRoot">
      <div className="overviewGlow overviewGlowA" />
      <div className="overviewGlow overviewGlowB" />
      <div className="overviewGridTexture" />

      <div className="overviewWrap">
        <div className="overviewTopbar">
          <div className="overviewHero">
            <div className="overviewEyebrow">区域性儿童青少年近视防控</div>
            <Title level={2} className="overviewTitle theme-gradient-title">
              近视防控总览大屏
            </Title>
            <Text className="overviewSubtitle">
              聚合学校筛查、学生检索、就诊趋势与实时班级检测结果，帮助快速掌握当前区域近视防控态势。
            </Text>
            <div className="overviewMetaRow">
              <Tag className="overviewMetaTag">当前用户：{account?.name ?? account?.accountName ?? '-'}</Tag>
              <Tag className="overviewMetaTag">角色：{account?.roleId ?? '-'}</Tag>
              <Tag className="overviewMetaTag">更新时间：{formatTime(dashboard?.updatedAt)}</Tag>
            </div>
          </div>

          <div className="overviewActionBox">
            <div className="overviewActionLabel">系统操作</div>
            <div className="overviewActionGroup">
    
              <div className="overviewActionActions">
              <Button
                type="primary"
                className="overviewEntryBtn"
                disabled={!canManage}
                onClick={() => navigate('/allback/auth')}
              >
                进入后台管理
              </Button>
                <LogoutEntry className="overviewLogoutBtn" onLogout={onLogout}>
                  退出登录
                </LogoutEntry>
              </div>
            </div>
          </div>
        </div>

        {dashboardLoading ? (
          <div className="overviewLoading">
            <Spin size="large" />
          </div>
        ) : !hasDashboardData ? (
          <Card className="overviewEmptyCard" variant="borderless">
            <Empty description="暂时无法加载总览数据，请稍后重试" />
          </Card>
        ) : (
          <>
            <div className="overviewMetricGrid">
              {summaryItems.map((item) => (
                <Card key={item.key} variant="borderless" className="overviewMetricCard">
                  <div className="overviewMetricLabel">{item.label}</div>
                  <Statistic
                    value={item.value}
                    precision={item.precision}
                    suffix={item.suffix}
                    valueStyle={{ color: '#172554', fontWeight: 800 }}
                  />
                </Card>
              ))}
            </div>

            <div className="overviewPanelGrid">
              <Card
                variant="borderless"
                className="overviewPanel overviewPanelLarge"
                title={<span className="overviewPanelTitle">学校平均近视度数排名</span>}
                extra={<Text className="overviewPanelExtra">按学生平均近视度数排序</Text>}
              >
                <OverviewChart option={rankingOption} height={360} />
              </Card>

              <Card
                variant="borderless"
                className="overviewPanel"
                title={<span className="overviewPanelTitle">近视风险分布</span>}
                extra={<Text className="overviewPanelExtra">基于学生平均近视度数区间</Text>}
              >
                <OverviewChart option={riskOption} height={320} />
              </Card>

              <Card
                variant="borderless"
                className="overviewPanel"
                title={<span className="overviewPanelTitle">近 7 日就诊趋势</span>}
                extra={<Text className="overviewPanelExtra">预约量与实际就诊量对比</Text>}
              >
                <OverviewChart option={trendOption} height={320} />
              </Card>

              <Card
                variant="borderless"
                className="overviewPanel"
                title={<span className="overviewPanelTitle">学校筛查覆盖率</span>}
                extra={<Text className="overviewPanelExtra">按已有视力记录覆盖比例统计</Text>}
              >
                <OverviewChart option={coverageOption} height={320} />
              </Card>

              <Card
                variant="borderless"
                className="overviewPanel"
                title={<span className="overviewPanelTitle">学校戴镜结构</span>}
                extra={<Text className="overviewPanelExtra">各学校佩戴与未佩戴眼镜人数</Text>}
              >
                <OverviewChart option={glassesOption} height={320} />
              </Card>

              <Card
                variant="borderless"
                className="overviewPanel"
                title={<span className="overviewPanelTitle">实时班级检测</span>}
                extra={
                  <Text className="overviewPanelExtra">
                    {realtimeSnapshot?.className ? `${realtimeSnapshot.className} · ${realtimeSnapshot.running ? '检测中' : '最近一次结果'}` : '等待班级检测页推送'}
                  </Text>
                }
              >
                <div className="overviewRealtimeHead">
                  <div className="overviewRealtimeMetric">
                    <div className="overviewRealtimeLabel">当前戴眼镜人数</div>
                    <div className="overviewRealtimeValue">{realtimeSnapshot?.count ?? 0}</div>
                  </div>
                  <div className="overviewRealtimeMeta">
                    <div>识别目标：{realtimeSnapshot?.totalDetections ?? 0}</div>
                    <div>最近时间：{formatTime(realtimeSnapshot?.detectedAt)}</div>
                  </div>
                </div>
                <OverviewChart option={realtimeOption} height={220} />
              </Card>
            </div>

            <Card
              variant="borderless"
              className="overviewSearchPanel"
              title={<span className="overviewPanelTitle">学生数据检索</span>}
              extra={<Text className="overviewPanelExtra">支持按学生姓名、账号、手机号与学校快速检索</Text>}
            >
              <div className="overviewSearchToolbar">
                <Input.Search
                  allowClear
                  placeholder="输入学生姓名、账号或手机号"
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onSearch={() => {
                    setStudentQuery((prev) => ({
                      ...prev,
                      keyword: keywordDraft.trim(),
                      schoolId: schoolDraft,
                      pageNo: 1,
                    }))
                  }}
                  className="overviewSearchInput"
                />
                <Select
                  allowClear
                  placeholder="筛选学校"
                  value={schoolDraft}
                  options={schoolOptions}
                  className="overviewSearchSelect"
                  onChange={(value) => setSchoolDraft(value ?? null)}
                />
                <Button
                  className="overviewSearchBtn"
                  type="primary"
                  onClick={() => {
                    setStudentQuery((prev) => ({
                      ...prev,
                      keyword: keywordDraft.trim(),
                      schoolId: schoolDraft,
                      pageNo: 1,
                    }))
                  }}
                >
                  查询
                </Button>
              </div>

              <Table
                rowKey={(record) => `${record.studentAccountId}-${record.classId}`}
                columns={studentColumns}
                dataSource={studentResult.list}
                loading={studentLoading}
                pagination={{
                  current: studentQuery.pageNo,
                  pageSize: studentQuery.pageSize,
                  total: studentResult.total,
                  showSizeChanger: true,
                  onChange: (pageNo, pageSize) => {
                    setStudentQuery((prev) => ({
                      ...prev,
                      pageNo,
                      pageSize,
                    }))
                  },
                }}
                scroll={{ x: 1360 }}
                className="overviewTable"
              />
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
