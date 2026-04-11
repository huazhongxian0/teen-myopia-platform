import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { httpClient } from '../services/http/index.js'
import '../styles/Login.css'

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export default function Login({ onLoginSuccess }) {
  const existingAccount = useMemo(() => {
    const raw = localStorage.getItem('account')
    return raw ? safeJsonParse(raw) : null
  }, [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('access_token')
    if (!token) return

    async function verify() {
      setError(null)
      setLoading(true)
      try {
        const data = await httpClient.post('/api/users/token/verify')
        if (!cancelled) {
          onLoginSuccess?.(data)
        }
      } catch (e) {
        if (!cancelled) {
          setError(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [onLoginSuccess])

  async function handleSubmit(values) {
    setError(null)
    setLoading(true)
    try {
      const data = await httpClient.post('/api/users/login', {
        accountName: values.accountName,
        password: values.password,
      })
      onLoginSuccess?.(data)
    } catch (e) {
      const status = e?.status ?? 0
      if (status === 401) {
        setError('账号或密码错误')
      } else {
        setError(e?.message || '登录失败')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-decoration login-decoration-1" />
      <div className="login-decoration login-decoration-2" />
      
      <div className="login-card">
        <Card bordered={false}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div className="login-header">
              <div className="login-logo">👁️</div>
              <Typography.Title level={3} className="login-title">
                区域性青少年近视防控系统
              </Typography.Title>
              <Typography.Paragraph className="login-subtitle">
                守护青少年视力健康
              </Typography.Paragraph>
            </div>

            {error ? (
              <div className="login-alert">
                <Alert type="error" showIcon message={error} />
              </div>
            ) : null}

            <Form
              className="login-form"
              form={form}
              layout="vertical"
              initialValues={{
                accountName: existingAccount?.accountName ?? 'root',
                password: '123456',
              }}
              onFinish={handleSubmit}
            >
              <Form.Item name="accountName" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
                <Input autoComplete="username" placeholder="请输入账号" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password autoComplete="current-password" placeholder="请输入密码" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block loading={loading} className="login-button">
                  登录
                </Button>
              </Form.Item>
            </Form>
          </Space>
        </Card>
      </div>
    </div>
  )
}
