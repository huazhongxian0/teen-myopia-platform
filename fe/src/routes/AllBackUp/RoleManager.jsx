import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography, message } from 'antd'
import { useAntdTable, useMount } from 'ahooks'
import { useMemo, useState } from 'react'
import { httpClient } from '../../services/http/index.js'

const { Title, Text } = Typography

export default function RoleManager() {
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleModalLoading, setRoleModalLoading] = useState(false)
  const [roleEditing, setRoleEditing] = useState(null)
  const [roleForm] = Form.useForm()
  const [roleSearchForm] = Form.useForm()

  const [permModalOpen, setPermModalOpen] = useState(false)
  const [permModalLoading, setPermModalLoading] = useState(false)
  const [permEditing, setPermEditing] = useState(null)
  const [permForm] = Form.useForm()
  const [permSearchForm] = Form.useForm()

  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [authOptions, setAuthOptions] = useState([])

  useMount(() => {
    void (async () => {
      try {
        const data = await httpClient.get('/api/auth')
        const list = Array.isArray(data) ? data : []
        setAuthOptions(list)
      } catch (e) {
        message.error(e?.message || '加载权限点列表失败')
      }
    })()
  })

  const authSelectOptions = useMemo(() => {
    return (authOptions ?? []).map((a) => ({
      value: a.id,
      label: a.description ? `${a.id} - ${a.key}（${a.description}）` : `${a.id} - ${a.key}`,
    }))
  }, [authOptions])

  const { tableProps: roleTableProps, refresh: refreshRoles, search: roleSearch } = useAntdTable(
    async ({ current, pageSize }, formData) => {
      try {
        const roleId = formData?.roleId?.trim() || null
        const data = await httpClient.post('/api/role/list', { pageNo: current, pageSize, roleId })
        const list = Array.isArray(data?.list) ? data.list : []
        const total = Number(data?.total ?? 0)
        return { total: Number.isFinite(total) ? total : 0, list }
      } catch (e) {
        message.error(e?.message || '加载角色失败')
        return { total: 0, list: [] }
      }
    },
    { defaultPageSize: 20, form: roleSearchForm },
  )

  const { tableProps: permTableProps, refresh: refreshPerms, search: permSearch } = useAntdTable(
    async ({ current, pageSize }, formData) => {
      if (!selectedRoleId) return { total: 0, list: [] }
      try {
        const keyword = formData?.keyword?.trim() || null
        const data = await httpClient.post('/api/role/permission/list', {
          roleId: selectedRoleId,
          pageNo: current,
          pageSize,
          keyword,
        })
        const list = Array.isArray(data?.list) ? data.list : []
        const total = Number(data?.total ?? 0)
        return { total: Number.isFinite(total) ? total : 0, list }
      } catch (e) {
        message.error(e?.message || '加载角色权限失败')
        return { total: 0, list: [] }
      }
    },
    { defaultPageSize: 20, form: permSearchForm, refreshDeps: [selectedRoleId] },
  )

  async function handleSubmitRole() {
    try {
      const values = await roleForm.validateFields()
      const roleId = values.roleId.trim()
      setRoleModalLoading(true)
      if (roleEditing) {
        await httpClient.post('/api/role/updateRoleId', { fromRoleId: roleEditing.roleId, toRoleId: roleId })
      } else {
        await httpClient.post('/api/role/create', { roleId })
      }
      setRoleModalOpen(false)
      setRoleEditing(null)
      setSelectedRoleId(roleId)
      refreshRoles()
      refreshPerms()
      message.success('已保存')
    } catch (e) {
      const status = e?.status ?? 0
      if (status === 409) {
        message.error('角色已存在或冲突')
      } else if (status === 404) {
        message.error('角色不存在')
      } else if (e?.error) {
        message.error(e?.message || '创建失败')
      }
    } finally {
      setRoleModalLoading(false)
    }
  }

  async function handleDeleteRole(roleId) {
    try {
      await httpClient.post('/api/role/delete', { roleId })
      if (selectedRoleId === roleId) {
        setSelectedRoleId(null)
      }
      refreshRoles()
      refreshPerms()
      message.success('已删除角色')
    } catch (e) {
      message.error(e?.message || '删除失败')
    }
  }

  function openCreateRole() {
    setRoleEditing(null)
    roleForm.setFieldsValue({ roleId: '' })
    setRoleModalOpen(true)
  }

  function openEditRole(record) {
    setRoleEditing(record)
    roleForm.setFieldsValue({ roleId: record.roleId })
    setRoleModalOpen(true)
  }

  function openCreatePermission() {
    if (!selectedRoleId) {
      message.warning('请先选择一个角色')
      return
    }
    setPermEditing(null)
    permForm.setFieldsValue({ authCode: null })
    setPermModalOpen(true)
  }

  function openEditPermission(record) {
    setPermEditing(record)
    permForm.setFieldsValue({ authCode: record.authCode ?? null })
    setPermModalOpen(true)
  }

  async function handleSubmitPermission() {
    if (!selectedRoleId) return
    try {
      const values = await permForm.validateFields()
      const payload = { roleId: selectedRoleId, authCode: values.authCode }
      setPermModalLoading(true)
      if (permEditing) {
        await httpClient.post('/api/role/permission/update', { ...payload, permissionId: permEditing.id })
      } else {
        await httpClient.post('/api/role/permission/create', payload)
      }
      setPermModalOpen(false)
      refreshPerms()
      message.success('已保存')
    } catch (e) {
      const status = e?.status ?? 0
      if (status === 404) {
        message.error('记录不存在')
      } else if (status === 400) {
        message.error('参数错误')
      } else if (status === 409) {
        message.error('该权限已存在')
      } else if (e?.error) {
        message.error(e?.message || '保存失败')
      }
    } finally {
      setPermModalLoading(false)
    }
  }

  async function handleDeletePermission(id) {
    if (!selectedRoleId) return
    try {
      await httpClient.post('/api/role/permission/delete', { roleId: selectedRoleId, permissionId: id })
      refreshPerms()
      message.success('已删除')
    } catch (e) {
      message.error(e?.message || '删除失败')
    }
  }

  const roleColumns = [
    { title: 'ID', dataIndex: 'id', width: 120 },
    { title: '角色标识', dataIndex: 'roleId' },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => setSelectedRoleId(record.roleId)}>
            选择
          </Button>
          <Button size="small" onClick={() => openEditRole(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该角色？" onConfirm={() => handleDeleteRole(record.roleId)}>
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const permColumns = [
    { title: '名称', dataIndex: 'name', width: 220 },
    { title: '描述', dataIndex: 'description' },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEditPermission(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该权限？" onConfirm={() => handleDeletePermission(record.id)}>
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            角色管理
          </Title>
          <Text type="secondary">创建角色会自动创建 user_{'{roleId}'} 权限表</Text>
        </div>
        <Space>
          <Button onClick={refreshRoles} loading={roleTableProps.loading}>
            刷新
          </Button>
          <Button type="primary" onClick={openCreateRole}>
            新增角色
          </Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12, width: '100%' }}>
        <Card
          size="small"
          title="角色列表"
          extra={selectedRoleId ? <Text type="secondary">当前：{selectedRoleId}</Text> : null}
          bodyStyle={{ padding: 12 }}
        >
          <Form
            form={roleSearchForm}
            layout="inline"
            onFinish={roleSearch.submit}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
          >
            <Form.Item name="roleId" label="角色">
              <Input placeholder="输入角色标识" allowClear style={{ width: 200 }} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={roleTableProps.loading}>
                  查询
                </Button>
                <Button onClick={roleSearch.reset} disabled={roleTableProps.loading}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>

          <Table rowKey="roleId" columns={roleColumns} {...roleTableProps} />
        </Card>

        <Card
          size="small"
          title="角色权限"
          extra={
            <Space>
              <Button onClick={refreshPerms} disabled={!selectedRoleId} loading={permTableProps.loading}>
                刷新
              </Button>
              <Button type="primary" onClick={openCreatePermission} disabled={!selectedRoleId}>
                新增权限
              </Button>
            </Space>
          }
          bodyStyle={{ padding: 12 }}
        >
          <Form
            form={permSearchForm}
            layout="inline"
            onFinish={permSearch.submit}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
          >
            <Form.Item name="keyword" label="关键词">
              <Input placeholder="名称/描述" allowClear style={{ width: 220 }} disabled={!selectedRoleId} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={permTableProps.loading} disabled={!selectedRoleId}>
                  查询
                </Button>
                <Button onClick={permSearch.reset} disabled={!selectedRoleId || permTableProps.loading}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
          <Table rowKey="id" columns={permColumns} {...permTableProps} />
        </Card>
      </div>

      <Modal
        title={roleEditing ? '编辑角色' : '新增角色'}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={handleSubmitRole}
        confirmLoading={roleModalLoading}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="roleId"
            label="角色标识"
            rules={[
              { required: true, message: '请输入角色标识' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '仅允许字母/数字/下划线' },
            ]}
          >
            <Input placeholder="例如 admin / user / teacher_1" autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={permEditing ? '编辑角色权限' : '新增角色权限'}
        open={permModalOpen}
        onCancel={() => setPermModalOpen(false)}
        onOk={handleSubmitPermission}
        confirmLoading={permModalLoading}
      >
        <Form form={permForm} layout="vertical">
          <Form.Item name="authCode" label="AuthId" rules={[{ required: true, message: '请选择 AuthId' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择 auth 表中的 id"
              options={authSelectOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
