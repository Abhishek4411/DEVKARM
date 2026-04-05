const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

export const AI_ENABLED = Boolean(API_KEY)

export interface AiBlock {
  type: 'function' | 'variable' | 'api'
  name?: string
  params?: string[]
  returnType?: string
  code?: string
  value?: string
  method?: string
  url?: string
}

const SYSTEM_PROMPT = `You are a code generation assistant for a visual programming tool called DEVKARM. The user will describe what they want to build. You must respond with ONLY a valid JSON array of code blocks. Each block has: { type: 'function' | 'variable' | 'api', name: string, params?: string[], returnType?: string, code?: string, value?: string, method?: string, url?: string }. No explanation, no markdown, just the JSON array.`

export async function describeToBlocks(description: string): Promise<AiBlock[]> {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY is not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const json = await res.json()
  const text: string = json.content?.[0]?.text ?? ''

  // Strip accidental markdown code fences if the model wraps output
  const stripped = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim()
  return JSON.parse(stripped) as AiBlock[]
}
