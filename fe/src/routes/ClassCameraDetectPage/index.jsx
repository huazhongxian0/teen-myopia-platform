import { Badge, Button, Card, Col, Row, Space, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { httpClient } from '../../services/http/index.js'
import './index.css'

const { Title, Text } = Typography

function formatTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

function normalizeCountResponse(data) {
  if (typeof data === 'number') {
    return { count: data, detectedAt: Date.now() }
  }
  if (data && typeof data === 'object') {
    const count = typeof data.count === 'number' ? data.count : typeof data.glassesCount === 'number' ? data.glassesCount : null
    const detectedAt =
      typeof data.detectedAt === 'number'
        ? data.detectedAt
        : typeof data.timestamp === 'number'
          ? data.timestamp
          : Date.now()
    return { count, detectedAt }
  }
  return { count: null, detectedAt: Date.now() }
}

export default function ClassCameraDetectPage({ classInfo, onBack }) {
  const classId = classInfo?.id ?? null
  const className = classInfo?.name ?? '-'

  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(null)
  const [detectedAt, setDetectedAt] = useState(null)
  const [errorText, setErrorText] = useState('')
  const [history, setHistory] = useState([])

  const tickRef = useRef(null)

  const status = useMemo(() => {
    if (!classId) return { color: 'red', text: '缺少班级信息' }
    if (errorText) return { color: 'red', text: '检测异常' }
    if (running) return { color: 'green', text: '检测中' }
    return { color: 'default', text: '未启动' }
  }, [classId, errorText, running])

  async function pullOnce({ silent } = { silent: false }) {
    if (!classId) return
    try {
      setLoading(true)
      setErrorText('')
      const data = await httpClient.post('/api/camera/class/glasses/count', { classId })
      const normalized = normalizeCountResponse(data)
      if (typeof normalized.count === 'number') {
        setCount(normalized.count)
      } else {
        setCount(null)
      }
      setDetectedAt(normalized.detectedAt || Date.now())
      if (typeof normalized.count === 'number') {
        setHistory((prev) => [{ at: normalized.detectedAt || Date.now(), count: normalized.count }, ...prev].slice(0, 10))
      }
    } catch (e) {
      const text = e?.message || '检测服务不可用'
      setErrorText(text)
      if (!silent) {
        message.error(text)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!running) return
    if (!classId) return
    void pullOnce({ silent: true })
    tickRef.current = window.setInterval(() => {
      void pullOnce({ silent: true })
    }, 5000)
    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [running, classId])

  useEffect(() => {
    setRunning(false)
    setLoading(false)
    setCount(null)
    setDetectedAt(null)
    setErrorText('')
    setHistory([])
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [classId])

  return (
    <div className="ccdRoot">
      <div className="ccdGlow ccdGlowA" />
      <div className="ccdGlow ccdGlowB" />

      <div className="ccdTopbar">
        <div className="ccdTopbarLeft">
          {onBack ? (
            <Button onClick={onBack} className="ccdBackBtn">
              返回
            </Button>
          ) : null}
          <div>
            <div className="ccdTitleRow">
              <Title level={4} className="ccdTitle">
                班级摄像头检测
              </Title>
              <Tag color={status.color} className="ccdStatusTag">
                {status.text}
              </Tag>
              {running ? (
                <Badge status="processing" text={<span className="ccdLiveText">实时</span>} />
              ) : (
                <Badge status="default" text={<span className="ccdLiveText">待机</span>} />
              )}
            </div>
            <Text className="ccdSubtitle">
              {className} · 统计当前画面中戴眼镜同学数量
            </Text>
          </div>
        </div>

        <Space size={10} wrap className="ccdTopbarRight">
          <Button
            type={running ? 'default' : 'primary'}
            onClick={() => {
              if (!classId) return
              setRunning((v) => !v)
              if (!running) {
                void pullOnce()
              }
            }}
            loading={loading}
            disabled={!classId}
            className={running ? 'ccdBtnStop' : 'ccdBtnStart'}
          >
            {running ? '停止检测' : '启动检测'}
          </Button>
          <Button
            onClick={() => {
              void pullOnce()
            }}
            loading={loading}
            disabled={!classId}
          >
            抓取一次
          </Button>
        </Space>
      </div>

      <div className="ccdGrid">
        <Card className="ccdVideoCard" bordered={false}>
          <div className="ccdVideoShell">
            <div className="ccdVideoHeader">
              <div className="ccdVideoHeaderLeft">
                <div className="ccdDot ccdDotGreen" />
                <div className="ccdDot ccdDotYellow" />
                <div className="ccdDot ccdDotRed" />
                <Text className="ccdVideoTitle">监控画面</Text>
              </div>
              <Text className="ccdVideoMeta">{detectedAt ? `最近更新：${formatTime(detectedAt)}` : '等待首次抓取'}</Text>
            </div>

            <div className="ccdVideoViewport" aria-label="摄像头画面占位">
              <div className="ccdScanLine" />
              <div className="ccdVideoNoise" />
              <div className="ccdVideoCenter">
                <div className="ccdReticle" />
                <div className="ccdVideoHint">
                  <div className="ccdHintTitle">等待接入班级摄像头</div>
                  <div className="ccdHintDesc">当前为占位画面，接口接入后可替换为真实视频流</div>
                </div>
              </div>
              <div className="ccdOverlay">
                <div className="ccdOverlayItem">
                  <div className="ccdOverlayKey">识别</div>
                  <div className="ccdOverlayVal">{running ? '进行中' : '未启动'}</div>
                </div>
                <div className="ccdOverlayItem">
                  <div className="ccdOverlayKey">戴眼镜</div>
                  <div className="ccdOverlayVal">{typeof count === 'number' ? String(count) : '-'}</div>
                </div>
                <div className="ccdOverlayItem">
                  <div className="ccdOverlayKey">班级</div>
                  <div className="ccdOverlayVal">{className}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="ccdSide">
          <Card className="ccdMetricCard" bordered={false}>
            <div className="ccdMetricHead">
              <div>
                <div className="ccdMetricLabel">当前戴眼镜人数</div>
                <div className="ccdMetricValue">{typeof count === 'number' ? count : '-'}</div>
              </div>
              <div className="ccdMetricPill">{running ? '实时' : '待机'}</div>
            </div>
            <div className="ccdMetricFoot">
              <div className="ccdMetricSub">
                <div className="ccdMetricSubKey">最近更新时间</div>
                <div className="ccdMetricSubVal">{formatTime(detectedAt)}</div>
              </div>
              <div className="ccdMetricSub">
                <div className="ccdMetricSubKey">检测来源</div>
                <div className="ccdMetricSubVal">班级摄像头识别服务</div>
              </div>
              {errorText ? (
                <div className="ccdErrorBox" role="alert">
                  <div className="ccdErrorTitle">检测异常</div>
                  <div className="ccdErrorDesc">{errorText}</div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="ccdHistoryCard" bordered={false} title={<span className="ccdHistoryTitle">检测记录（最近 10 次）</span>}>
            {history.length === 0 ? (
              <div className="ccdEmptyHistory">
                <Text type="secondary">暂无记录，点击“抓取一次”或“启动检测”</Text>
              </div>
            ) : (
              <div className="ccdHistoryList">
                {history.map((item) => (
                  <div className="ccdHistoryItem" key={`${item.at}-${item.count}`}>
                    <div className="ccdHistoryLeft">
                      <div className="ccdHistoryCount">{item.count}</div>
                      <div className="ccdHistoryUnit">人</div>
                    </div>
                    <div className="ccdHistoryRight">
                      <div className="ccdHistoryTime">{formatTime(item.at)}</div>
                      <div className="ccdHistoryHint">戴眼镜同学</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="ccdGuideCard" bordered={false}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <div className="ccdGuideItem">
                  <div className="ccdGuideNum">01</div>
                  <div className="ccdGuideText">选择班级</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="ccdGuideItem">
                  <div className="ccdGuideNum">02</div>
                  <div className="ccdGuideText">启动检测</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="ccdGuideItem">
                  <div className="ccdGuideNum">03</div>
                  <div className="ccdGuideText">查看人数</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="ccdGuideItem">
                  <div className="ccdGuideNum">04</div>
                  <div className="ccdGuideText">留存记录</div>
                </div>
              </Col>
            </Row>
          </Card>
        </div>
      </div>
    </div>
  )
}
