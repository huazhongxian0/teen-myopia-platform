function createEventBus() {
  const listeners = new Map()

  function on(eventName, handler) {
    const set = listeners.get(eventName) ?? new Set()
    set.add(handler)
    listeners.set(eventName, set)
    return () => {
      set.delete(handler)
      if (set.size === 0) listeners.delete(eventName)
    }
  }

  function emit(eventName, payload) {
    const set = listeners.get(eventName)
    if (!set) return
    for (const handler of set) handler(payload)
  }

  return { on, emit }
}

export default class WebSocketClient {
  constructor(options) {
    const url = options?.url
    const getUrl = options?.getUrl

    if (!url && typeof getUrl !== 'function') {
      throw new Error('WebSocketClient requires url or getUrl')
    }

    this._getUrl = typeof getUrl === 'function' ? getUrl : () => url
    this._protocols = options?.protocols ?? undefined
    this._reconnect = options?.reconnect ?? true
    this._minDelay = options?.minDelay ?? 1000
    this._maxDelay = options?.maxDelay ?? 15000
    this._backoff = options?.backoff ?? 1.6
    this._heartbeatInterval = options?.heartbeatInterval ?? 20000
    this._heartbeatPayload = options?.heartbeatPayload ?? 'ping'

    this._bus = createEventBus()
    this._ws = null
    this._manualClose = false
    this._retries = 0
    this._connectPromise = null
    this._heartbeatTimer = null
    this._reconnectTimer = null
  }

  get readyState() {
    return this._ws?.readyState ?? WebSocket.CLOSED
  }

  get isOpen() {
    return this._ws?.readyState === WebSocket.OPEN
  }

  on(eventName, handler) {
    return this._bus.on(eventName, handler)
  }

  connect() {
    if (this._connectPromise) return this._connectPromise

    this._manualClose = false
    const url = this._getUrl()

    this._connectPromise = new Promise((resolve, reject) => {
      let ws
      try {
        const protocols = this._protocols
        const hasProtocols =
          typeof protocols === 'string'
            ? protocols.length > 0
            : Array.isArray(protocols)
              ? protocols.length > 0
              : false

        ws = hasProtocols ? new WebSocket(url, protocols) : new WebSocket(url)
      } catch (e) {
        this._connectPromise = null
        reject(e)
        return
      }

      this._ws = ws

      ws.addEventListener('open', () => {
        this._retries = 0
        this._startHeartbeat()
        this._bus.emit('open')
        resolve()
      })

      ws.addEventListener('message', (event) => {
        this._bus.emit('message', event)
      })

      ws.addEventListener('error', (event) => {
        this._bus.emit('error', event)
      })

      ws.addEventListener('close', (event) => {
        this._stopHeartbeat()
        this._ws = null
        this._connectPromise = null
        this._bus.emit('close', event)

        if (!this._manualClose && this._reconnect) {
          this._scheduleReconnect()
        }
      })
    })

    return this._connectPromise
  }

  send(data) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    this._ws.send(data)
  }

  sendJson(value) {
    this.send(JSON.stringify(value))
  }

  close(code, reason) {
    this._manualClose = true
    this._stopHeartbeat()
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    this._ws?.close(code, reason)
    this._ws = null
    this._connectPromise = null
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return

    const delay = Math.min(
      this._maxDelay,
      Math.round(this._minDelay * Math.pow(this._backoff, this._retries)),
    )
    this._retries += 1

    this._bus.emit('reconnect', { delay, retries: this._retries })

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      this.connect().catch(() => null)
    }, delay)
  }

  _startHeartbeat() {
    if (!this._heartbeatInterval) return
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer)

    this._heartbeatTimer = setInterval(() => {
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return
      this._ws.send(this._heartbeatPayload)
    }, this._heartbeatInterval)
  }

  _stopHeartbeat() {
    if (!this._heartbeatTimer) return
    clearInterval(this._heartbeatTimer)
    this._heartbeatTimer = null
  }
}
