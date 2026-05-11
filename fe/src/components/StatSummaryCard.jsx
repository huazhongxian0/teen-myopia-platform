import { Card, Typography } from 'antd'

const { Text } = Typography

export default function StatSummaryCard({
  className = '',
  hoverable,
  onClick,
  icon,
  label,
  value,
  decoration,
  bordered,
  ...cardProps
}) {
  const mergedClassName = className
  const cardVariant = bordered === false ? 'borderless' : bordered === true ? 'outlined' : undefined

  return (
    <Card
      className={mergedClassName}
      hoverable={hoverable}
      onClick={onClick}
      variant={cardVariant}
      {...cardProps}
    >
      <div className="statCardContent">
        <div className="statIconWrapper">{icon}</div>
        <div className="statInfo">
          {label !== undefined && label !== null ? (
            typeof label === 'string' || typeof label === 'number'
              ? <Text className="statLabel">{label}</Text>
              : label
          ) : null}
          {value}
        </div>
      </div>
      {decoration ? <div className="statDecoration">{decoration}</div> : null}
    </Card>
  )
}
