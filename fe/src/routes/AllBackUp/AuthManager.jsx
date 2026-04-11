import { Button, Form, Input, Modal, Space, Table, Typography, message } from 'antd'
import { useState } from 'react'
import { useAntdTable } from 'ahooks'
import { httpClient } from '../../services/http/index.js'

const { Title, Text } = Typography

export default function AuthManager() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const { tableProps, refresh } = useAntdTable(
    async ({ current, pageSize }) => {
      try {
        const data = await httpClient.get('/api/auth')
        const list = Array.isArray(data) ? data : []
        const start = (current - 1) * pageSize
        const end = start + pageSize
        return { total: list.length, list: list.slice(start, end) }
      } catch (e) {
        message.error(e?.message || '加载失败')
        return { total: 0, list: [] }
      }
    },
    { defaultPageSize: 10 },
  )

  function openCreate() {
    setEditing(null)
    form.setFieldsValue({ key: '', description: '' })
    setModalOpen(true)
  }

  function openEdit(record) {
    setEditing(record)
    form.setFieldsValue({ key: record.key, description: record.description ?? '' })
    setModalOpen(true)
  }

  async function handleSubmit() {
    try {
      const values = await form.validateFields()
      const key = values.key.trim()
      const description = values.description?.trim() || null
      setModalLoading(true)

      if (editing) {
        await httpClient.put(`/api/auth/${editing.id}`, { key, description })
      } else {
        await httpClient.post('/api/auth', { key, description })
      }

      setModalOpen(false)
      refresh()
      message.success('已保存')
    } catch (e) {
      const status = e?.status ?? 0
      if (status === 409) {
        message.error('权限点冲突或不可修改 base')
      } else if (status === 404) {
        message.error('权限点不存在')
      } else if (e?.error) {
        message.error(e?.message || '保存失败')
      }
    } finally {
      setModalLoading(false)
    }
  }

  async function handleDelete(record) {
    try {
      await httpClient.delete(`/api/auth/${record.id}`)
      refresh()
      message.success('已删除')
    } catch (e) {
      const status = e?.status ?? 0
      if (status === 409) {
        message.error('base 权限点不可删除')
      } else {
        message.error(e?.message || '删除失败')
      }
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 120 },
    { title: 'Key', dataIndex: 'key' },
    { title: '描述', dataIndex: 'description' },
    {
      title: '操作',
      width: 180,
      render: (_, record) => {
        const isBase = record.key === 'base'
        return (
          <Space>
            <Button size="small" onClick={() => openEdit(record)} disabled={isBase}>
              编辑
            </Button>
            <Button size="small" danger onClick={() => handleDelete(record)} disabled={isBase}>
              删除
            </Button>
          </Space>
        )
      },
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            权限点管理
          </Title>
          <Text type="secondary">对应后端 auth 表（id, key）</Text>
        </div>
        <Space>
          <Button onClick={refresh} loading={tableProps.loading}>
            刷新
          </Button>
          <Button type="primary" onClick={openCreate}>
            新增
          </Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} {...tableProps} />

      <Modal
        title={editing ? '编辑权限点' : '新增权限点'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="key"
            label="Key"
            rules={[{ required: true, message: '请输入 key' }]}
          >
            <Input placeholder="例如 student:read" autoFocus />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
