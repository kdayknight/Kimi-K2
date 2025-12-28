import { useState, useEffect, useRef } from 'react'
import './App.css'
import { supabase, type Conversation, type Message } from './lib/supabase'
import { createStreamingChatCompletion, formatMessagesForAPI, type ToolExecution } from './lib/chat'
import { FileUpload } from './components/FileUpload'
import { SlideEditor } from './components/SlideEditor'

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [showSlideEditor, setShowSlideEditor] = useState(false)
  const [currentPresentationId, setCurrentPresentationId] = useState<string | null>(null)
  const [, setUploadedFiles] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation)
      loadPresentations(currentConversation)
      loadUploadedFiles(currentConversation)
    }
  }, [currentConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error loading conversations:', error)
      return
    }

    setConversations(data || [])
  }

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading messages:', error)
      return
    }

    setMessages(data || [])
  }

  const loadPresentations = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('presentations')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading presentations:', error)
      return
    }

    if (data && data.length > 0) {
      setCurrentPresentationId(data[0].id)
    } else {
      setCurrentPresentationId(null)
    }
  }

  const loadUploadedFiles = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading uploaded files:', error)
      return
    }

    setUploadedFiles(data || [])
  }

  const createNewConversation = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .insert([{ title: 'New Conversation' }])
      .select()
      .single()

    if (error) {
      console.error('Error creating conversation:', error)
      return
    }

    setConversations([data, ...conversations])
    setCurrentConversation(data.id)
    setMessages([])
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    let conversationId = currentConversation

    if (!conversationId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert([{ title: inputValue.slice(0, 50) }])
        .select()
        .single()

      if (error) {
        console.error('Error creating conversation:', error)
        return
      }

      conversationId = data.id
      setCurrentConversation(conversationId)
      setConversations([data, ...conversations])
    }

    const userMessage = {
      conversation_id: conversationId,
      role: 'user' as const,
      content: inputValue,
      is_thinking: false,
      metadata: {}
    }

    const { data: userMsgData, error: userMsgError } = await supabase
      .from('messages')
      .insert([userMessage])
      .select()
      .single()

    if (userMsgError) {
      console.error('Error sending message:', userMsgError)
      return
    }

    const currentMessages = [...messages, userMsgData]
    setMessages(currentMessages)
    setInputValue('')
    setIsLoading(true)
    setToolExecutions([])

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    const thinkingMessage = {
      conversation_id: conversationId!,
      role: 'assistant' as const,
      content: 'Thinking...',
      is_thinking: true,
      metadata: {}
    }

    const { data: thinkingData, error: thinkingError } = await supabase
      .from('messages')
      .insert([thinkingMessage])
      .select()
      .single()

    if (thinkingError) {
      setIsLoading(false)
      return
    }

    setMessages(prev => [...prev, thinkingData])
    setStreamingContent('')

    try {
      const apiMessages = formatMessagesForAPI(currentMessages)

      const response = await createStreamingChatCompletion(
        apiMessages,
        (chunk) => {
          setStreamingContent(prev => prev + chunk)
        },
        (execution) => {
          setToolExecutions(prev => [...prev, execution])
        }
      )

      await supabase
        .from('messages')
        .delete()
        .eq('id', thinkingData.id)

      const assistantMessage = {
        conversation_id: conversationId!,
        role: 'assistant' as const,
        content: response,
        is_thinking: false,
        metadata: { tool_executions: toolExecutions }
      }

      const { data: assistantData, error: assistantError } = await supabase
        .from('messages')
        .insert([assistantMessage])
        .select()
        .single()

      if (!assistantError && assistantData) {
        setMessages(prev => prev.filter(m => m.id !== thinkingData.id).concat(assistantData))
      }
    } catch (error) {
      console.error('Error in chat completion:', error)

      await supabase
        .from('messages')
        .delete()
        .eq('id', thinkingData.id)

      const errorMessage = {
        conversation_id: conversationId!,
        role: 'assistant' as const,
        content: 'I apologize, but I encountered an error. Please make sure your Kimi API key is configured correctly.',
        is_thinking: false,
        metadata: {}
      }

      const { data: errorData } = await supabase
        .from('messages')
        .insert([errorMessage])
        .select()
        .single()

      if (errorData) {
        setMessages(prev => prev.filter(m => m.id !== thinkingData.id).concat(errorData))
      }
    } finally {
      setIsLoading(false)
      setToolExecutions([])
      setStreamingContent('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    setInputValue(target.value)
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, 200) + 'px'
  }

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <img src="/figures/pitch_icon_copy.png" alt="Pitch" className="logo" />
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <button className="new-chat-btn" onClick={createNewConversation}>
          <span>➕</span>
          {sidebarOpen && (
            <>
              <span>New Chat</span>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>⌘ K</span>
            </>
          )}
        </button>

        <nav className="sidebar-nav">
          {sidebarOpen && (
            <>
              <div className="nav-section">
                <div className="nav-section-title">Pitch+</div>
                <div className="nav-item">
                  <span className="nav-item-icon">📊</span>
                  <span>Pitch Slides</span>
                </div>
                <div className="nav-item">
                  <span className="nav-item-icon">💻</span>
                  <span>Pitch For Coding</span>
                </div>
              </div>

              <div className="nav-section">
                <div className="nav-section-title">Chat History</div>
                <ul className="chat-history-list">
                  {conversations.map((conv) => (
                    <li
                      key={conv.id}
                      className={`chat-history-item ${currentConversation === conv.id ? 'active' : ''}`}
                      onClick={() => setCurrentConversation(conv.id)}
                    >
                      {conv.title}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="nav-item">
            <span style={{ fontSize: '20px' }}>👤</span>
            {sidebarOpen && <span>Log In</span>}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <img src="/figures/pitch_copy.png" alt="Pitch" className="welcome-logo-img" />
              <div className="input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="input-box"
                  placeholder="Ask Anything..."
                  value={inputValue}
                  onInput={handleInput}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  rows={1}
                />
                <div className="input-actions">
                  {currentConversation && (
                    <FileUpload
                      conversationId={currentConversation}
                      onFileUploaded={(file) => {
                        setUploadedFiles(prev => [file, ...prev])
                      }}
                    />
                  )}
                  {currentPresentationId && (
                    <button
                      className="input-btn"
                      onClick={() => setShowSlideEditor(!showSlideEditor)}
                      title="Toggle Slide Editor"
                    >
                      🎨
                    </button>
                  )}
                  <button
                    className="input-btn send-btn"
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    title="Send message"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-container">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.role} ${message.is_thinking ? 'thinking' : ''}`}>
                  <div className="message-header">
                    <span className="message-role">
                      {message.role === 'user' ? 'You' : 'Pitch'}
                    </span>
                  </div>
                  <div className="message-content">
                    {message.is_thinking ? (
                      <div className="thinking-indicator">
                        <span>Thinking</span>
                        <span className="thinking-dot"></span>
                        <span className="thinking-dot"></span>
                        <span className="thinking-dot"></span>
                      </div>
                    ) : (
                      <>
                        {message.content}
                        {message.metadata?.tool_executions && Array.isArray(message.metadata.tool_executions) && message.metadata.tool_executions.length > 0 && (
                          <div className="tool-executions">
                            <div className="tool-executions-title">Tools Used:</div>
                            {message.metadata.tool_executions.map((exec: ToolExecution, idx: number) => (
                              <div key={idx} className="tool-execution">
                                <span className="tool-name">{exec.name}</span>
                                <span className="tool-args">{JSON.stringify(exec.arguments)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {streamingContent && (
                <div className="message assistant streaming">
                  <div className="message-header">
                    <span className="message-role">Pitch</span>
                  </div>
                  <div className="message-content">
                    {streamingContent}
                  </div>
                </div>
              )}
              {toolExecutions.length > 0 && !streamingContent && (
                <div className="message assistant">
                  <div className="message-header">
                    <span className="message-role">Pitch</span>
                  </div>
                  <div className="message-content">
                    <div className="tool-executions-live">
                      <div className="tool-executions-title">Executing Tools...</div>
                      {toolExecutions.map((exec, idx) => (
                        <div key={idx} className="tool-execution">
                          <span className="tool-name">{exec.name}</span>
                          <span className="tool-args">{JSON.stringify(exec.arguments)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                className="input-box"
                placeholder="Ask Anything..."
                value={inputValue}
                onInput={handleInput}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                rows={1}
              />
              <div className="input-actions">
                {currentConversation && (
                  <FileUpload
                    conversationId={currentConversation}
                    onFileUploaded={(file) => {
                      setUploadedFiles(prev => [file, ...prev])
                    }}
                  />
                )}
                {currentPresentationId && (
                  <button
                    className="input-btn"
                    onClick={() => setShowSlideEditor(!showSlideEditor)}
                    title="Toggle Slide Editor"
                  >
                    🎨
                  </button>
                )}
                <button
                  className="input-btn send-btn"
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  title="Send message"
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {showSlideEditor && currentPresentationId && (
        <aside className="slide-editor-panel">
          <div className="slide-editor-header">
            <h2>Slide Editor</h2>
            <button onClick={() => setShowSlideEditor(false)} className="close-btn">×</button>
          </div>
          <SlideEditor presentationId={currentPresentationId} />
        </aside>
      )}
    </div>
  )
}

export default App
