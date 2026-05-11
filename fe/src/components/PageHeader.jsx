import { Card, Typography } from 'antd'

const { Title, Text } = Typography

export default function PageHeader({ avatar, title, subtitle, actions, className = '', bodyStyle, children }) {
  return (
    <Card bordered={false} className={className} bodyStyle={bodyStyle}>
      <div className="appHeader">
        <div className="appHeaderLeft">
          {avatar ? <div className="appHeaderAvatar">{avatar}</div> : null}
          <div className="appHeaderText">
            <Title level={3} className="appHeaderTitle">
              {title}
            </Title>
            {subtitle
              ? (typeof subtitle === 'string' || typeof subtitle === 'number'
                ? <Text type="secondary">{subtitle}</Text>
                : subtitle)
              : null}
          </div>
        </div>
        {actions ? <div className="appHeaderRight">{actions}</div> : null}
      </div>
      {children}
    </Card>
  )
}
