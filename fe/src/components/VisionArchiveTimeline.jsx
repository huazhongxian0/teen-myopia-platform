import { Button, Card, Drawer, List, Space, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { httpClient } from '../services/http/index.js'
import './VisionArchiveTimeline.css'

const { Text } = Typography

function formatDateTime(ms) {
  if (!ms) return '-'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
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

function formatVision(value) {
  if (value === undefined || value === null) return '-'
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return '-'
  if (n >= 10) return (n / 10).toFixed(1)
  return n.toFixed(1)
}

export default function VisionArchiveTimeline({
  mode = 'student',
  patientAccountId = null,
  title = '检查记录',
  onMetaChange,
}) {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const onMetaChangeRef = useRef(onMetaChange)
  useEffect(() => {
    onMetaChangeRef.current = onMetaChange
  }, [onMetaChange])

  const endpoints = useMemo(() => {
    if (mode === 'doctor') {
      return {
        listUrl: '/api/visitHistory/listByPatient',
        getUrl: '/api/visitHistory/getByIdForDoctor',
      }
    }
    return {
      listUrl: '/api/visitHistory/listMine',
      getUrl: '/api/visitHistory/getMineById',
    }
  }, [mode])

  async function loadList({ pageNo: pNo = pageNo, pageSize: pSize = pageSize } = {}) {
    if (mode === 'doctor' && !patientAccountId) {
      setList([])
      setTotal(0)
      return
    }
    setLoading(true)
    try {
      const payload =
        mode === 'doctor' ? { patientAccountId, pageNo: pNo, pageSize: pSize } : { pageNo: pNo, pageSize: pSize }
      const data = await httpClient.post(endpoints.listUrl, payload)
      const nextList = Array.isArray(data?.list) ? data.list : []
      const nextTotal = Number(data?.total ?? 0)
      setList(nextList)
      setTotal(nextTotal)
    } catch (e) {
      message.error(e?.message || '加载档案失败')
      setList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id) {
    setDetailLoading(true)
    try {
      const data = await httpClient.post(endpoints.getUrl, { id })
      setDetail(data ?? null)
    } catch (e) {
      message.error(e?.message || '加载档案详情失败')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    setPageNo(1)
  }, [mode, patientAccountId])

  useEffect(() => {
    void loadList()
  }, [pageNo, pageSize, mode, patientAccountId, endpoints.listUrl])

  useEffect(() => {
    const cb = onMetaChangeRef.current
    if (typeof cb !== 'function') return
    if (!Array.isArray(list) || list.length === 0) {
      cb({
        total,
        latest: null,
      })
      return
    }
    const latest = list[0]
    cb({
      total,
      latest: {
        latest: `${formatVision(latest?.od)} / ${formatVision(latest?.os)}`,
        latestDate: formatDate(latest?.visitDate),
        doctor: latest?.doctorName ?? '-',
      },
    })
  }, [list, total])

  function openDrawer(item) {
    const id = item?.id
    if (!id) return
    setActiveId(id)
    setOpen(true)
    void loadDetail(id)
  }

  return (
    <>
      <Card className="archiveList" bordered={false}>
        <div className="listHead">
          <Text className="listTitle">{title}</Text>
          <div className="listMeta">按时间倒序</div>
        </div>

        <List
          loading={loading}
          dataSource={list}
          pagination={{
            current: pageNo,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPageNo(p)
              setPageSize(ps)
            },
          }}
          renderItem={(item) => (
            <List.Item className="archiveItem" onClick={() => openDrawer(item)}>
              <div className="itemCard">
                <div className="itemTop">
                  <div className="itemDate">{formatDate(item?.visitDate)}</div>
                  <Tag className="itemTag">医生：{item?.doctorName ?? '-'}</Tag>
                </div>
                <div className="itemMid">
                  <div className="itemVision">
                    <span className="visionStrong">{formatVision(item?.od)}</span>
                    <span className="visionSep">/</span>
                    <span className="visionStrong">{formatVision(item?.os)}</span>
                  </div>
                  <div className="itemHint">录入时间：{formatDateTime(item?.createdAt)}</div>
                </div>
                <div className="itemArrow">↗</div>
              </div>
            </List.Item>
          )}
        />
      </Card>

      <Drawer
        title="档案详情"
        open={open}
        onClose={() => {
          setOpen(false)
          setActiveId(null)
          setDetail(null)
        }}
        width={420}
        className="archiveDrawer"
        styles={{
          content: {
            background:
              'radial-gradient(900px 520px at 12% 10%, rgba(56, 189, 248, 0.14), transparent 55%), radial-gradient(900px 520px at 88% 22%, rgba(34, 197, 94, 0.12), transparent 55%), linear-gradient(180deg, rgba(2, 6, 23, 0.96), rgba(2, 6, 23, 0.92))',
          },
          header: {
            background: 'transparent',
            borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
          },
          body: {
            background: 'transparent',
          },
        }}
      >
        <Card className="detailCard" bordered={false} loading={detailLoading}>
          <div className="detailRow">
            <div className="detailKey">检查日期</div>
            <div className="detailVal">{formatDate(detail?.visitDate)}</div>
          </div>
          <div className="detailRow">
            <div className="detailKey">接诊医生</div>
            <div className="detailVal">{detail?.doctorName ?? '-'}</div>
          </div>
          <div className="detailRow">
            <div className="detailKey">视力（左/右）</div>
            <div className="detailVal">
              <span className="detailVision">{formatVision(detail?.od)}</span>
              <span className="detailSep">/</span>
              <span className="detailVision">{formatVision(detail?.os)}</span>
            </div>
          </div>
          <div className="detailRow">
            <div className="detailKey">录入时间</div>
            <div className="detailVal">{formatDateTime(detail?.createdAt)}</div>
          </div>
          <div className="detailRow">
            <div className="detailKey">档案编号</div>
            <div className="detailVal">{activeId ?? '-'}</div>
          </div>
          <Space style={{ marginTop: 14 }}>
            <Button
              onClick={() => {
                setOpen(false)
              }}
            >
              关闭
            </Button>
          </Space>
        </Card>
      </Drawer>
    </>
  )
}
