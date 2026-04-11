import { BulbOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useAccount } from '../hooks/useAccount.js'
import { httpClient } from '../services/http/index.js'
import './EyeCareTipsPanel.css'

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

export default function EyeCareTipsPanel({ mode = 'doctor' }) {
  const { account } = useAccount()
  const canManage = account?.roleId === 'doctor'

  const [loading, setLoading] = useState(false)
  const [tips, setTips] = useState([])

  const [manageOpen, setManageOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm()

  const [manageLoading, setManageLoading] = useState(false)
  const [manageList, setManageList] = useState([])
  const [manageTotal, setManageTotal] = useState(0)
  const [managePageNo, setManagePageNo] = useState(1)
  const [managePageSize, setManagePageSize] = useState(10)

  async function loadTipsForDisplay() {
    setLoading(true)
    try {
      const data = await httpClient.post('/api/eyeCareTip/list', { pageNo: 1, pageSize: 20 })
      const list = Array.isArray(data?.list) ? data.list : []
      setTips(list)
    } catch (e) {
      setTips([])
    } finally {
      setLoading(false)
    }
  }

  async function loadManageList({ pageNo = managePageNo, pageSize = managePageSize } = {}) {
    setManageLoading(true)
    try {
      const data = await httpClient.post('/api/eyeCareTip/list', { pageNo, pageSize })
      setManageList(Array.isArray(data?.list) ? data.list : [])
      setManageTotal(Number(data?.total ?? 0))
    } catch (e) {
      message.error(e?.message || '加载失败')
      setManageList([])
      setManageTotal(0)
    } finally {
      setManageLoading(false)
    }
  }

  useEffect(() => {
    void loadTipsForDisplay()
  }, [])

  useEffect(() => {
    if (!manageOpen) return
    void loadManageList()
  }, [manageOpen, managePageNo, managePageSize])

  const todayTip = useMemo(() => {
    if (!Array.isArray(tips) || tips.length === 0) return null
    const idx = new Date().getDate() % tips.length
    return tips[idx]
  }, [tips])

  async function handleDelete(row) {
    const id = row?.id
    if (!id) return
    Modal.confirm({
      title: '确认删除这条内容？',
      content: '删除后无法恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await httpClient.post('/api/eyeCareTip/delete', { id })
          message.success('已删除')
          void loadManageList({ pageNo: 1 })
          void loadTipsForDisplay()
          setManagePageNo(1)
        } catch (e) {
          message.error(e?.message || '删除失败')
        }
      },
    })
  }

  async function handleCreate() {
    const values = await createForm.validateFields()
    const title = values?.title?.trim() || null
    const content = values?.content?.trim() || null
    if (!content) {
      message.error('请输入内容')
      return
    }
    setCreateLoading(true)
    try {
      await httpClient.post('/api/eyeCareTip/create', { title, content })
      message.success('已新增')
      setCreateOpen(false)
      createForm.resetFields()
      setManagePageNo(1)
      void loadManageList({ pageNo: 1 })
      void loadTipsForDisplay()
    } catch (e) {
      message.error(e?.message || '新增失败')
    } finally {
      setCreateLoading(false)
    }
  }

  const manageColumns = [
    { title: '编号', dataIndex: 'id', width: 90 },
    { title: '标题', dataIndex: 'title', width: 220, render: (v) => v || '-' },
    { title: '内容', dataIndex: 'content', render: (v) => <span className="eyeCareContentCell">{v || '-'}</span> },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (v) => formatDateTime(v) },
    {
      title: '操作',
      key: 'action',
      width: 110,
      render: (_, row) => (
        <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(row)}>
          删除
        </Button>
      ),
    },
  ]

  if (mode === 'student') {
    return (
      <>
        <div className="healthTipCard">
          <div className="tipHeader">
            <BulbOutlined className="tipIcon" />
            <Text strong style={{ color: '#047857' }}>
              {todayTip?.title ?? '今日知识点'}
            </Text>
            {loading ? <Tag className="eyeCareTag">加载中</Tag> : <Tag className="eyeCareTag">护眼</Tag>}
          </div>
          <div className="tipBody">
            <Text className="tipText">{todayTip?.content ?? '暂无内容'}</Text>
          </div>
          <div className="tipFooter">
            <Space size={10}>
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => {
                  setManageOpen(true)
                }}
              >
                查看更多 &gt;
              </Button>
              {canManage ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => {
                    setManageOpen(true)
                  }}
                >
                  管理
                </Button>
              ) : null}
            </Space>
          </div>
        </div>

        <Modal
          title="护眼小课堂"
          open={manageOpen}
          onCancel={() => setManageOpen(false)}
          footer={null}
          width={900}
          className="eyeCareModal"
          destroyOnClose
        >
          <div className="eyeCareModalHead">
            <div className="eyeCareModalTitle">
              <span className="eyeCareBadge">内容库</span>
              <span>共 {manageTotal} 条</span>
            </div>
            {canManage ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setCreateOpen(true)
                }}
              >
                新增
              </Button>
            ) : null}
          </div>
          <Table
            rowKey="id"
            loading={manageLoading}
            columns={canManage ? manageColumns : manageColumns.filter((c) => c.key !== 'action')}
            dataSource={manageList}
            pagination={{
              current: managePageNo,
              pageSize: managePageSize,
              total: manageTotal,
              showSizeChanger: true,
              onChange: (p, ps) => {
                setManagePageNo(p)
                setManagePageSize(ps)
              },
            }}
          />
        </Modal>

        <Modal
          title="新增护眼内容"
          open={createOpen}
          onCancel={() => {
            if (createLoading) return
            setCreateOpen(false)
          }}
          onOk={handleCreate}
          okText="保存"
          cancelText="取消"
          confirmLoading={createLoading}
          className="eyeCareModal"
          destroyOnClose
        >
          <Form layout="vertical" form={createForm}>
            <Form.Item name="title" label="标题">
              <Input placeholder="例如：用眼 20-20-20 法则" allowClear />
            </Form.Item>
            <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
              <Input.TextArea placeholder="请输入护眼提示内容" rows={4} showCount maxLength={800} />
            </Form.Item>
          </Form>
        </Modal>
      </>
    )
  }

  return (
    <>
      <div className="healthTip">
        <div className="tipIcon">💡</div>
        <div className="tipContent">
          <div className="eyeCareRow">
            <Text strong>{todayTip?.title ?? '今日护眼小贴士'}</Text>
            <Space size={10}>
              {loading ? <Tag className="eyeCareTag">加载中</Tag> : <Tag className="eyeCareTag">护眼</Tag>}
              {canManage ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => setManageOpen(true)}
                >
                  管理
                </Button>
              ) : null}
            </Space>
          </div>
          <Text type="secondary">{todayTip?.content ?? '暂无内容'}</Text>
        </div>
      </div>

      <Modal
        title="护眼内容管理"
        open={manageOpen}
        onCancel={() => setManageOpen(false)}
        footer={null}
        width={960}
        className="eyeCareModal"
        destroyOnClose
      >
        <div className="eyeCareModalHead">
          <div className="eyeCareModalTitle">
            <span className="eyeCareBadge">内容库</span>
            <span>共 {manageTotal} 条</span>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCreateOpen(true)
            }}
          >
            新增
          </Button>
        </div>
        <Table
          rowKey="id"
          loading={manageLoading}
          columns={manageColumns}
          dataSource={manageList}
          pagination={{
            current: managePageNo,
            pageSize: managePageSize,
            total: manageTotal,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setManagePageNo(p)
              setManagePageSize(ps)
            },
          }}
        />
      </Modal>

      <Modal
        title="新增护眼内容"
        open={createOpen}
        onCancel={() => {
          if (createLoading) return
          setCreateOpen(false)
        }}
        onOk={handleCreate}
        okText="保存"
        cancelText="取消"
        confirmLoading={createLoading}
        className="eyeCareModal"
        destroyOnClose
      >
        <Form layout="vertical" form={createForm}>
          <Form.Item name="title" label="标题">
            <Input placeholder="例如：用眼 20-20-20 法则" allowClear />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea placeholder="请输入护眼提示内容" rows={4} showCount maxLength={800} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

