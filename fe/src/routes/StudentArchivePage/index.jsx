import { Button, Card, Space, Tag, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoutEntry from '../../components/LogoutEntry.jsx'
import VisionArchiveTimeline from '../../components/VisionArchiveTimeline.jsx'
import { useAccount } from '../../hooks/useAccount.js'
import './index.css'

const { Title, Text } = Typography

export default function StudentArchivePage({ onLogout }) {
  const { account } = useAccount()
  const navigate = useNavigate()

  const [meta, setMeta] = useState({ total: 0, latest: null })
  const handleMetaChange = useCallback((next) => {
    setMeta(next)
  }, [])

  return (
    <div className="archiveRoot">
      <div className="archiveBg" />
      <div className="archiveNoise" />

      <div className="archiveWrap">
        <div className="archiveTopbar">
          <div>
            <Title level={3} className="archiveTitle">
              视力档案
            </Title>
            <Text className="archiveSubtitle">
              {account?.name ?? account?.accountName ?? '-'} · 记录会随着每次接诊自动更新
            </Text>
          </div>
          <Space size={10}>
            <Button onClick={() => navigate('/home')}>返回</Button>
            <LogoutEntry onLogout={onLogout}>退出登录</LogoutEntry>
          </Space>
        </div>

        <div className="archiveGrid">
          <Card className="archiveHero" bordered={false}>
            <div className="heroInner">
              <div className="heroBadge">个人档案 · 汇总</div>
              <div className="heroMetricRow">
                <div className="heroMetric">
                  <div className="heroMetricLabel">最近视力（左/右）</div>
                  <div className="heroMetricValue">{meta?.latest?.latest ?? '-'}</div>
                </div>
                <div className="heroMetric">
                  <div className="heroMetricLabel">最近检查日期</div>
                  <div className="heroMetricValue">{meta?.latest?.latestDate ?? '-'}</div>
                </div>
                <div className="heroMetric">
                  <div className="heroMetricLabel">接诊医生</div>
                  <div className="heroMetricValue">{meta?.latest?.doctor ?? '-'}</div>
                </div>
              </div>
              <div className="heroFoot">
                <Tag className="heroTag">共 {meta?.total ?? 0} 条记录</Tag>
                <Tag className="heroTag">点击任意卡片查看详情</Tag>
              </div>
            </div>
          </Card>

          <VisionArchiveTimeline
            mode="student"
            title="检查记录"
            onMetaChange={handleMetaChange}
          />
        </div>
      </div>
    </div>
  )
}
