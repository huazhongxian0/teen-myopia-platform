import { Badge, Button, Card, Col, Row, Space, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { httpClient } from '../../services/http/index.js'
import { useAccount } from '../../hooks/useAccount.js'
import { WebSocketClient } from '../../services/ws/index.js'
import { publishOverviewRealtimeSnapshot } from '../../services/overviewRealtimeStore.js'
import config from '../../../../shared-config.json'
import './index.css'

const { Title, Text } = Typography

const wsPath = config?.endpoints?.wsNative ?? '/ws-raw'
const defaultWsUrl = `${config.server.wsProtocol}://${config.server.domain}:${config.server.port}${wsPath}`

function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function formatTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

function normalizeClassKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function isNegativeGlassesKey(normalizedKey) {
  return [
    'noglasses',
    'withoutglasses',
    'notwearingglasses',
    'nowearingglasses',
    '未戴眼镜',
    '未佩戴眼镜',
    '不戴眼镜',
    '无眼镜',
    '未戴镜',
    '未佩戴眼镜者',
  ].some((keyword) => normalizedKey.includes(keyword))
}

function isPositiveGlassesKey(normalizedKey) {
  if (!normalizedKey || isNegativeGlassesKey(normalizedKey)) return false
  return [
    'glasses',
    'glass',
    'eyeglasses',
    'wearingglasses',
    'wearglasses',
    'withglasses',
    '戴眼镜',
    '佩戴眼镜',
    '戴镜',
    '眼镜',
  ].some((keyword) => normalizedKey.includes(keyword))
}

function pickPrimaryCount(classCounts, totalDetections) {
  const entries = Object.entries(classCounts ?? {})
  for (const [key, value] of entries) {
    const normalizedKey = normalizeClassKey(key)
    if (isPositiveGlassesKey(normalizedKey)) {
      return Math.max(Number(value) || 0, 0)
    }
  }
  if (entries.length === 0) {
    return Math.max(Number(totalDetections) || 0, 0)
  }
  return Math.max(Number(totalDetections) || 0, 0)
}

function normalizeRealtimePayload(props) {
  const totalDetections = typeof props?.totalDetections === 'number' ? props.totalDetections : 0
  const classCounts = props?.classCounts && typeof props.classCounts === 'object' ? props.classCounts : {}
  return {
    count: typeof props?.count === 'number' ? props.count : pickPrimaryCount(classCounts, totalDetections),
    totalDetections,
    classCounts,
    detectedAt: typeof props?.detectedAt === 'number' ? props.detectedAt : Date.now(),
  }
}

function normalizeUploadResponse(data) {
  const summary = data?.summary && typeof data.summary === 'object' ? data.summary : {}
  const totalDetections = typeof summary?.totalDetections === 'number' ? summary.totalDetections : 0
  const classCounts = summary?.classCounts && typeof summary.classCounts === 'object' ? summary.classCounts : {}
  return {
    fileName: data?.originalFilename || '-',
    count: pickPrimaryCount(classCounts, totalDetections),
    totalDetections,
    classCounts,
    detectedAt: Date.now(),
    status: data?.status || '-',
  }
}

function humanizeDetectionError(text) {
  const rawText = String(text ?? '').trim()
  if (!rawText) return '实时检测失败'
  if (rawText.includes('MODEL_PATH_NOT_CONFIGURED') || rawText.includes('MODEL_FILE_NOT_FOUND')) {
    return '当前未找到基于 glassess 数据集训练的眼镜识别模型，请先执行 glassess/train_glasses_model.sh 生成 best.pt'
  }
  if (rawText.includes('DETECTION_FAILED:')) {
    return rawText.replace('DETECTION_FAILED:', '').trim() || '模型推理失败'
  }
  if (rawText.includes('DETECTION_PROCESS_FAILED:')) {
    return rawText.replace('DETECTION_PROCESS_FAILED:', '').trim() || '模型进程执行失败'
  }
  return rawText
}

export default function ClassCameraDetectPage({ classInfo, onBack }) {
  const { token } = useAccount()
  const classId = classInfo?.id ?? null
  const className = classInfo?.name ?? '-'

  const [running, setRunning] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [count, setCount] = useState(null)
  const [totalDetections, setTotalDetections] = useState(0)
  const [classCounts, setClassCounts] = useState({})
  const [detectedAt, setDetectedAt] = useState(null)
  const [errorText, setErrorText] = useState('')
  const [history, setHistory] = useState([])
  const [wsStatus, setWsStatus] = useState('未连接')
  const [cameraReady, setCameraReady] = useState(false)
  const [manualFile, setManualFile] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)

  const tickRef = useRef(null)
  const wsClientRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const runningRef = useRef(false)

  const classCountsText = useMemo(() => {
    const entries = Object.entries(classCounts ?? {})
    if (entries.length === 0) return '暂无类别结果'
    return entries.map(([key, value]) => `${key} ${value}`).join(' / ')
  }, [classCounts])

  const status = useMemo(() => {
    if (!classId) return { color: 'red', text: '缺少班级信息' }
    if (errorText) return { color: 'red', text: '检测异常' }
    if (running && cameraReady) return { color: 'green', text: '检测中' }
    if (running) return { color: 'processing', text: '连接中' }
    return { color: 'default', text: '未启动' }
  }, [cameraReady, classId, errorText, running])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    const client = new WebSocketClient({
      url: import.meta.env.VITE_WS_URL ?? defaultWsUrl,
      reconnect: true,
      minDelay: 1000,
      maxDelay: 10000,
      backoff: 1.5,
      heartbeatInterval: 20000,
      heartbeatPayload: JSON.stringify({ type: 'heartbeat' }),
    })
    wsClientRef.current = client
    setWsStatus('连接中')

    const offOpen = client.on('open', () => {
      setWsStatus('已连接')
      if (runningRef.current && classId && token) {
        client.sendJson({
          type: 'yolo.realtime.start',
          token,
          classId,
          className,
          conf: 0.25,
          iou: 0.45,
          imgsz: 640,
        })
      }
    })
    const offClose = client.on('close', () => {
      setWsStatus('已断开')
    })
    const offReconnect = client.on('reconnect', ({ retries }) => {
      setWsStatus(`重连中(${retries})`)
    })
    const offError = client.on('error', () => {
      setWsStatus('连接异常')
    })
    const offMessage = client.on('message', (event) => {
      const payload = safeJsonParse(event?.data)
      if (!payload || typeof payload !== 'object') return
      const key = payload?.key
      const props = payload?.props ?? {}
      if (key === 'yolo:realtime:update') {
        const normalized = normalizeRealtimePayload(props)
        setErrorText('')
        setCount(normalized.count)
        setTotalDetections(normalized.totalDetections)
        setClassCounts(normalized.classCounts)
        setDetectedAt(normalized.detectedAt)
        publishOverviewRealtimeSnapshot({
          classId,
          className,
          count: normalized.count,
          totalDetections: normalized.totalDetections,
          classCounts: normalized.classCounts,
          detectedAt: normalized.detectedAt,
          running: true,
          source: '实时检测',
        })
        setHistory((prev) => [{ at: normalized.detectedAt, count: normalized.count, source: '实时检测' }, ...prev].slice(0, 10))
        return
      }
      if (key === 'yolo:realtime:error') {
        const text = humanizeDetectionError(props?.message || '实时检测失败')
        setErrorText(text)
        return
      }
      if (key === 'yolo:realtime:status') {
        setWsStatus(props?.running ? '实时检测中' : '已连接')
      }
    })

    client.connect().catch(() => {
      setWsStatus('连接失败')
    })

    return () => {
      offOpen()
      offClose()
      offReconnect()
      offError()
      offMessage()
      client.close()
      wsClientRef.current = null
    }
  }, [classId, className, token])

  function stopCameraStream() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }

  async function ensureCameraReady() {
    if (streamRef.current && cameraReady) return true
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头能力')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      audio: false,
    })
    streamRef.current = stream

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => null)
    }
    setCameraReady(true)
    return true
  }

  async function ensureWsConnected() {
    const client = wsClientRef.current
    if (!client) throw new Error('实时连接未初始化')
    if (client.isOpen) return client
    await client.connect()
    return client
  }

  function ensureRealtimeSessionActive(client) {
    console.log('[前端DEBUG] ensureRealtimeSessionActive 开始检查', { isOpen: client?.isOpen, running: runningRef.current })
    if (!client?.isOpen) {
      console.log('[前端DEBUG] ❌ 客户端未打开')
      return false
    }
    if (runningRef.current) {
      console.log('[前端DEBUG] ✅ 已在运行中，跳过 start')
      return true
    }
    console.log('[前端DEBUG] 📤 发送 yolo.realtime.start...')
    client.sendJson({
      type: 'yolo.realtime.start',
      token,
      classId,
      className,
      conf: 0.25,
      iou: 0.45,
      imgsz: 640,
    })
    console.log('[前端DEBUG] ✅ start 已发送')
    return true
  }

  function pushHistory(nextCount, nextAt, source) {
    setHistory((prev) => [{ at: nextAt, count: nextCount, source }, ...prev].slice(0, 10))
  }

  async function captureAndSendFrame({ silent = false } = {}) {
    console.log('[前端DEBUG] ===== captureAndSendFrame 开始 =====')
    if (!classId) {
      console.log('[前端DEBUG] ❌ 没有 classId，退出')
      return
    }
    if (!token) {
      const text = '当前登录态无效，请重新登录'
      console.log('[前端DEBUG] ❌ 没有 token')
      setErrorText(text)
      if (!silent) message.error(text)
      return
    }
    try {
      console.log('[前端DEBUG] 📷 准备获取摄像头...')
      await ensureCameraReady()
      console.log('[前端DEBUG] ✅ 摄像头就绪')
      
      console.log('[前端DEBUG] 🔌 准备连接 WebSocket...')
      const client = await ensureWsConnected()
      console.log('[前端DEBUG] ✅ WebSocket 已连接', { isOpen: client.isOpen })
      
      console.log('[前端DEBUG] 🎯 确保实时会话活跃...')
      if (!ensureRealtimeSessionActive(client)) {
        const text = '实时连接不可用'
        console.log('[前端DEBUG] ❌ 实时会话激活失败')
        setErrorText(text)
        if (!silent) message.error(text)
        return
      }

      console.log('[前端DEBUG] ⏳ 等待 300ms 让后端处理 start...')
      await new Promise(resolve => setTimeout(resolve, 300))

      console.log('[前端DEBUG] 🔁 二次检查连接状态...')
      const client2 = await ensureWsConnected()
      if (!client2?.isOpen) {
        const text = 'WebSocket 连接已断开'
        console.log('[前端DEBUG] ❌ 二次检查发现连接断开')
        setErrorText(text)
        if (!silent) message.error(text)
        return
      }
      console.log('[前端DEBUG] ✅ 二次检查通过，连接正常')
      
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) {
        console.log('[前端DEBUG] ❌ video 或 canvas 不存在')
        return
      }
      const width = video.videoWidth || 960
      const height = video.videoHeight || 540
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.log('[前端DEBUG] ❌ 无法获取 2d context')
        return
      }
      ctx.drawImage(video, 0, 0, width, height)
      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.4)
      console.log('[前端DEBUG] 📸 帧已捕获，大小:', frameDataUrl.length)

      const frameMessage = {
        type: 'yolo.realtime.frame',
        token,
        classId,
        className,
        frameDataUrl,
      }
      const frameJsonStr = JSON.stringify(frameMessage)
      console.log('[前端DEBUG] 📏 帧消息JSON大小:', frameJsonStr.length, '字节')
      
      console.log('[前端DEBUG] 🚀 发送 yolo.realtime.frame...')
      console.log('[前端DEBUG] 🔍 发送前连接状态:', {
        readyState: client._ws?.readyState,
        isOpen: client.isOpen,
        wsExists: !!client._ws,
        wsUrl: client._ws?.url
      })

      try {
        client.sendJson(frameMessage)
        console.log('[前端DEBUG] ✅ sendJson 执行完成')

        await new Promise(resolve => setTimeout(resolve, 200))

        const postSendStatus = {
          readyState: client._ws?.readyState,
          isOpen: client.isOpen,
          wsExists: !!client._ws,
          bufferedAmount: client._ws?.bufferedAmount ?? 0
        }
        console.log('[前端DEBUG] 🔍 发送后200ms连接状态:', postSendStatus)

        if (!postSendStatus.wsExists || postSendStatus.readyState !== 1) {
          console.warn('[前端DEBUG] ⚠️ WebSocket 在发送后断开! 可能原因: 后端处理帧时关闭了连接')
        }

        console.log('[前端DEBUG] ✅ frame 已发送')
      } catch (sendErr) {
        console.error('[前端DEBUG] ❌ sendJson 抛出异常:', sendErr.message)
        throw sendErr
      }
    } catch (e) {
      const text = e?.message || '发送检测帧失败'
      console.log('[前端DEBUG] ❌ 异常:', text, e)
      setErrorText(text)
      if (!silent) message.error(text)
    }
  }

  async function startRealtimeDetection() {
    if (!classId) return
    if (!token) {
      message.error('当前登录态无效，请重新登录')
      return
    }
    try {
      setActionLoading(true)
      setErrorText('')
      await ensureCameraReady()
      const client = await ensureWsConnected()
      client.sendJson({
        type: 'yolo.realtime.start',
        token,
        classId,
        className,
        conf: 0.25,
        iou: 0.45,
        imgsz: 640,
      })
      setRunning(true)
      await captureAndSendFrame({ silent: true })
      tickRef.current = window.setInterval(() => {
        void captureAndSendFrame({ silent: true })
      }, 1600)
    } catch (e) {
      const text = e?.message || '启动实时检测失败'
      setErrorText(text)
      message.error(text)
    } finally {
      setActionLoading(false)
    }
  }

  function stopRealtimeDetection() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    setRunning(false)
    const client = wsClientRef.current
    if (client?.isOpen) {
      client.sendJson({
        type: 'yolo.realtime.stop',
        token,
        classId,
      })
    }
    publishOverviewRealtimeSnapshot({
      classId,
      className,
      count: typeof count === 'number' ? count : 0,
      totalDetections,
      classCounts,
      detectedAt: detectedAt ?? Date.now(),
      running: false,
      source: '实时检测',
    })
    stopCameraStream()
  }

  async function handleUploadDetect() {
    if (!manualFile) {
      message.warning('请先选择要检测的视频文件')
      return
    }
    try {
      setUploadLoading(true)
      setErrorText('')
      const formData = new FormData()
      formData.append('video', manualFile)
      formData.append('conf', '0.25')
      formData.append('iou', '0.45')
      formData.append('imgsz', '640')
      const data = await httpClient.post('/api/yoloDetection/detect', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      const normalized = normalizeUploadResponse(data)
      setUploadResult(normalized)
      setCount(normalized.count)
      setTotalDetections(normalized.totalDetections)
      setClassCounts(normalized.classCounts)
      setDetectedAt(normalized.detectedAt)
      publishOverviewRealtimeSnapshot({
        classId,
        className,
        count: normalized.count,
        totalDetections: normalized.totalDetections,
        classCounts: normalized.classCounts,
        detectedAt: normalized.detectedAt,
        running: false,
        source: '上传检测',
      })
      pushHistory(normalized.count, normalized.detectedAt, '上传检测')
      message.success('视频检测完成')
    } catch (e) {
      const text = humanizeDetectionError(e?.message || '上传检测失败')
      setErrorText(text)
      message.error(text)
    } finally {
      setUploadLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      stopCameraStream()
    }
  }, [])

  useEffect(() => {
    setActionLoading(false)
    setUploadLoading(false)
    setCount(null)
    setTotalDetections(0)
    setClassCounts({})
    setDetectedAt(null)
    setErrorText('')
    setHistory([])
    setManualFile(null)
    setUploadResult(null)
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    setRunning(false)
    const client = wsClientRef.current
    if (client?.isOpen) {
      client.sendJson({
        type: 'yolo.realtime.stop',
        token,
        classId,
      })
    }
    stopCameraStream()
  }, [classId, token])

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
              {className} · 基于 glassess 数据集训练模型统计当前画面中戴眼镜同学数量
            </Text>
          </div>
        </div>

        <Space size={10} wrap className="ccdTopbarRight">
          <Button
            type={running ? 'default' : 'primary'}
            onClick={() => {
              if (running) {
                stopRealtimeDetection()
                return
              }
              void startRealtimeDetection()
            }}
            loading={actionLoading}
            disabled={!classId}
            className={running ? 'ccdBtnStop' : 'ccdBtnStart'}
          >
            {running ? '停止检测' : '启动检测'}
          </Button>
          <Button
            onClick={() => {
              void captureAndSendFrame()
            }}
            loading={actionLoading}
            disabled={!classId}
          >
            抓取一次
          </Button>
        </Space>
      </div>

      <div className="ccdGrid">
        <Card className="ccdVideoCard" variant="borderless">
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
              {cameraReady ? (
                <video ref={videoRef} className="ccdVideoPlayer" muted playsInline autoPlay />
              ) : null}
              <canvas ref={canvasRef} className="ccdCanvas" />
              <div className="ccdScanLine" />
              <div className="ccdVideoNoise" />
              <div className="ccdVideoCenter">
                <div className="ccdReticle" />
                <div className="ccdVideoHint">
                  <div className="ccdHintTitle">{cameraReady ? '摄像头已接入' : '等待接入班级摄像头'}</div>
                  <div className="ccdHintDesc">
                    {cameraReady
                      ? '页面会实时显示班级摄像头画面，并使用基于 glassess 数据集训练的模型更新戴眼镜人数'
                      : '点击“启动检测”后将申请浏览器摄像头权限，并开始实时推送到眼镜识别模型'}
                  </div>
                </div>
              </div>
              <div className="ccdOverlay">
                <div className="ccdOverlayItem">
                  <div className="ccdOverlayKey">实时状态</div>
                  <div className="ccdOverlayVal">{running ? '进行中' : '未启动'}</div>
                </div>
                <div className="ccdOverlayItem">
                  <div className="ccdOverlayKey">戴眼镜</div>
                  <div className="ccdOverlayVal">{typeof count === 'number' ? String(count) : '-'}</div>
                </div>
                <div className="ccdOverlayItem">
                  <div className="ccdOverlayKey">连接</div>
                  <div className="ccdOverlayVal">{wsStatus}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="ccdSide">
          <Card className="ccdMetricCard" variant="borderless">
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
                <div className="ccdMetricSubVal">{running ? '摄像头实时检测' : uploadResult ? '上传视频检测' : '待机'}</div>
              </div>
              <div className="ccdMetricSub">
                <div className="ccdMetricSubKey">识别目标总数</div>
                <div className="ccdMetricSubVal">{totalDetections || 0}</div>
              </div>
              <div className="ccdMetricSub">
                <div className="ccdMetricSubKey">类别分布</div>
                <div className="ccdMetricSubVal">{classCountsText}</div>
              </div>
              {errorText ? (
                <div className="ccdErrorBox" role="alert">
                  <div className="ccdErrorTitle">检测异常</div>
                  <div className="ccdErrorDesc">{errorText}</div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="ccdUploadCard" variant="borderless">
            <div className="ccdUploadHead">
              <div>
                <div className="ccdUploadTitle">上传文件检测</div>
                <div className="ccdUploadDesc">上传视频后调用现有接口完成一次性检测</div>
              </div>
              <Tag color="blue">HTTP 接口</Tag>
            </div>
            <div className="ccdUploadActions">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="ccdFileInput"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setManualFile(file)
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                {manualFile ? '重新选择视频' : '选择视频'}
              </Button>
              <Button type="primary" loading={uploadLoading} onClick={() => void handleUploadDetect()}>
                开始检测
              </Button>
            </div>
            <div className="ccdUploadMeta">
              <div className="ccdUploadMetaItem">
                <span className="ccdUploadMetaKey">当前文件</span>
                <span className="ccdUploadMetaVal">{manualFile?.name || '未选择文件'}</span>
              </div>
              <div className="ccdUploadMetaItem">
                <span className="ccdUploadMetaKey">最近结果</span>
                <span className="ccdUploadMetaVal">
                  {uploadResult ? `${uploadResult.fileName} · ${uploadResult.totalDetections} 个目标` : '暂无'}
                </span>
              </div>
            </div>
          </Card>

          <Card className="ccdHistoryCard" variant="borderless" title={<span className="ccdHistoryTitle">检测记录（最近 10 次）</span>}>
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
                      <div className="ccdHistoryHint">{item.source || '检测结果'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="ccdGuideCard" variant="borderless">
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
