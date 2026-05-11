const STORAGE_KEY = 'overview:realtime:detection'
const CHANNEL_NAME = 'overview:realtime:detection'

function safeParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  return {
    classId: payload.classId ?? null,
    className: payload.className ?? null,
    count: typeof payload.count === 'number' ? payload.count : 0,
    totalDetections: typeof payload.totalDetections === 'number' ? payload.totalDetections : 0,
    classCounts: payload.classCounts && typeof payload.classCounts === 'object' ? payload.classCounts : {},
    detectedAt: typeof payload.detectedAt === 'number' ? payload.detectedAt : Date.now(),
    running: Boolean(payload.running),
    source: payload.source ?? '实时检测',
  }
}

export function getOverviewRealtimeSnapshot() {
  return normalizePayload(safeParse(localStorage.getItem(STORAGE_KEY)))
}

export function publishOverviewRealtimeSnapshot(payload) {
  const nextValue = normalizePayload(payload)
  if (!nextValue) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue))
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(nextValue)
    channel.close()
  }
}

export function subscribeOverviewRealtimeSnapshot(listener) {
  if (typeof listener !== 'function') {
    return () => {}
  }

  const emit = (payload) => {
    const nextValue = normalizePayload(payload)
    if (nextValue) {
      listener(nextValue)
    }
  }

  emit(getOverviewRealtimeSnapshot())

  let channel = null
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event) => {
      emit(event?.data)
    }
  }

  const handleStorage = (event) => {
    if (event.key !== STORAGE_KEY) return
    emit(safeParse(event.newValue))
  }

  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener('storage', handleStorage)
    if (channel) {
      channel.close()
    }
  }
}
