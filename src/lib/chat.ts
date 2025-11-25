import { kimiClient, KIMI_MODEL } from './kimi'
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

export const createChatCompletion = async (
  messages: ChatMessage[],
  onToolExecution?: (execution: ToolExecution) => void
): Promise<string> => {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: 'You are Kimi, an AI assistant created by Moonshot AI. You are helpful, creative, and can use tools to assist users with various tasks including checking weather, creating slides, generating images, and searching the web.'
  }

  const chatMessages = [systemMessage, ...messages]

  try {
    let finishReason: string | null = null
    let currentMessages = [...chatMessages]

    while (finishReason === null || finishReason === 'tool_calls') {
      const completion = await kimiClient.chat.completions.create({
        model: KIMI_MODEL,
        messages: currentMessages as any,
        temperature: 0.6,
        tools: tools as any,
        tool_choice: 'auto'
      })

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
            const toolResult = toolFunction(toolArguments)

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
    return 'I apologize, but I encountered an error. This is a demo mode. Please configure your Kimi API key in the .env file to enable real AI responses.'
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
