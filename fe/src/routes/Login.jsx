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

  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form] = Form.useForm()
  const isRegisterMode = mode === 'register'

  function handleModeChange(nextMode) {
    setMode(nextMode)
  }

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

  useEffect(() => {
    setError(null)
    form.resetFields()
    form.setFieldsValue({
      name: existingAccount?.name ?? '',
      accountName: existingAccount?.accountName ?? 'root',
      phoneNumber: '',
      password: '123456',
      confirmPassword: '123456',
    })
  }, [existingAccount, form, mode])

  async function handleSubmit(values) {
    setError(null)
    setLoading(true)
    try {
      const data = isRegisterMode
        ? await httpClient.post('/api/users/register', {
            name: values.name,
            accountName: values.accountName,
            phoneNumber: values.phoneNumber || undefined,
            password: values.password,
          })
        : await httpClient.post('/api/users/login', {
            accountName: values.accountName,
            password: values.password,
          })
      onLoginSuccess?.(data)
    } catch (e) {
      const status = e?.status ?? 0
      if (isRegisterMode && status === 409) {
        setError('账号已存在，请更换后重新注册')
      } else if (status === 401) {
        setError('账号或密码错误')
      } else if (status === 400) {
        setError(isRegisterMode ? '注册信息不完整或格式不正确' : '登录信息不完整或格式不正确')
      } else {
        setError(e?.message || (isRegisterMode ? '注册失败' : '登录失败'))
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
        <Card variant="borderless">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div className="login-header">
              <div className="login-logo">👁️</div>
              <Typography.Title level={3} className="login-title">
                区域性青少年近视防控系统
              </Typography.Title>
              <Typography.Paragraph className="login-subtitle">
                {isRegisterMode ? '创建账户后可直接进入系统' : '守护青少年视力健康'}
              </Typography.Paragraph>
            </div>

            <div className="login-mode-switch" role="tablist" aria-label="登录注册切换">
              <div className={`login-mode-indicator ${isRegisterMode ? 'is-register' : ''}`} />
              <label
                className={`login-mode-option ${!isRegisterMode ? 'is-active' : ''}`}
                role="tab"
                aria-selected={!isRegisterMode}
                tabIndex={!isRegisterMode ? 0 : -1}
              >
                <input
                  className="login-mode-input"
                  type="radio"
                  name="login-mode"
                  value="login"
                  checked={!isRegisterMode}
                  onChange={() => handleModeChange('login')}
                />
                <span className="login-mode-label">登录</span>
              </label>
              <label
                className={`login-mode-option ${isRegisterMode ? 'is-active' : ''}`}
                role="tab"
                aria-selected={isRegisterMode}
                tabIndex={isRegisterMode ? 0 : -1}
              >
                <input
                  className="login-mode-input"
                  type="radio"
                  name="login-mode"
                  value="register"
                  checked={isRegisterMode}
                  onChange={() => handleModeChange('register')}
                />
                <span className="login-mode-label">注册</span>
              </label>
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
              onFinish={handleSubmit}
            >
              {isRegisterMode ? (
                <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                  <Input autoComplete="name" placeholder="请输入姓名" />
                </Form.Item>
              ) : null}
              <Form.Item name="accountName" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
                <Input autoComplete="username" placeholder="请输入账号" />
              </Form.Item>
              {isRegisterMode ? (
                <Form.Item
                  name="phoneNumber"
                  label="手机号"
                  rules={[
                    {
                      pattern: /^$|^1\d{10}$/,
                      message: '请输入正确的手机号',
                    },
                  ]}
                >
                  <Input autoComplete="tel" placeholder="请输入手机号，不填则使用系统默认值" />
                </Form.Item>
              ) : null}
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password autoComplete="current-password" placeholder="请输入密码" />
              </Form.Item>
              {isRegisterMode ? (
                <Form.Item
                  name="confirmPassword"
                  label="确认密码"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: '请再次输入密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('两次输入的密码不一致'))
                      },
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" placeholder="请再次输入密码" />
                </Form.Item>
              ) : null}
              <Form.Item style={{ marginBottom: 0 }}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Button type="primary" htmlType="submit" block loading={loading} className="login-button">
                    {isRegisterMode ? '立即注册' : '登录'}
                  </Button>
                  <div className="login-mode-footer">
                    <Typography.Text className="login-mode-footer-text">
                      {isRegisterMode ? '已经创建过账号？' : '还没有账号？'}
                    </Typography.Text>
                    <Typography.Link
                      className="login-mode-link"
                      onClick={() => handleModeChange(isRegisterMode ? 'login' : 'register')}
                    >
                      {isRegisterMode ? '切换到登录' : '切换到注册'}
                    </Typography.Link>
                  </div>
                </Space>
              </Form.Item>
            </Form>
          </Space>
        </Card>
      </div>
    </div>
  )
}
