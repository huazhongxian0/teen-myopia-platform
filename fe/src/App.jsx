import AppRoutes from './routes/index.js'
import { AccountProvider, useAccount } from './hooks/useAccount.js'

function AppContent() {
  const { token, account, checking, setLogin, clearAccount } = useAccount()
  console.log('account', account)
  return (
    <AppRoutes accessToken={token} account={account} authChecking={checking} onLoginSuccess={setLogin} onLogout={clearAccount} />
  )
}

function App() {
  return (
    <AccountProvider>
      <AppContent />
    </AccountProvider>
  )
}

export default App
