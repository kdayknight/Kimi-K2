import { KIMI_MODEL } from './kimi'
import { tools, toolMap } from './tools'
import type { Message } from './supabase'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
  tool_call_id?: string
  name?: string
}

export interface ToolExecution {
  name: string
  arguments: Record<string, any>
  result: any
}

const callKimiAPI = async (body: any) => {
  const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kimi-chat`

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${errorText}`)
  }

  return response
}

export const createChatCompletion = async (
  messages: ChatMessage[],
  onToolExecution?: (execution: ToolExecution) => void
): Promise<string> => {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: 'You are Pitch, an AI-powered presentation assistant. Your primary role is to help users create engaging, professional slide presentations. You can search the web for current information, generate slides with compelling content, create high-quality 2K images for slides using Nano Banana Pro, and analyze uploaded documents to extract insights for presentations. Always provide well-structured, visually-focused content suitable for slides.'
  }

  const chatMessages = [systemMessage, ...messages]

  try {
    let finishReason: string | null = null
    let currentMessages = [...chatMessages]

    while (finishReason === null || finishReason === 'tool_calls') {
      const response = await callKimiAPI({
        model: KIMI_MODEL,
        messages: currentMessages,
        temperature: 0.6,
        tools: tools,
        tool_choice: 'auto',
        use_search: true,
        stream: false
      })

      const completion = await response.json()
      const choice = completion.choices[0]
      finishReason = choice.finish_reason

      if (finishReason === 'tool_calls' && choice.message.tool_calls) {
        currentMessages.push(choice.message as any)

        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.type !== 'function') continue

          const toolName = toolCall.function.name
          const toolArguments = JSON.parse(toolCall.function.arguments)
          const toolFunction = toolMap[toolName]

          if (toolFunction) {
            const toolResult = await Promise.resolve(toolFunction(toolArguments))

            if (onToolExecution) {
              onToolExecution({
                name: toolName,
                arguments: toolArguments,
                result: toolResult
              })
            }

            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(toolResult)
            })
          }
        }
      } else if (choice.message.content) {
        return choice.message.content
      }
    }

    return 'I apologize, but I was unable to generate a response.'
  } catch (error) {
    console.error('Error in chat completion:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `I apologize, but I encountered an error: ${errorMessage}. Please check the console for more details.`
  }
}

export const createStreamingChatCompletion = async (
  messages: ChatMessage[],
  onChunk?: (content: string) => void,
  onToolExecution?: (execution: ToolExecution) => void
): Promise<string> => {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: 'You are Pitch, an AI-powered presentation assistant. Your primary role is to help users create engaging, professional slide presentations. You can search the web for current information, generate slides with compelling content, create high-quality 2K images for slides using Nano Banana Pro, and analyze uploaded documents to extract insights for presentations. Always provide well-structured, visually-focused content suitable for slides.'
  }

  const chatMessages = [systemMessage, ...messages]

  try {
    let finishReason: string | null = null
    let currentMessages = [...chatMessages]
    let fullMessage = ''

    while (finishReason === null || finishReason === 'tool_calls') {
      const response = await callKimiAPI({
        model: KIMI_MODEL,
        messages: currentMessages,
        temperature: 0.6,
        tools: tools,
        tool_choice: 'auto',
        stream: true,
        use_search: true
      })

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response reader')
      }

      const decoder = new TextDecoder()
      const toolCalls: Array<{
        id: string
        type: 'function'
        function: {
          name: string
          arguments: string
        }
      }> = []

      let msg = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || line.trim() === 'data: [DONE]') continue

          if (line.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(line.slice(6))
              const delta = chunk.choices[0].delta

              if (delta.content) {
                msg += delta.content
                fullMessage += delta.content
                if (onChunk) {
                  onChunk(delta.content)
                }
              }

              if (delta.tool_calls) {
                for (const toolCallChunk of delta.tool_calls) {
                  if (toolCallChunk.index !== undefined) {
                    while (toolCalls.length <= toolCallChunk.index) {
                      toolCalls.push({
                        id: '',
                        type: 'function',
                        function: {
                          name: '',
                          arguments: ''
                        }
                      })
                    }

                    const tc = toolCalls[toolCallChunk.index]

                    if (toolCallChunk.id) {
                      tc.id += toolCallChunk.id
                    }
                    if (toolCallChunk.function?.name) {
                      tc.function.name += toolCallChunk.function.name
                    }
                    if (toolCallChunk.function?.arguments) {
                      tc.function.arguments += toolCallChunk.function.arguments
                    }
                  }
                }
              }

              finishReason = chunk.choices[0].finish_reason
            } catch (e) {
              console.error('Error parsing stream chunk:', e)
            }
          }
        }
      }

      if (finishReason === 'tool_calls' && toolCalls.length > 0) {
        currentMessages.push({
          role: 'assistant',
          content: msg,
          tool_calls: toolCalls
        })

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name
          const toolArguments = JSON.parse(toolCall.function.arguments)
          const toolFunction = toolMap[toolName]

          if (toolFunction) {
            const toolResult = await Promise.resolve(toolFunction(toolArguments))

            if (onToolExecution) {
              onToolExecution({
                name: toolName,
                arguments: toolArguments,
                result: toolResult
              })
            }

            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(toolResult)
            })
          }
        }

        fullMessage = ''
      } else {
        return fullMessage
      }
    }

    return fullMessage
  } catch (error) {
    console.error('Error in streaming chat completion:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `I apologize, but I encountered an error: ${errorMessage}. Please check the console for more details.`
  }
}

export const formatMessagesForAPI = (messages: Message[]): ChatMessage[] => {
  return messages
    .filter(m => !m.is_thinking)
    .map(m => ({
      role: m.role,
      content: m.content
    }))
}
