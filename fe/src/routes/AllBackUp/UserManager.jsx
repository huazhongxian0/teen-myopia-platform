import { Button, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import { useState } from 'react'
import { useAntdTable, useMount } from 'ahooks'
import { httpClient } from '../../services/http/index.js'

const { Title, Text } = Typography

export default function UserManager() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const [roleOptions, setRoleOptions] = useState([])

  async function fetchRoles() {
    try {
      const data = await httpClient.post('/api/role/list', { pageNo: 1, pageSize: 200, roleId: null })
      const list = Array.isArray(data?.list) ? data.list : []
      setRoleOptions(list.map((r) => ({ value: r.roleId, label: r.roleId })))
    } catch (e) {
      setRoleOptions([])
    }
  }

  useMount(() => {
    void fetchRoles()
  })

  const { tableProps, refresh, search } = useAntdTable(
    async ({ current, pageSize }, formData) => {
      try {
        const roleId = formData?.roleId?.trim()
        const accountName = formData?.accountName?.trim()
        const phoneNumber = formData?.phoneNumber?.trim()
        const idRaw = formData?.id
        const id = idRaw === undefined || idRaw === null || String(idRaw).trim() === '' ? null : Number(String(idRaw).trim())

        const params = {}
        if (roleId) params.roleId = roleId
        if (accountName) params.accountName = accountName
        if (phoneNumber) params.phoneNumber = phoneNumber
        if (id !== null && !Number.isNaN(id)) params.id = id

        const data = await httpClient.get('/api/users/accounts', { params })
        const list = Array.isArray(data) ? data : []

        const start = (current - 1) * pageSize
        const end = start + pageSize
        return { total: list.length, list: list.slice(start, end) }
      } catch (e) {
        message.error(e?.message || '加载失败')
        return { total: 0, list: [] }
      }
    },
    { defaultPageSize: 10, form: filterForm },
  )

  function openCreate() {
    setEditing(null)
    const defaultRoleId = roleOptions?.some((it) => it.value === 'user') ? 'user' : (roleOptions?.[0]?.value ?? 'user')
    modalForm.setFieldsValue({
      roleId: defaultRoleId,
      name: '',
      accountName: '',
      password: '',
      phoneNumber: '',
      avatorUrl: '',
    })
    setModalOpen(true)
  }

  function openEdit(record) {
    setEditing(record)
    modalForm.setFieldsValue({
      roleId: record.roleId ?? '',
      name: record.name ?? '',
      accountName: record.accountName ?? '',
      password: '',
      phoneNumber: record.phoneNumber ?? '',
      avatorUrl: record.avatorUrl ?? '',
    })
    setModalOpen(true)
  }

  async function handleSubmit() {
    try {
      const values = await modalForm.validateFields()
      const payload = {
        roleId: values.roleId?.trim(),
        name: values.name?.trim(),
        accountName: values.accountName?.trim(),
        phoneNumber: values.phoneNumber?.trim(),
        avatorUrl: values.avatorUrl?.trim() || null,
      }
      const password = values.password?.trim()
      if (password) {
        payload.password = password
      }
      setModalLoading(true)
      if (editing) {
        await httpClient.put(`/api/users/accounts/${editing.id}`, payload)
      } else {
        if (!payload.accountName || !payload.password) {
          message.error('请输入账号与密码')
          return
        }
        await httpClient.post('/api/users/accounts', payload)
      }
      setModalOpen(false)
      refresh()
      message.success('已保存')
    } catch (e) {
      const status = e?.status ?? 0
      if (status === 409) {
        message.error('账号已存在或数据冲突')
      } else if (status === 404) {
        message.error('账号不存在')
      } else {
        message.error(e?.message || '保存失败')
      }
    } finally {
      setModalLoading(false)
    }
  }

  async function handleDelete(record) {
    try {
      await httpClient.delete(`/api/users/accounts/${record.id}`)
      refresh()
      message.success('已删除')
    } catch (e) {
      message.error(e?.message || '删除失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 120 },
    { title: '角色', dataIndex: 'roleId', width: 120 },
    { title: '姓名', dataIndex: 'name', width: 160 },
    { title: '账号', dataIndex: 'accountName', width: 180 },
    { title: '手机号', dataIndex: 'phoneNumber', width: 160 },
    { title: '头像', dataIndex: 'avatorUrl' },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space>
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
      <div className="backup-managerHeader">
        <div className="backup-managerLead">
          <Title level={4} className="backup-managerTitle">
            账号管理
          </Title>
          <Text className="backup-managerMeta">集中维护系统账号信息，便于按角色分配人员与登录身份。</Text>
        </div>
      </div>

      <Form
        form={filterForm}
        layout="inline"
        onFinish={search.submit}
        className="backup-toolbarCard backup-form"
      >
        <Form.Item name="roleId" label="角色">
          <Input placeholder="例如 admin" allowClear style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="accountName" label="账号">
          <Input placeholder="例如 root" allowClear style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="id" label="ID">
          <Input placeholder="例如 1" allowClear style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="phoneNumber" label="手机号">
          <Input placeholder="例如 18800000000" allowClear style={{ width: 200 }} />
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

      <Modal
        title={editing ? '编辑账号' : '新增账号'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form form={modalForm} layout="vertical">
          <Form.Item name="roleId" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              placeholder="选择角色"
              options={roleOptions}
              showSearch
              optionFilterProp="label"
              onDropdownVisibleChange={(open) => {
                if (open) {
                  void fetchRoles()
                }
              }}
            />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" autoFocus />
          </Form.Item>
          <Form.Item
            name="accountName"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input placeholder="例如 root" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={editing ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editing ? '留空表示不修改' : '请输入密码'} />
          </Form.Item>
          <Form.Item
            name="phoneNumber"
            label="手机号"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input placeholder="例如 18800000000" />
          </Form.Item>
          <Form.Item name="avatorUrl" label="头像 URL">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
