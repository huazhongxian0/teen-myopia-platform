import { Button, Form, Input, Modal, Space, Table, Typography, message } from 'antd'
import { useState } from 'react'
import { useAntdTable } from 'ahooks'
import { httpClient } from '../../services/http/index.js'
import ClassManager from './ClassManager.jsx'

const { Title, Text } = Typography

export default function SchoolManager() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const [selectedSchool, setSelectedSchool] = useState(null)

  const { tableProps, refresh, search } = useAntdTable(
    async ({ current, pageSize }, formData) => {
      try {
        const keyword = formData?.keyword?.trim()
        const data = await httpClient.post('/api/school/list', { 
          pageNo: current, 
          pageSize, 
          keyword: keyword || null 
        })
        return { total: data?.total || 0, list: data?.list || [] }
      } catch (e) {
        message.error(e?.message || '加载失败')
        return { total: 0, list: [] }
      }
    },
    { defaultPageSize: 10, form: filterForm },
  )

  function openCreate() {
    setEditing(null)
    modalForm.setFieldsValue({ name: '' })
    setModalOpen(true)
  }

  function openEdit(record) {
    setEditing(record)
    modalForm.setFieldsValue({ name: record.name ?? '' })
    setModalOpen(true)
  }

  async function handleSubmit() {
    try {
      const values = await modalForm.validateFields()
      const payload = { name: values.name?.trim() }
      setModalLoading(true)
      if (editing) {
        await httpClient.post('/api/school/update', { id: editing.id, ...payload })
      } else {
        await httpClient.post('/api/school/create', payload)
      }
      setModalOpen(false)
      refresh()
      message.success('已保存')
    } catch (e) {
      const status = e?.status ?? 0
      if (status === 409) {
        message.error('数据冲突')
      } else if (status === 404) {
        message.error('不存在')
      } else {
        message.error(e?.message || '保存失败')
      }
    } finally {
      setModalLoading(false)
    }
  }

  async function handleDelete(record) {
    try {
      await httpClient.post('/api/school/delete', { id: record.id })
      refresh()
      if (selectedSchool?.id === record.id) {
        setSelectedSchool(null)
      }
      message.success('已删除')
    } catch (e) {
      message.error(e?.message || '删除失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 120 },
    { title: '学校名称', dataIndex: 'name', width: 240 },
    { title: '创建时间', dataIndex: 'createdAt', width: 200, render: (ts) => ts ? new Date(ts).toLocaleString() : '-' },
    {
      title: '操作',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => setSelectedSchool(record)}>
            管理班级
          </Button>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {!selectedSchool ? (
        <>
          <div className="backup-managerHeader">
            <div className="backup-managerLead">
              <Title level={4} className="backup-managerTitle">
                学校管理
              </Title>
              <Text className="backup-managerMeta">维护学校基础资料，便于后续班级与学生信息统一归档。</Text>
            </div>
          </div>

          <Form
            form={filterForm}
            layout="inline"
            onFinish={search.submit}
            className="backup-toolbarCard backup-form"
          >
            <Form.Item name="keyword" label="关键词">
              <Input placeholder="学校名称" allowClear style={{ width: 240 }} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={tableProps.loading}>
                  查询
                </Button>
                <Button
                  onClick={() => {
                    search.reset()
                  }}
                  disabled={tableProps.loading}
                >
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
          <Space className="backup-actionsRow">
            <Button type="primary" onClick={openCreate}>
              新增
            </Button>
          </Space>
          <Table rowKey="id" columns={columns} className="backup-dataTable" {...tableProps} />
        </>
      ) : (
        <ClassManager 
          school={selectedSchool} 
          onBack={() => setSelectedSchool(null)} 
        />
      )}

      <Modal
        title={editing ? '编辑学校' : '新增学校'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form form={modalForm} layout="vertical">
          <Form.Item name="name" label="学校名称" rules={[{ required: true, message: '请输入学校名称' }]}>
            <Input placeholder="请输入学校名称" autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
