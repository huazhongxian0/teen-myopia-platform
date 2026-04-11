import { Button, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import { useState } from 'react'
import { useAntdTable, useMount } from 'ahooks'
import { httpClient } from '../../services/http/index.js'

const { Title, Text } = Typography

export default function StudentManager({ classInfo, onBack }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalForm] = Form.useForm()
  const [studentOptions, setStudentOptions] = useState([])

  async function fetchStudents() {
    try {
      const data = await httpClient.get('/api/users/accounts', { params: { roleId: 'student' } })
      const list = Array.isArray(data) ? data : []
      setStudentOptions(list.map((s) => ({ value: s.id, label: `${s.name} (${s.accountName})` })))
    } catch (e) {
      setStudentOptions([])
    }
  }

  useMount(() => {
    void fetchStudents()
  })

  const { tableProps, refresh, search } = useAntdTable(
    async ({ current, pageSize }) => {
      try {
        const data = await httpClient.post('/api/school/student/list', { 
          classId: classInfo.id,
          pageNo: current, 
          pageSize 
        })
        return { total: data?.total || 0, list: data?.list || [] }
      } catch (e) {
        message.error(e?.message || '加载失败')
        return { total: 0, list: [] }
      }
    },
    { defaultPageSize: 10, refreshDeps: [classInfo.id] },
  )

  function openCreate() {
    modalForm.setFieldsValue({ accountId: null })
    setModalOpen(true)
  }

  async function handleSubmit() {
    try {
      const values = await modalForm.validateFields()
      setModalLoading(true)
      await httpClient.post('/api/school/student/create', { 
        classId: classInfo.id, 
        accountId: values.accountId 
      })
      setModalOpen(false)
      refresh()
      message.success('已添加')
    } catch (e) {
      message.error(e?.message || '添加失败')
    } finally {
      setModalLoading(false)
    }
  }

  async function handleDelete(record) {
    try {
      await httpClient.post('/api/school/student/delete', { 
        classId: classInfo.id, 
        studentId: record.id 
      })
      refresh()
      message.success('已删除')
    } catch (e) {
      message.error(e?.message || '删除失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 120 },
    { 
      title: '学生账号', 
      dataIndex: 'accountId', 
      width: 240, 
      render: (accountId) => {
        const student = studentOptions.find(s => s.value === accountId)
        return student ? student.label : `账号ID: ${accountId}`
      }
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button size="small" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <Button onClick={onBack}>
              ← 返回
            </Button>
          )}
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {classInfo.name} - 学生管理
            </Title>
            <Text type="secondary">管理班级学生</Text>
          </div>
        </div>
      </div>

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={openCreate}>
          添加学生
        </Button>
      </Space>
      <Table rowKey="id" columns={columns} {...tableProps} />

      <Modal
        title="添加学生"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form form={modalForm} layout="vertical">
          <Form.Item name="accountId" label="学生" rules={[{ required: true, message: '请选择学生' }]}>
            <Select
              placeholder="选择学生"
              options={studentOptions}
              showSearch
              optionFilterProp="label"
              onDropdownVisibleChange={(open) => {
                if (open) {
                  void fetchStudents()
                }
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
