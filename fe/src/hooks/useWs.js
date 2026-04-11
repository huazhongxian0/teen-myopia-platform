import { useEffect, useMemo,  useState } from 'react'
import { WebSocketClient } from '../services/ws/index.js'
import config from '../../../shared-config.json'

let wsClient = null

const eventBus = new Map();
const wsPath = config?.endpoints?.wsNative ?? config?.endpoints?.ws ?? '/ws'
const defaultWsUrl = `${config.server.wsProtocol}://${config.server.domain}:${config.server.port}${wsPath}`

export default function useWs(options = {
    url: null,
    getUrl: null,
    protocols: undefined,
    reconnect: true,
    minDelay: 1000,
    maxDelay: 30000,
    backoff: 1.5,
    heartbeatInterval: 30000,
    heartbeatPayload: '{"type":"heartbeat"}',
}) {
  const resolvedUrl = useMemo(() => {
    return options?.url ?? import.meta.env.VITE_WS_URL ?? defaultWsUrl
  }, [options?.url])

  const getUrl = useMemo(() => {
    if (typeof options?.getUrl === 'function') return options.getUrl
    return () => resolvedUrl
  }, [options?.getUrl, resolvedUrl])

  const autoConnect = options?.autoConnect ?? true
  const [status, setStatus] = useState('idle')
  const [lastMessage, setLastMessage] = useState(null)
  const [lastError, setLastError] = useState(null)

  useEffect(() => {
    if (!autoConnect) return
    if (wsClient) return 

    const client = new WebSocketClient({
      getUrl,
      protocols: options?.protocols ?? undefined,
      reconnect: options?.reconnect,
      minDelay: options?.minDelay,
      maxDelay: options?.maxDelay,
      backoff: options?.backoff,
      heartbeatInterval: options?.heartbeatInterval,
      heartbeatPayload: options?.heartbeatPayload,
    })

    wsClient = client
    setStatus('connecting')
    setLastError(null)

    const offOpen = client.on('open', () => setStatus('open'))
    const offClose = client.on('close', () => setStatus('closed'))
    const offReconnect = client.on('reconnect', ({ delay, retries }) => {
      setStatus(`reconnecting(${retries}) in ${delay}ms`)
    })
    const offMessage = client.on('message', (event) => {
      
      const {key,props} = JSON.parse(event.data) || {}
      console.log(key,props,event)
      const triggers = eventBus.get(key)
      triggers?.(props)
      setLastMessage(event?.data ?? null)
    })
    const offError = client.on('error', (event) => {
      setLastError(event)
      setStatus('error')
    })

    client.connect().catch((e) => {
      setLastError(e)
      setStatus('error')
    })

    return () => {
      offOpen()
      offClose()
      offReconnect()
      offMessage()
      offError()
      client.close()
      if (wsClient === client) wsClient = null
    }
  }, [
    autoConnect,
    getUrl,
    options?.protocols,
    options?.reconnect,
    options?.minDelay,
    options?.maxDelay,
    options?.backoff,
    options?.heartbeatInterval,
    options?.heartbeatPayload,
  ])

  function send(data) {
    try {
      wsClient?.send(data)
      return true
    } catch (e) {
      setLastError(e)
      return false
    }
  }

  function sendJson(value) {
    try {
      wsClient?.sendJson(value)
      return true
    } catch (e) {
      setLastError(e)
      return false
    }
  }

  function close(code, reason) {
    wsClient?.close(code, reason)
  }
  return {
    status,
    lastMessage,
    lastError,
    send,
    sendJson,
    close,
    client: wsClient,
  }
}
export const useWsEventBus = () => {
  return {
    on: (event, callback) => {
      eventBus.set(event, callback)
    },
  }
}
