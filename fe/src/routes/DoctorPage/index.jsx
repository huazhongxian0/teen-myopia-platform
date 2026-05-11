import { Col, Row, Space, Typography, Card, Tabs } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChartOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useAccount } from '../../hooks/useAccount.js'
import EyeCareTipsPanel from '../../components/EyeCareTipsPanel.jsx'
import LogoutButton from '../../components/LogoutButton.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import StatSummaryCard from '../../components/StatSummaryCard.jsx'
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
 
      <Space direction="vertical" size={24} className="pageWrap">
        <PageHeader
          className="heroCard"
          avatar={<div className="avatar">👨‍⚕️</div>}
          title={`欢迎，${displayName}`}
          subtitle={`医生端 · ${roleId}`}
          actions={<LogoutButton onLogout={onLogout} />}
        />

        <div className="pageLayout">
          <div className="mainColumn">
            <Row gutter={[20, 20]}>
              <Col xs={24} md={8}>
                <StatSummaryCard
                  className="statSummaryCard statSummaryCard-blue"
                  bordered={false}
                  hoverable
                  onClick={() => navigate('/doctor/registration')}
                  icon={<CalendarOutlined className="statIcon" />}
                  label="今日待诊"
                  value={<Title level={2} className="statValue">-</Title>}
                  decoration={<CalendarOutlined />}
                />
              </Col>
              <Col xs={24} md={8}>
                <StatSummaryCard
                  className="statSummaryCard statSummaryCard-green"
                  bordered={false}
                  icon={<BarChartOutlined className="statIcon" />}
                  label="本周筛查"
                  value={<Title level={2} className="statValue">-</Title>}
                  decoration={<BarChartOutlined />}
                />
              </Col>
              <Col xs={24} md={8}>
                <StatSummaryCard
                  className="statSummaryCard statSummaryCard-orange"
                  bordered={false}
                  icon={<ExclamationCircleOutlined className="statIcon" />}
                  label="需要关注"
                  value={<Title level={2} className="statValue">-</Title>}
                  decoration={<ExclamationCircleOutlined />}
                />
              </Col>
            </Row>

            <Row gutter={[20, 20]}>
              <Col xs={24} md={24}>
                <Card className="sectionCard" title="快速操作">
                  <Row gutter={[20, 20]}>
                    <Col xs={24} md={8}>
                      <Card
                        className="actionCard"
                        hoverable
                        variant="borderless"
                        onClick={() => navigate('/doctor/registration')}
                      >
                        <div className="actionCardInner">
                          <div className="actionIconBox actionIconBox-blue">
                            <SearchOutlined className="actionIcon" />
                          </div>
                          <div className="actionContent">
                            <Text strong className="actionTitle">今日接诊</Text>
                            <Text type="secondary" className="actionDesc">
                              查看指定日期预约并录入检查
                            </Text>
                          </div>
                          <div className="actionArrow">→</div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card
                        className="actionCard"
                        hoverable
                        variant="borderless"
                        onClick={() => navigate('/doctor/appointments')}
                      >
                        <div className="actionCardInner">
                          <div className="actionIconBox actionIconBox-green">
                            <UnorderedListOutlined className="actionIcon" />
                          </div>
                          <div className="actionContent">
                            <Text strong className="actionTitle">预约总览</Text>
                            <Text type="secondary" className="actionDesc">
                              查看全部时间范围内预约记录
                            </Text>
                          </div>
                          <div className="actionArrow">→</div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card
                        className="actionCard"
                        hoverable
                        variant="borderless"
                        onClick={() => navigate('/doctor/archives')}
                      >
                        <div className="actionCardInner">
                          <div className="actionIconBox actionIconBox-purple">
                            <FileTextOutlined className="actionIcon" />
                          </div>
                          <div className="actionContent">
                            <Text strong className="actionTitle">诊断报告</Text>
                            <Text type="secondary" className="actionDesc">
                              查看当前医生名下病人档案
                            </Text>
                          </div>
                          <div className="actionArrow">→</div>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col xs={24} md={24}>
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
