import LogoutEntry from './LogoutEntry.jsx'

export default function LogoutButton({ onLogout, children = '退出登录', className = '', ...rest }) {
  const mergedClassName = ['appLogoutBtn', className].filter(Boolean).join(' ')
  return (
    <LogoutEntry onLogout={onLogout} className={mergedClassName} {...rest}>
      {children}
    </LogoutEntry>
  )
}

