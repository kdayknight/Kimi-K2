import { useState, useEffect, useRef } from 'react'
import './App.css'
import { supabase, type Conversation, type Message } from './lib/supabase'

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation)
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

    setMessages([...messages, userMsgData])
    setInputValue('')
    setIsLoading(true)

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    setTimeout(async () => {
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

      if (!thinkingError && thinkingData) {
        setMessages(prev => [...prev, thinkingData])

        setTimeout(async () => {
          await supabase
            .from('messages')
            .delete()
            .eq('id', thinkingData.id)

          const assistantMessage = {
            conversation_id: conversationId!,
            role: 'assistant' as const,
            content: `I received your message: "${userMessage.content}". This is a demo response. In a real application, this would connect to an AI service to generate responses, create slides, or generate images based on your request.`,
            is_thinking: false,
            metadata: {}
          }

          const { data: assistantData, error: assistantError } = await supabase
            .from('messages')
            .insert([assistantMessage])
            .select()
            .single()

          if (!assistantError && assistantData) {
            setMessages(prev => prev.filter(m => m.id !== thinkingData.id).concat(assistantData))
          }

          setIsLoading(false)
        }, 1500)
      } else {
        setIsLoading(false)
      }
    }, 500)
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
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">K</div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <button className="new-chat-btn" onClick={createNewConversation}>
          <span>➕</span>
          <span>New Chat</span>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--gray-500)' }}>⌘ K</span>
        </button>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Kimi+</div>
            <div className="nav-item">
              <span className="nav-item-icon">📊</span>
              <span>Kimi Slides</span>
            </div>
            <div className="nav-item">
              <span className="nav-item-icon">💻</span>
              <span>Kimi For Coding</span>
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
        </nav>

        <div className="sidebar-footer">
          <div className="nav-item">
            <span style={{ fontSize: '20px' }}>👤</span>
            <span>Log In</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <h1 className="welcome-logo">KIMI</h1>
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
                <div className="input-toolbar">
                  <button className="model-selector">
                    <span>🔍</span>
                    <span>Researcher</span>
                  </button>
                </div>
                <div className="input-actions">
                  <button className="input-btn" title="K2 Model">K2 ▼</button>
                  <button className="input-btn" title="Attach file">📎</button>
                  <button className="input-btn" title="Settings">⚙️</button>
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
                      {message.role === 'user' ? 'You' : 'Kimi'}
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
                      message.content
                    )}
                  </div>
                </div>
              ))}
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
              <div className="input-toolbar">
                <button className="model-selector">
                  <span>🔍</span>
                  <span>Researcher</span>
                </button>
              </div>
              <div className="input-actions">
                <button className="input-btn" title="K2 Model">K2 ▼</button>
                <button className="input-btn" title="Attach file">📎</button>
                <button className="input-btn" title="Settings">⚙️</button>
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
    </div>
  )
}

export default App
