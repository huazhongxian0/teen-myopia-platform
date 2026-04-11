import { Col, Row, Space, Typography, Card, Tabs } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../../hooks/useAccount.js'
import LogoutEntry from '../../components/LogoutEntry.jsx'
import EyeCareTipsPanel from '../../components/EyeCareTipsPanel.jsx'
import './index.css'

const { Title, Text } = Typography

/**
 * 医生端页面
 * @param {Object} props - 组件属性
 * @param {Function} props.onLogout - 退出登录回调函数
 */
export default function DoctorPage({ onLogout }) {
  const { account } = useAccount()
  const displayName = account?.name ?? account?.accountName ?? '-'
  const roleId = account?.roleId ?? '-'
  const [panelTab, setPanelTab] = useState('overview')
  const navigate = useNavigate()

  return (
    <div className="pageRoot">
      <div className="decoration decoration-1" />
      <div className="decoration decoration-2" />
      
      <Space direction="vertical" size={24} className="pageWrap">
        <Card className="heroCard">
          <div className="heroContent">
            <div className="heroLeft">
              <div className="avatar">👨‍⚕️</div>
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  欢迎，{displayName}
                </Title>
                <Text type="secondary">
                  医生端 · {roleId}
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
            <Row gutter={[20, 20]}>
              <Col xs={24} md={8}>
                <Card className="statCard" hoverable onClick={() => navigate('/doctor/registration')}>
                  <div className="statIcon">📋</div>
                  <Title level={2} className="statValue">-</Title>
                  <Text className="statLabel">今日待诊</Text>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="statCard">
                  <div className="statIcon">📊</div>
                  <Title level={2} className="statValue">-</Title>
                  <Text className="statLabel">本周筛查</Text>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="statCard">
                  <div className="statIcon">⚠️</div>
                  <Title level={2} className="statValue">-</Title>
                  <Text className="statLabel">需要关注</Text>
                </Card>
              </Col>
            </Row>

            <Row gutter={[20, 20]}>
              <Col xs={24} md={12}>
                <Card className="sectionCard" title="快速操作">
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Card className="actionCard" hoverable onClick={() => navigate('/doctor/registration')}>
                      <div className="actionIcon">🔍</div>
                      <div className="actionContent">
                        <Text strong className="actionTitle">今日接诊</Text>
                        <Text type="secondary" className="actionDesc">
                          查看指定日期预约并录入检查
                        </Text>
                      </div>
                    </Card>
                    <Card className="actionCard" hoverable onClick={() => navigate('/doctor/appointments')}>
                      <div className="actionIcon">🗂</div>
                      <div className="actionContent">
                        <Text strong className="actionTitle">预约总览</Text>
                        <Text type="secondary" className="actionDesc">
                          查看全部时间范围内预约记录
                        </Text>
                      </div>
                    </Card>
                    <Card className="actionCard" hoverable onClick={() => navigate('/doctor/archives')}>
                      <div className="actionIcon">📝</div>
                      <div className="actionContent">
                        <Text strong className="actionTitle">诊断报告</Text>
                        <Text type="secondary" className="actionDesc">
                          查看当前医生名下病人档案
                        </Text>
                      </div>
                    </Card>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="sectionCard" title="健康提示">
                  <EyeCareTipsPanel mode="doctor" />
                </Card>
              </Col>
            </Row>
          </div>

          <div className="sideColumn">
            <Card className="sideCard">
              <Tabs
                activeKey={panelTab}
                onChange={setPanelTab}
                tabPosition="left"
                size="large"
                items={[
                  { key: 'overview', label: '概览', children: <div className="sideEmpty">暂无更多内容</div> },
                  { key: 'screening', label: '筛查', children: <div className="sideEmpty">暂无更多内容</div> },
                  { key: 'report', label: '报告', children: <div className="sideEmpty">暂无更多内容</div> },
                ]}
              />
            </Card>
          </div>
        </div>
      </Space>
    </div>
  )
}
