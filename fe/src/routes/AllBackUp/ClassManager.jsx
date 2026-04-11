import { Button, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import { useState } from 'react'
import { useAntdTable, useMount } from 'ahooks'
import { httpClient } from '../../services/http/index.js'
import StudentManager from './StudentManager.jsx'
import ClassCameraDetectPage from '../ClassCameraDetectPage/index.jsx'

const { Title, Text } = Typography

export default function ClassManager({ school, onBack }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const [teacherOptions, setTeacherOptions] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedPanel, setSelectedPanel] = useState('students')

  async function fetchTeachers() {
    try {
      const data = await httpClient.get('/api/users/accounts', { params: { roleId: 'teacher' } })
      const list = Array.isArray(data) ? data : []
      setTeacherOptions(list.map((t) => ({ value: t.id, label: `${t.name} (${t.accountName})` })))
    } catch (e) {
      setTeacherOptions([])
    }
  }

  useMount(() => {
    void fetchTeachers()
  })

  const { tableProps, refresh, search } = useAntdTable(
    async ({ current, pageSize }, formData) => {
      try {
        const keyword = formData?.keyword?.trim()
        const params = { 
          pageNo: current, 
          pageSize, 
          keyword: keyword || null 
        }
        if (school) {
          params.schoolId = school.id
        }
        const data = await httpClient.post('/api/school/class/list', params)
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
    modalForm.setFieldsValue({ name: '', headTeacherAccountId: null })
    setModalOpen(true)
  }

  function openEdit(record) {
    setEditing(record)
    modalForm.setFieldsValue({ 
      name: record.name ?? '', 
      headTeacherAccountId: record.headTeacherAccountId ?? null 
    })
    setModalOpen(true)
  }

  async function handleSubmit() {
    try {
      const values = await modalForm.validateFields()
      const payload = { 
        name: values.name?.trim(),
        headTeacherAccountId: values.headTeacherAccountId || null
      }
      setModalLoading(true)
      if (editing) {
        await httpClient.post('/api/school/class/update', { id: editing.id, ...payload })
      } else {
        if (!school) {
          message.error('缺少学校信息')
          return
        }
        await httpClient.post('/api/school/class/create', { schoolId: school.id, name: payload.name })
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
      await httpClient.post('/api/school/class/delete', { id: record.id })
      refresh()
      message.success('已删除')
    } catch (e) {
      message.error(e?.message || '删除失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 120 },
    { title: '班级名称', dataIndex: 'name', width: 200 },
    { 
      title: '班主任', 
      dataIndex: 'headTeacherAccountId', 
      width: 200, 
      render: (id) => {
        const teacher = teacherOptions.find(t => t.value === id)
        return teacher ? teacher.label : '-'
      }
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 200, render: (ts) => ts ? new Date(ts).toLocaleString() : '-' },
    {
      title: '操作',
      width: 360,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setSelectedPanel('students')
              setSelectedClass(record)
            }}
          >
            管理学生
          </Button>
          <Button
            size="small"
            onClick={() => {
              setSelectedPanel('camera')
              setSelectedClass(record)
            }}
          >
            摄像头检测
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
      {!selectedClass ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {onBack && (
                <Button onClick={onBack}>
                  ← 返回
                </Button>
              )}
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {school ? `${school.name} - 班级管理` : '班级管理'}
                </Title>
                <Text type="secondary">管理班级信息</Text>
              </div>
            </div>
          </div>

          <Form
            form={filterForm}
            layout="inline"
            onFinish={search.submit}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
          >
            <Form.Item name="keyword" label="关键词">
              <Input placeholder="班级名称" allowClear style={{ width: 240 }} />
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
          {school && (
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={openCreate}>
                新增
              </Button>
            </Space>
          )}
          <Table rowKey="id" columns={columns} {...tableProps} />
        </>
      ) : (
        selectedPanel === 'camera' ? (
          <ClassCameraDetectPage
            classInfo={selectedClass}
            onBack={() => {
              setSelectedClass(null)
              setSelectedPanel('students')
            }}
          />
        ) : (
          <StudentManager
            classInfo={selectedClass}
            onBack={() => {
              setSelectedClass(null)
              setSelectedPanel('students')
            }}
          />
        )
      )}

      <Modal
        title={editing ? '编辑班级' : '新增班级'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form form={modalForm} layout="vertical">
          <Form.Item name="name" label="班级名称" rules={[{ required: true, message: '请输入班级名称' }]}>
            <Input placeholder="请输入班级名称" autoFocus />
          </Form.Item>
          <Form.Item name="headTeacherAccountId" label="班主任">
            <Select
              placeholder="选择班主任"
              options={teacherOptions}
              showSearch
              optionFilterProp="label"
              allowClear
              onDropdownVisibleChange={(open) => {
                if (open) {
                  void fetchTeachers()
                }
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
