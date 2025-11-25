import OpenAI from 'openai'

const apiKey = import.meta.env.VITE_KIMI_API_KEY
const baseURL = import.meta.env.VITE_KIMI_BASE_URL

export const kimiClient = new OpenAI({
  apiKey: apiKey || 'demo_key',
  baseURL: baseURL || 'https://api.moonshot.cn/v1',
  dangerouslyAllowBrowser: true
})

export const KIMI_MODEL = 'moonshot-v1-128k'
