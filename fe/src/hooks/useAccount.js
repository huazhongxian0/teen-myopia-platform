import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import { httpClient } from '../services/http/index.js'

/**
 * 用于存储和共享登录信息的自定义 Hook
 * @returns {{
 *   token: Object | null,
 *   setToken: Function,
 *   clearAccount: Function,
 *   isLoggedIn: boolean
 * }}
 */
export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) {
    throw new Error('useAccount must be used within AccountProvider')
  }
  return ctx
}

const AccountContext = createContext(null)

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function AccountProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'))
  const [account, setAccount] = useState(() => {
    const raw = localStorage.getItem('account')
    return raw ? safeJsonParse(raw) : null
  })
  const [checking, setChecking] = useState(true)

  function setLogin(data) {
    localStorage.setItem('access_token', data.token)
    const permissionPointKeys = (data.permissionPoints ?? []).map((p) => p?.name).filter(Boolean)
    localStorage.setItem(
      'account',
      JSON.stringify({
        accountId: data.accountId,
        accountName: data.accountName,
        name: data.name,
        roleId: data.roleId,
        permissionPoints: permissionPointKeys,
      }),
    )
    setToken(data.token)
    setAccount({
      accountId: data.accountId,
      accountName: data.accountName,
      name: data.name,
      roleId: data.roleId,
      permissionPoints: permissionPointKeys,
    })
  }

  function clearAccount() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('account')
    setToken(null)
    setAccount(null)
  }

  useEffect(() => {
    let cancelled = false

    async function verify() {
      const storedToken = localStorage.getItem('access_token')
      if (!storedToken) {
        if (!cancelled) setChecking(false)
        return
      }
      try {
        const data = await httpClient.post('/api/users/token/verify')
        if (cancelled) return
        setLogin(data)
      } catch {
        if (cancelled) return
        clearAccount()
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const permissionPoints = useMemo(() => account?.permissionPoints ?? [], [account])

  const permissionKeySet = useMemo(() => {
    const set = new Set()
    for (const p of permissionPoints) {
      if (typeof p === 'string') {
        set.add(p)
      } else if (p?.name) {
        set.add(String(p.name))
      }
    }
    return set
  }, [permissionPoints])

  const permissionAuthCodeSet = useMemo(() => {
    const set = new Set()
    for (const p of permissionPoints) {
      if (p !== undefined && p !== null) set.add(String(p))
    }
    console.log('这个账户更新了一次权限点',set)
    return set
  }, [permissionPoints])

  const value = useMemo(() => {
    function hasPermission(key) {
      if (!key) return false
      return permissionKeySet.has(String(key))
    }

    function hasAuthCode(authCode) {
      if (authCode === undefined || authCode === null) return false
      return permissionAuthCodeSet.has(String(authCode))
    }

    function hasAny(keys) {
      if (!Array.isArray(keys) || keys.length === 0) return false
      return keys.some((k) => hasPermission(k))
    }

    return {
      token,
      account,
      checking,
      isLoggedIn: !!token,
      permissionPoints,
      hasPermission,
      hasAuthCode,
      hasAny,
      setLogin,
      clearAccount,
    }
  }, [account, checking, permissionAuthCodeSet, permissionKeySet, permissionPoints, token])

  return createElement(AccountContext.Provider, { value }, children)
}
