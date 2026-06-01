import { httpClient } from './http/index.js'

export function evaluateRisk(studentAccountId) {
  return httpClient.post('/api/riskWarning/evaluate', { studentAccountId })
}

export function batchEvaluateRisk(classId) {
  return httpClient.post('/api/riskWarning/batchEvaluate', { classId })
}

export function listMyWarnings({ pageNo = 1, pageSize = 10 } = {}) {
  return httpClient.post('/api/riskWarning/listMine', { pageNo, pageSize })
}

export function listMyMessages({ pageNo = 1, pageSize = 10 } = {}) {
  return httpClient.post('/api/riskWarning/listMyMessages', { pageNo, pageSize })
}

export function readMessage(messageId) {
  return httpClient.post('/api/riskWarning/readMessage', { messageId })
}

export function resolveWarning(warningId, resolutionNote) {
  return httpClient.post('/api/riskWarning/resolve', { warningId, resolutionNote })
}

export function listClassWarnings({ classId, pageNo = 1, pageSize = 10 } = {}) {
  return httpClient.post('/api/riskWarning/listByClass', { classId, pageNo, pageSize })
}

export function adminOverview() {
  return httpClient.post('/api/riskWarning/adminOverview', {})
}
