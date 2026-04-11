import { Button } from 'antd'

export default function LogoutEntry({ as = 'button', onLogout, children = '退出登录', ...rest }) {
  if (as === 'a') {
    const { onClick, ...anchorRest } = rest
    return (
      <a
        {...anchorRest}
        onClick={(e) => {
          onClick?.(e)
          onLogout?.()
        }}
      >
        {children}
      </a>
    )
  }

  const { onClick, ...buttonRest } = rest
  return (
    <Button
      {...buttonRest}
      onClick={(e) => {
        onClick?.(e)
        onLogout?.()
      }}
    >
      {children}
    </Button>
  )
}
