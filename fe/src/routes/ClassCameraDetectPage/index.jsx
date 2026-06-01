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
const realtimeStartWaitMs = 80
const realtimeNextFrameDelayMs = 120
const realtimeRecoverFrameDelayMs = 180
const realtimeRetryFrameDelayMs = 220
const realtimeCaptureMaxWidth = 640
const realtimeHistoryThrottleMs = 800

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

function normalizeDetections(detections) {
  if (!Array.isArray(detections)) return []
  return detections
    .map((item) => ({
      className: String(item?.className ?? ''),
      confidence: Number(item?.confidence) || 0,
      x1: Number(item?.x1) || 0,
      y1: Number(item?.y1) || 0,
      x2: Number(item?.x2) || 0,
      y2: Number(item?.y2) || 0,
      imageWidth: Number(item?.imageWidth) || 0,
      imageHeight: Number(item?.imageHeight) || 0,
    }))
    .filter((item) => item.imageWidth > 0 && item.imageHeight > 0 && item.x2 > item.x1 && item.y2 > item.y1)
}

function mapDetectionToViewport(detection, viewportSize) {
  const viewportWidth = Number(viewportSize?.width) || 0
  const viewportHeight = Number(viewportSize?.height) || 0
  if (!viewportWidth || !viewportHeight) return null

  const sourceWidth = detection.imageWidth
  const sourceHeight = detection.imageHeight
  if (!sourceWidth || !sourceHeight) return null

  const scale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight)
  const renderWidth = sourceWidth * scale
  const renderHeight = sourceHeight * scale
  const offsetX = (viewportWidth - renderWidth) / 2
  const offsetY = (viewportHeight - renderHeight) / 2

  return {
    left: offsetX + detection.x1 * scale,
    top: offsetY + detection.y1 * scale,
    width: (detection.x2 - detection.x1) * scale,
    height: (detection.y2 - detection.y1) * scale,
    className: detection.className,
    confidence: detection.confidence,
  }
}

function normalizeRealtimePayload(props) {
  const totalDetections = typeof props?.totalDetections === 'number' ? props.totalDetections : 0
  const classCounts = props?.classCounts && typeof props.classCounts === 'object' ? props.classCounts : {}
  return {
    count: typeof props?.count === 'number' ? props.count : pickPrimaryCount(classCounts, totalDetections),
    totalDetections,
    classCounts,
    detections: normalizeDetections(props?.detections),
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
    detections: normalizeDetections(summary?.detections),
  }
}

function formatClassCounts(classCounts) {
  const entries = Object.entries(classCounts ?? {})
  if (entries.length === 0) return '暂无类别结果'
  return entries.map(([key, value]) => `${key} ${value}`).join(' / ')
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
  const [detections, setDetections] = useState([])
  const [detectedAt, setDetectedAt] = useState(null)
  const [errorText, setErrorText] = useState('')
  const [history, setHistory] = useState([])
  const [wsStatus, setWsStatus] = useState('未连接')
  const [cameraReady, setCameraReady] = useState(false)
  const [manualFile, setManualFile] = useState(null)
  const [manualPreviewUrl, setManualPreviewUrl] = useState('')
  const [uploadResult, setUploadResult] = useState(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [uploadViewportSize, setUploadViewportSize] = useState({ width: 0, height: 0 })

  const tickRef = useRef(null)
  const wsClientRef = useRef(null)
  const videoRef = useRef(null)
  const viewportRef = useRef(null)
  const uploadViewportRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const runningRef = useRef(false)
  const frameInFlightRef = useRef(false)
  const sessionReadyRef = useRef(false)
  const lastHistoryAtRef = useRef(0)
  const captureCanvasRef = useRef(null)
  const captureContextRef = useRef(null)

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

  const overlayDetections = useMemo(() => {
    return detections
      .filter((item) => isPositiveGlassesKey(normalizeClassKey(item.className)))
      .map((item) => mapDetectionToViewport(item, viewportSize))
      .filter(Boolean)
  }, [detections, viewportSize])

  const uploadOverlayDetections = useMemo(() => {
    return (uploadResult?.detections ?? [])
      .filter((item) => isPositiveGlassesKey(normalizeClassKey(item.className)))
      .map((item) => mapDetectionToViewport(item, uploadViewportSize))
      .filter(Boolean)
  }, [uploadResult, uploadViewportSize])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    if (!cameraReady) return
    if (!streamRef.current) return
    if (!videoRef.current) return
    if (videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
    void videoRef.current.play().catch(() => null)
  }, [cameraReady])

  function clearLoopTimer() {
    if (tickRef.current) {
      window.clearTimeout(tickRef.current)
      tickRef.current = null
    }
  }

  function releaseFrameInFlight() {
    frameInFlightRef.current = false
  }

  function scheduleNextFrame(delay = realtimeNextFrameDelayMs) {
    if (!runningRef.current) return
    clearLoopTimer()
    tickRef.current = window.setTimeout(() => {
      void captureAndSendFrame({ silent: true, fromLoop: true })
    }, delay)
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined

    const updateViewportSize = () => {
      setViewportSize({
        width: viewport.clientWidth || 0,
        height: viewport.clientHeight || 0,
      })
    }

    updateViewportSize()
    const observer = new ResizeObserver(() => {
      updateViewportSize()
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const viewport = uploadViewportRef.current
    if (!viewport) return undefined

    const updateViewportSize = () => {
      setUploadViewportSize({
        width: viewport.clientWidth || 0,
        height: viewport.clientHeight || 0,
      })
    }

    updateViewportSize()
    const observer = new ResizeObserver(() => {
      updateViewportSize()
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [manualPreviewUrl, uploadResult])

  useEffect(() => {
    if (!manualFile) {
      setManualPreviewUrl('')
      return undefined
    }
    const objectUrl = URL.createObjectURL(manualFile)
    setManualPreviewUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [manualFile])

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
      sessionReadyRef.current = false
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
      sessionReadyRef.current = false
      releaseFrameInFlight()
    })
    const offReconnect = client.on('reconnect', ({ retries }) => {
      setWsStatus(`重连中(${retries})`)
      sessionReadyRef.current = false
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
        sessionReadyRef.current = true
        setErrorText('')
        setCount(normalized.count)
        setTotalDetections(normalized.totalDetections)
        setClassCounts(normalized.classCounts)
        setDetections(normalized.detections)
        setDetectedAt(normalized.detectedAt)
        setWsStatus('实时检测中')
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
        pushHistoryThrottled(normalized.count, normalized.detectedAt, '实时检测')
        return
      }
      if (key === 'yolo:realtime:error') {
        const text = humanizeDetectionError(props?.message || '实时检测失败')
        setErrorText(text)
        if (runningRef.current) {
          setWsStatus('等待恢复')
          scheduleNextFrame(realtimeRecoverFrameDelayMs)
        }
        return
      }
      if (key === 'yolo:realtime:status') {
        sessionReadyRef.current = Boolean(props?.running)
        setWsStatus(props?.running ? '实时检测中' : '已连接')
        if (props?.running && runningRef.current && !tickRef.current) {
          scheduleNextFrame(realtimeNextFrameDelayMs)
        }
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
    if (streamRef.current) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        await videoRef.current.play().catch(() => null)
      }
      if (!cameraReady) {
        setCameraReady(true)
      }
      return true
    }
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
    if (!client?.isOpen) return false
    if (sessionReadyRef.current && runningRef.current) return true
    client.sendJson({
      type: 'yolo.realtime.start',
      token,
      classId,
      className,
      conf: 0.25,
      iou: 0.45,
      imgsz: 640,
    })
    sessionReadyRef.current = true
    return true
  }

  function pushHistory(nextCount, nextAt, source) {
    setHistory((prev) => [{ at: nextAt, count: nextCount, source }, ...prev].slice(0, 10))
  }

  function pushHistoryThrottled(nextCount, nextAt, source) {
    const now = Date.now()
    if (now - lastHistoryAtRef.current < realtimeHistoryThrottleMs) {
      return
    }
    lastHistoryAtRef.current = now
    pushHistory(nextCount, nextAt, source)
  }

  function getCaptureCanvasContext(width, height) {
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas')
    }
    const canvas = captureCanvasRef.current
    if (canvas.width !== width) {
      canvas.width = width
    }
    if (canvas.height !== height) {
      canvas.height = height
    }
    if (!captureContextRef.current) {
      captureContextRef.current = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      })
    }
    return {
      canvas,
      ctx: captureContextRef.current,
    }
  }

  async function captureAndSendFrame({ silent = false, fromLoop = false } = {}) {
    if (!classId) {
      return
    }
    if (frameInFlightRef.current) {
      if (!silent && !fromLoop) {
        message.info('当前画面正在发送中，请稍候')
      }
      if (fromLoop && runningRef.current) {
        scheduleNextFrame(realtimeNextFrameDelayMs)
      }
      return
    }
    if (!token) {
      const text = '当前登录态无效，请重新登录'
      setErrorText(text)
      if (!silent) message.error(text)
      return
    }
    frameInFlightRef.current = true
    let nextLoopDelay = realtimeNextFrameDelayMs
    try {
      await ensureCameraReady()
      const client = await ensureWsConnected()
      if (!ensureRealtimeSessionActive(client)) {
        const text = '实时连接不可用'
        setErrorText(text)
        if (!silent) message.error(text)
        return
      }

      if (!runningRef.current || !sessionReadyRef.current) {
        await new Promise((resolve) => setTimeout(resolve, realtimeStartWaitMs))
      }

      const activeClient = await ensureWsConnected()
      if (!activeClient?.isOpen) {
        const text = 'WebSocket 连接已断开'
        setErrorText(text)
        if (!silent) message.error(text)
        return
      }

      const video = videoRef.current
      if (!video) {
        return
      }
      const sourceWidth = video.videoWidth || 960
      const sourceHeight = video.videoHeight || 540
      const scale = sourceWidth > realtimeCaptureMaxWidth ? realtimeCaptureMaxWidth / sourceWidth : 1
      const width = Math.max(Math.round(sourceWidth * scale), 1)
      const height = Math.max(Math.round(sourceHeight * scale), 1)
      const { canvas, ctx } = getCaptureCanvasContext(width, height)
      if (!ctx) {
        return
      }
      ctx.drawImage(video, 0, 0, width, height)
      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.4)

      activeClient.sendJson({
        type: 'yolo.realtime.frame',
        token,
        classId,
        className,
        frameDataUrl,
      })
    } catch (e) {
      const text = e?.message || '发送检测帧失败'
      setErrorText(text)
      if (!silent) message.error(text)
      nextLoopDelay = realtimeRetryFrameDelayMs
    } finally {
      releaseFrameInFlight()
      if (fromLoop && runningRef.current) {
        scheduleNextFrame(nextLoopDelay)
      }
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
      runningRef.current = true
      sessionReadyRef.current = true
      releaseFrameInFlight()
      scheduleNextFrame(realtimeStartWaitMs)
    } catch (e) {
      const text = e?.message || '启动实时检测失败'
      setErrorText(text)
      message.error(text)
    } finally {
      setActionLoading(false)
    }
  }

  function stopRealtimeDetection() {
    clearLoopTimer()
    releaseFrameInFlight()
    sessionReadyRef.current = false
    runningRef.current = false
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
      message.warning('请先选择要检测的图片文件')
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
        source: '上传图片检测',
      })
      pushHistory(normalized.count, normalized.detectedAt, '上传图片检测')
      message.success('图片检测完成')
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
      clearLoopTimer()
      releaseFrameInFlight()
      stopCameraStream()
    }
  }, [])

  useEffect(() => {
    setActionLoading(false)
    setUploadLoading(false)
    setCount(null)
    setTotalDetections(0)
    setClassCounts({})
    setDetections([])
    setDetectedAt(null)
    setErrorText('')
    setHistory([])
    lastHistoryAtRef.current = 0
    setManualFile(null)
    setManualPreviewUrl('')
    setUploadResult(null)
    clearLoopTimer()
    releaseFrameInFlight()
    sessionReadyRef.current = false
    runningRef.current = false
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
    <div className={running ? 'ccdRoot ccdRootRunning' : 'ccdRoot'}>
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
              {className}
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

            <div ref={viewportRef} className="ccdVideoViewport" aria-label="摄像头画面占位">
              {cameraReady ? (
                <video ref={videoRef} className="ccdVideoPlayer" muted playsInline autoPlay />
              ) : null}
              <div className="ccdDetectionLayer" aria-hidden="true">
                {overlayDetections.map((item, index) => (
                  <div
                    key={`${item.className}-${item.left}-${item.top}-${index}`}
                    className={running ? 'ccdDetectionBox ccdDetectionBoxStable' : 'ccdDetectionBox'}
                    style={{
                      left: `${item.left}px`,
                      top: `${item.top}px`,
                      width: `${item.width}px`,
                      height: `${item.height}px`,
                    }}
                  >
                    <div className="ccdDetectionLabel">
                      <span>{item.className || '眼镜目标'}</span>
                      <span>{Math.round((item.confidence || 0) * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={running ? 'ccdScanLine ccdScanLineMuted' : 'ccdScanLine'} />
              <div className={running ? 'ccdVideoNoise ccdVideoNoiseMuted' : 'ccdVideoNoise'} />
              {!cameraReady ? (
                <div className="ccdVideoCenter">
                <div className="ccdVideoHint">
                    <div className="ccdHintTitle">等待接入班级摄像头</div>
                  <div className="ccdHintDesc">
                      点击“启动检测”后将申请浏览器摄像头权限，并开始实时推送到眼镜识别模型
                  </div>
                </div>
                </div>
              ) : null}
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
                <div className="ccdOverlayItem">
                  <div className="ccdOverlayKey">黄色框</div>
                  <div className="ccdOverlayVal">{overlayDetections.length ? `${overlayDetections.length} 个目标` : '等待识别'}</div>
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
                <div className="ccdMetricSubVal">{running ? '摄像头实时检测' : uploadResult ? '上传图片检测' : '待机'}</div>
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

      <Card className="ccdUploadCard ccdUploadCardWide" variant="borderless">
        <div className="ccdUploadHead">
          <div>
            <div className="ccdUploadTitle">图片文件检测演示</div>
            <div className="ccdUploadDesc">左边上传课堂图片，右边展示识别框与结果摘要，适合答辩演示单张图检测流程</div>
          </div>
          <Tag color="blue">图片演示</Tag>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="ccdFileInput"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            if (!file) {
              setManualFile(null)
              return
            }
            if (!file.type.startsWith('image/')) {
              message.warning('这里只支持上传图片文件')
              event.target.value = ''
              return
            }
            setManualFile(file)
            setUploadResult(null)
            setErrorText('')
          }}
        />

        <div className="ccdUploadWorkbench">
          <div className="ccdUploadPanel">
            <div className="ccdUploadPanelHead">
              <div className="ccdUploadPanelLabel">左侧原图</div>
              <div className="ccdUploadPanelHint">{manualFile ? '图片已载入' : '等待上传'}</div>
            </div>
            <div className="ccdUploadViewport">
              {manualPreviewUrl ? (
                <img src={manualPreviewUrl} alt="待检测图片" className="ccdUploadImage" />
              ) : (
                <div className="ccdUploadEmpty">
                  <div className="ccdUploadEmptyTitle">选择一张图片开始演示</div>
                  <div className="ccdUploadEmptyDesc">建议上传课堂照片或佩戴眼镜的人像图片，结果会更直观</div>
                </div>
              )}
            </div>
            <div className="ccdUploadActions">
              <Button onClick={() => fileInputRef.current?.click()}>
                {manualFile ? '重新选择图片' : '选择图片'}
              </Button>
              <Button type="primary" loading={uploadLoading} onClick={() => void handleUploadDetect()}>
                开始检测
              </Button>
            </div>
            <div className="ccdUploadMeta">
              <div className="ccdUploadMetaItem">
                <span className="ccdUploadMetaKey">当前文件</span>
                <span className="ccdUploadMetaVal">{manualFile?.name || '未选择图片'}</span>
              </div>
              <div className="ccdUploadMetaItem">
                <span className="ccdUploadMetaKey">当前状态</span>
                <span className="ccdUploadMetaVal">{uploadLoading ? '识别中' : manualFile ? '待开始检测' : '等待上传'}</span>
              </div>
            </div>
          </div>

          <div className="ccdUploadPanel ccdUploadPanelResult">
            <div className="ccdUploadPanelHead">
              <div className="ccdUploadPanelLabel">右侧结果</div>
              <div className="ccdUploadPanelHint">{uploadResult ? `${uploadResult.totalDetections} 个目标` : '等待识别结果'}</div>
            </div>
            <div ref={uploadViewportRef} className="ccdUploadViewport ccdUploadViewportResult">
              {manualPreviewUrl ? <img src={manualPreviewUrl} alt="检测结果图片" className="ccdUploadImage" /> : null}
              {manualPreviewUrl && uploadOverlayDetections.length > 0 ? (
                <div className="ccdUploadDetectionLayer" aria-hidden="true">
                  {uploadOverlayDetections.map((item, index) => (
                    <div
                      key={`${item.className}-${item.left}-${item.top}-${index}`}
                      className="ccdUploadDetectionBox"
                      style={{
                        left: `${item.left}px`,
                        top: `${item.top}px`,
                        width: `${item.width}px`,
                        height: `${item.height}px`,
                      }}
                    >
                      <div className="ccdUploadDetectionLabel">
                        <span>{item.className || '眼镜目标'}</span>
                        <span>{Math.round((item.confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {!manualPreviewUrl ? (
                <div className="ccdUploadEmpty">
                  <div className="ccdUploadEmptyTitle">结果区待命</div>
                  <div className="ccdUploadEmptyDesc">检测完成后，这里会叠加识别框，方便左右对照讲解</div>
                </div>
              ) : null}
            </div>
            <div className="ccdUploadSummary">
              <div className="ccdUploadSummaryItem">
                <div className="ccdUploadSummaryKey">戴眼镜人数</div>
                <div className="ccdUploadSummaryVal">{uploadResult ? uploadResult.count : '-'}</div>
              </div>
              <div className="ccdUploadSummaryItem">
                <div className="ccdUploadSummaryKey">识别目标总数</div>
                <div className="ccdUploadSummaryVal">{uploadResult ? uploadResult.totalDetections : '-'}</div>
              </div>
              <div className="ccdUploadSummaryItem">
                <div className="ccdUploadSummaryKey">类别分布</div>
                <div className="ccdUploadSummaryVal">{uploadResult ? formatClassCounts(uploadResult.classCounts) : '等待检测'}</div>
              </div>
              <div className="ccdUploadSummaryItem">
                <div className="ccdUploadSummaryKey">结果时间</div>
                <div className="ccdUploadSummaryVal">{uploadResult ? formatTime(uploadResult.detectedAt) : '暂无'}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
