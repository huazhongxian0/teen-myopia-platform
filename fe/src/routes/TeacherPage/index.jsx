import { Col, Row, Space, Typography, Card, Tabs, Button, Empty, Spin, message } from 'antd'
import { useState } from 'react'
import { useAccount } from '../../hooks/useAccount.js'
import { useMount } from 'ahooks'
import { httpClient } from '../../services/http/index.js'
import LogoutEntry from '../../components/LogoutEntry.jsx'
import StudentManager from '../AllBackUp/StudentManager.jsx'
import ClassCameraDetectPage from '../ClassCameraDetectPage/index.jsx'
import './index.css'

const { Title, Text } = Typography

export default function TeacherPage({ onLogout }) {
  const { account } = useAccount()
  const displayName = account?.name ?? account?.accountName ?? '-'
  const roleId = account?.roleId ?? '-'
  const [activeTab, setActiveTab] = useState('overview')
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedPanel, setSelectedPanel] = useState('students')

  async function fetchClasses() {
    try {
      setLoading(true)
      const data = await httpClient.post('/api/school/teacher/classes', { 
        teacherAccountId: account?.id 
      })
      setClasses(data?.list || [])
    } catch (e) {
      message.error(e?.message || '加载班级失败')
      setClasses([])
    } finally {
      setLoading(false)
    }
  }

  useMount(() => {
    void fetchClasses()
  })

  return (
    <div className="pageRoot">
      <div className="decoration decoration-1" />
      <div className="decoration decoration-2" />
      
      <Space direction="vertical" size={24} className="pageWrap">
        <Card className="heroCard">
          <div className="heroContent">
            <div className="heroLeft">
              <div className="avatar">👨‍🏫</div>
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  欢迎，{displayName}
                </Title>
                <Text type="secondary">
                  老师端 · {roleId}
                </Text>
              </div>
            </div>
            <div className="heroRight">
              <LogoutEntry as="a" onLogout={onLogout} className="logoutBtn">
                退出登录
              </LogoutEntry>
            </div>
          </div>
        </Card>

        <div className="pageLayout">
          <div className="mainColumn">
            {activeTab === 'overview' && (
              <>
                <Row gutter={[20, 20]}>
                  <Col xs={24} md={8}>
                    <Card className="statCard">
                      <div className="statIcon">👥</div>
                      <Title level={2} className="statValue">{classes.length}</Title>
                      <Text className="statLabel">管理班级</Text>
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card className="statCard">
                      <div className="statIcon">🔔</div>
                      <Title level={2} className="statValue">-</Title>
                      <Text className="statLabel">待关注</Text>
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card className="statCard">
                      <div className="statIcon">📝</div>
                      <Title level={2} className="statValue">-</Title>
                      <Text className="statLabel">筛查记录</Text>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[20, 20]}>
                  <Col xs={24} md={12}>
                    <Card className="sectionCard" title="快捷操作">
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Card className="actionCard" hoverable onClick={() => setActiveTab('classes')}>
                          <div className="actionIcon">👥</div>
                          <div className="actionContent">
                            <Text strong className="actionTitle">班级管理</Text>
                            <Text type="secondary" className="actionDesc">
                              管理您的班级和学生
                            </Text>
                          </div>
                        </Card>
                        <Card className="actionCard" hoverable>
                          <div className="actionIcon">📊</div>
                          <div className="actionContent">
                            <Text strong className="actionTitle">视力统计</Text>
                            <Text type="secondary" className="actionDesc">
                              查看班级学生视力统计数据
                            </Text>
                          </div>
                        </Card>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card className="sectionCard" title="护眼知识">
                      <div className="healthTip">
                        <div className="tipIcon">💡</div>
                        <div className="tipContent">
                          <Text strong>今日护眼小贴士</Text>
                          <Text type="secondary">
                            提醒学生保持充足的户外活动时间，每天至少2小时，可以有效预防近视。
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </>
            )}

            {activeTab === 'classes' && (
              selectedClass ? (
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
              ) : (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>我的班级</Title>
                      <Text type="secondary">点击班级卡片进入学生管理</Text>
                    </div>
                    <Button onClick={fetchClasses} loading={loading}>
                      刷新
                    </Button>
                  </div>

                  <Spin spinning={loading}>
                    {classes.length === 0 ? (
                      <Card>
                        <Empty description="暂无管理的班级" />
                      </Card>
                    ) : (
                      <Row gutter={[20, 20]}>
                        {classes.map((cls) => (
                          <Col xs={24} sm={12} md={8} key={cls.id}>
                            <Card 
                              className="classCard"
                              hoverable
                              onClick={() => {
                                setSelectedPanel('students')
                                setSelectedClass(cls)
                              }}
                            >
                              <div className="classCardIcon">🏫</div>
                              <Title level={4} className="classCardTitle">{cls.name}</Title>
                              <Text type="secondary" className="classCardMeta">
                                创建于 {new Date(cls.createdAt).toLocaleDateString()}
                              </Text>
                              <div className="classCardAction">
                                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                  <Button
                                    type="primary"
                                    block
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPanel('students')
                                      setSelectedClass(cls)
                                    }}
                                  >
                                    管理学生
                                  </Button>
                                  <Button
                                    block
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPanel('camera')
                                      setSelectedClass(cls)
                                    }}
                                  >
                                    摄像头检测
                                  </Button>
                                </Space>
                              </div>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </Spin>
                </Space>
              )
            )}
          </div>

          <div className="sideColumn">
            <Card className="sideCard">
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                tabPosition="left"
                size="large"
                items={[
                  { key: 'overview', label: '概览', children: <div className="sideEmpty">用于切换查看概览数据</div> },
                  { key: 'classes', label: '班级管理', children: <div className="sideEmpty">用于进入班级与学生管理</div> },
                ]}
              />
            </Card>
          </div>
        </div>
      </Space>
    </div>
  )
}
