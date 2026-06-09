'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Search, User, Bot, Terminal, ChevronDown, ChevronRight, Clock, Phone, RefreshCw, Loader2 } from 'lucide-react'
import { getChatSessions, getChatMessages, toggleChatSessionPause, sendManualMessage, getPetflowApiKey, getAgentPublicUrl } from '@/lib/actions'
import type { ChatSession, ChatMessage } from '@/types'
import { format } from 'date-fns'
import { io } from 'socket.io-client'

export default function ChatInboxPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<any>(null)

  const loadSessions = async () => {
    try {
      const data = await getChatSessions()
      setSessions(data as unknown as ChatSession[])
      if (data.length > 0 && !selectedSession) {
        handleSelectSession(data[0] as unknown as ChatSession)
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const loadMessages = async (sessionId: string) => {
    setMessagesLoading(true)
    try {
      const data = await getChatMessages(sessionId)
      setMessages(data as unknown as ChatMessage[])
    } catch (error) {
      console.error('Error loading messages:', error)
    }
    setMessagesLoading(false)
  }

  // 1. Initial Load & Global Session Socket Connection
  useEffect(() => {
    setLoading(true)
    loadSessions().finally(() => setLoading(false))

    let socket: any;
    Promise.all([getPetflowApiKey(), getAgentPublicUrl()]).then(([apiKey, agentUrl]) => {
      let socketUrl = process.env.NEXT_PUBLIC_AGENT_URL || agentUrl;

      // Force localhost agent connection if accessing CRM locally
      if (typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        socketUrl = 'http://localhost:3002';
      }

      console.log('🔌 Connecting socket to:', socketUrl);
      socket = io(socketUrl, {
        auth: { token: apiKey },
        transports: ['polling', 'websocket']
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('🔌 Connected to agent WebSocket server');
      });

      socket.on('session_updated', ({ sessionId, lastMessage }: any) => {
        setSessions(prev => 
          prev.map(s => s.id === sessionId 
            ? { ...s, last_message: lastMessage, updated: new Date().toISOString() } 
            : s
          ).sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
        );
      });

      socket.on('connect_error', (err: any) => {
        console.error('WebSocket connection error:', err.message);
      });
    }).catch(console.error);

    return () => {
      if (socket) {
        socket.disconnect();
      }
    }
  }, [])

  // 2. Selection changes: Join room & load messages
  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession.id)

      if (socketRef.current) {
        socketRef.current.emit('join_session', selectedSession.id);

        socketRef.current.off('new_message');
        socketRef.current.on('new_message', (newMsg: ChatMessage) => {
          setMessages(prev => {
            const exists = prev.some(m => 
              m.id === newMsg.id || 
              (m.content === newMsg.content && m.role === newMsg.role && Math.abs(new Date(m.created).getTime() - new Date(newMsg.created).getTime()) < 15000)
            );
            if (exists) {
              return prev.map(m => 
                (m.content === newMsg.content && m.role === newMsg.role && m.id.includes('.')) 
                  ? newMsg 
                  : m
              );
            }
            return [...prev, newMsg];
          });
        });
      }
    }
  }, [selectedSession])

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages])

  const handleSelectSession = (session: ChatSession) => {
    setSelectedSession(session)
  }

  const toggleTool = (id: string) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredSessions = sessions.filter(s => 
    s.phone.includes(search) || 
    s.client?.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Sidebar */}
      <div className="w-full md:w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
        <div className="p-5 border-b border-gray-100 bg-white">
          <h2 className="text-lg font-800 mb-4">Petro Inbox 🐾</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-sage-dark transition-all"
              placeholder="Search chats..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="p-10 flex flex-col items-center gap-3 text-gray-400">
              <Loader2 className="animate-spin" size={24} />
              <p className="text-xs font-600">Loading chats...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-xs font-600">No conversations yet</p>
            </div>
          ) : (
            filteredSessions.map(session => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session)}
                className={`w-full p-4 flex items-start gap-3 transition-all border-b border-gray-50/50 hover:bg-white ${selectedSession?.id === session.id ? 'bg-white shadow-sm border-l-4 border-l-[var(--sage-dark)]' : ''}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${selectedSession?.id === session.id ? 'bg-[var(--sage-muted)] text-[var(--sage-dark)]' : 'bg-gray-100 text-gray-400'}`}>
                  {session.client?.name?.[0] || <User size={20} />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-800 text-sm truncate">{session.client?.name || session.phone}</p>
                      {session.is_paused && (
                        <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-700 rounded font-800 uppercase tracking-wider flex-shrink-0">Manual</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-500 whitespace-nowrap">
                      {format(new Date(session.updated), 'HH:mm')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate line-clamp-1">
                    {session.last_message || 'No messages'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedSession ? (
          <>
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--sage-muted)] flex items-center justify-center font-bold text-[var(--sage-dark)]">
                  {selectedSession.client?.name?.[0] || <User size={18} />}
                </div>
                <div>
                  <h3 className="font-800 text-gray-800">{selectedSession.client?.name || selectedSession.phone}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone size={10} /> {selectedSession.phone}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} /> Last active {format(new Date(selectedSession.updated), 'MMM d, HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    const nextState = !selectedSession.is_paused
                    await toggleChatSessionPause(selectedSession.id, nextState)
                    setSelectedSession(prev => prev ? { ...prev, is_paused: nextState } : null)
                    setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, is_paused: nextState } : s))
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    selectedSession.is_paused
                      ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/70'
                      : 'bg-green-50 border-green-100 text-green-700 hover:bg-green-100/70'
                  }`}
                >
                  {selectedSession.is_paused ? (
                    <>
                      <User size={12} />
                      Human Mode
                    </>
                  ) : (
                    <>
                      <Bot size={12} />
                      AI Agent
                    </>
                  )}
                </button>

                <button 
                  onClick={() => loadMessages(selectedSession.id)}
                  className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 transition-colors"
                  title="Refresh messages"
                >
                  <RefreshCw size={18} className={messagesLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6 bg-gray-50/20"
            >
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                const isAssistant = msg.role === 'assistant'
                const isTool = msg.role === 'tool'
                const isSystem = msg.role === 'system'

                if (isSystem) return null // Hide system prompts from UI

                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${isUser ? 'bg-[var(--sage-dark)] text-white' : isAssistant ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'}`}>
                        {isUser ? <User size={14} /> : isAssistant ? <Bot size={14} /> : <Terminal size={14} />}
                      </div>

                      {/* Content */}
                      <div className="flex flex-col gap-1.5">
                        <div className={`p-4 rounded-2xl text-sm shadow-sm border ${isUser ? 'bg-[var(--sage-dark)] text-white border-[var(--sage-dark)]' : isAssistant ? 'bg-white text-gray-800 border-gray-100' : 'bg-gray-50 text-gray-500 border-gray-100 font-mono text-[11px]'}`}>
                          {isTool ? (
                            <div className="flex flex-col gap-2">
                              <button 
                                onClick={() => toggleTool(msg.id)}
                                className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]"
                              >
                                {expandedTools[msg.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                Tool Result: {msg.name}
                              </button>
                              {expandedTools[msg.id] && (
                                <pre className="whitespace-pre-wrap mt-2 p-2 bg-gray-900 text-gray-300 rounded-lg overflow-x-auto">
                                  {msg.content}
                                </pre>
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-500 text-gray-400 ${isUser ? 'text-right' : 'text-left'}`}>
                          {format(new Date(msg.created), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Chat Composer Input */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <form 
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!replyText.trim() || sending) return
                  setSending(true)
                  try {
                    await sendManualMessage(selectedSession.id, selectedSession.phone, replyText)
                    const newMsg: ChatMessage = {
                      id: Math.random().toString(),
                      session_id: selectedSession.id,
                      role: 'assistant',
                      content: replyText,
                      tool_call_id: null,
                      name: null,
                      created: new Date().toISOString()
                    }
                    setMessages(prev => [...prev, newMsg])
                    setReplyText('')
                    // Update sidebar message preview
                    setSessions(prev => prev.map(s => s.id === selectedSession.id ? { 
                      ...s, 
                      last_message: replyText, 
                      updated: new Date().toISOString() 
                    } : s))
                  } catch (error) {
                    console.error('Error sending manual reply:', error)
                  }
                  setSending(false)
                }}
                className="flex gap-2 items-center"
              >
                <input
                  type="text"
                  disabled={!selectedSession.is_paused || sending}
                  placeholder={selectedSession.is_paused ? "Type a reply to send manually via WhatsApp..." : "Toggle Human Mode in header to reply manually..."}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-[var(--sage-dark)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!selectedSession.is_paused || !replyText.trim() || sending}
                  className="px-5 py-2.5 bg-[var(--sage-dark)] text-white font-bold rounded-xl text-sm hover:bg-[var(--sage-dark)]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-10 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <MessageSquare size={40} className="opacity-20" />
            </div>
            <h3 className="text-xl font-800 text-gray-400 mb-2">Your Conversations</h3>
            <p className="text-sm max-w-xs">Select a chat from the sidebar to view Petro's history with the client.</p>
          </div>
        )}
      </div>
    </div>
  )
}
