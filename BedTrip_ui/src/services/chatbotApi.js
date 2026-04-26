import { API_BASE, safeJsonFetch } from './httpClient'

export async function fetchChatbotConfig() {
  const { statusCode, data } = await safeJsonFetch(`${API_BASE}/api/chatbot/config`)
  if (statusCode >= 400 || !data) {
    throw new Error(data?.error || 'chatbot_config_unavailable')
  }
  return data
}

export async function sendChatbotMessage(payload) {
  const { statusCode, data } = await safeJsonFetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  })
  if (statusCode >= 400 || !data) {
    throw new Error(data?.error || 'chatbot_message_failed')
  }
  return data
}
