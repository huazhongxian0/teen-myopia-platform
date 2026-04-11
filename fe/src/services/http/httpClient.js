import axios from 'axios'
import config from '../../../../shared-config.json'

const baseURL = `${config.server.protocol}://${config.server.domain}:${config.server.port}${config.endpoints.api}`

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? baseURL,
  timeout: 15000,
  withCredentials: true,
})

let accessTokenGetter = () => localStorage.getItem('access_token')

export function setAccessTokenGetter(getter) {
  if (typeof getter === 'function') {
    accessTokenGetter = getter
  }
}

httpClient.interceptors.request.use((config) => {
  const token = accessTokenGetter?.()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

httpClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error?.response?.status ?? 0
    const data = error?.response?.data
    const message = data?.message || error?.message || 'Request failed'
    return Promise.reject({ status, data, message, error })
  },
)

export default httpClient
