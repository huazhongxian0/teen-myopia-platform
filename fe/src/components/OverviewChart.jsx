import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export default function OverviewChart({ option, className = '', height = 320 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return undefined

    const chart = echarts.init(containerRef.current)
    chartRef.current = chart

    const resize = () => {
      chart.resize()
    }

    const observer = new ResizeObserver(() => {
      resize()
    })

    observer.observe(containerRef.current)
    window.addEventListener('resize', resize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !option) return
    chartRef.current.setOption(option, true)
  }, [option])

  return <div ref={containerRef} className={className} style={{ width: '100%', height }} />
}
