import { db } from './firebase'
import { addDoc, collection, Timestamp, updateDoc, doc, getDoc } from 'firebase/firestore'

export interface ChatSession {
  id: string
  userId?: string
  channelId: 'web' | 'telegram' | 'whatsapp'
  channelUserId: string
  startTime: Date
  endTime?: Date
  messages: ChatMessage[]
  totalMessages: number
  firstMessage: string
  lastMessage: string
  sessionDuration?: number
  isActive: boolean
  metadata: {
    userAgent?: string
    ipAddress?: string
    referrer?: string
    deviceType?: string
    location?: {
      country?: string
      city?: string
      region?: string
    }
  }
}

export interface ChatMessage {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  messageType: 'text' | 'image' | 'file' | 'quick_reply'
  metadata?: Record<string, any>
}

export interface ChannelMetrics {
  channelId: 'web' | 'telegram' | 'whatsapp'
  date: string
  totalSessions: number
  totalMessages: number
  activeUsers: number
  avgSessionDuration: number
  conversionRate: number
  topIntents: string[]
  engagementScore: number
}

export interface UserAnalytics {
  userId: string
  totalSessions: number
  totalMessages: number
  avgSessionDuration: number
  channelsUsed: string[]
  lastActive: Date
  firstSession: Date
  engagementLevel: 'low' | 'medium' | 'high'
  preferredChannel: string
}

class AnalyticsService {
  private static instance: AnalyticsService
  private sessionCache = new Map<string, ChatSession>()

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService()
    }
    return AnalyticsService.instance
  }

  /**
   * Start a new chat session
   */
  async startSession(
    channelId: 'web' | 'telegram' | 'whatsapp',
    channelUserId: string,
    metadata: Partial<ChatSession['metadata']> = {}
  ): Promise<string> {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    
    const session: ChatSession = {
      id: sessionId,
      userId: channelUserId,
      channelId,
      channelUserId,
      startTime: new Date(),
      messages: [],
      totalMessages: 0,
      firstMessage: '',
      lastMessage: '',
      isActive: true,
      metadata: {
        ...metadata,
        deviceType: this.detectDeviceType(metadata.userAgent),
      }
    }

    try {
      await addDoc(collection(db, 'chat_sessions'), {
        ...session,
        startTime: Timestamp.fromDate(session.startTime),
      })

      this.sessionCache.set(sessionId, session)

      // Update channel metrics
      await this.updateChannelMetrics(channelId, 1, 0)

      return sessionId
    } catch (error) {
      console.error('Error starting chat session:', error)
      throw new Error('Failed to start chat session')
    }
  }

  /**
   * Add a message to an existing session
   */
  async addMessage(
    sessionId: string,
    text: string,
    sender: 'user' | 'bot',
    messageType: ChatMessage['messageType'] = 'text',
    metadata?: Record<string, any>
  ): Promise<void> {
    const session = this.sessionCache.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      sender,
      timestamp: new Date(),
      messageType,
      metadata
    }

    session.messages.push(message)
    session.totalMessages++
    session.lastMessage = text

    if (session.messages.length === 1 && sender === 'user') {
      session.firstMessage = text
    }

    try {
      const sessionRef = doc(db, 'chat_sessions', sessionId)
      await updateDoc(sessionRef, {
        messages: session.messages,
        totalMessages: session.totalMessages,
        lastMessage: session.lastMessage,
        ...(session.messages.length === 1 && { firstMessage: session.firstMessage })
      })

      // Update channel metrics for messages
      if (sender === 'user') {
        await this.updateChannelMetrics(session.channelId, 0, 1)
      }
    } catch (error) {
      console.error('Error adding message:', error)
      throw new Error('Failed to add message')
    }
  }

  /**
   * End a chat session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessionCache.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    session.endTime = new Date()
    session.isActive = false
    session.sessionDuration = session.endTime.getTime() - session.startTime.getTime()

    try {
      const sessionRef = doc(db, 'chat_sessions', sessionId)
      await updateDoc(sessionRef, {
        endTime: Timestamp.fromDate(session.endTime),
        isActive: false,
        sessionDuration: session.sessionDuration
      })

      this.sessionCache.delete(sessionId)

      // Update user analytics
      await this.updateUserAnalytics(session.channelUserId, session)
    } catch (error) {
      console.error('Error ending session:', error)
      throw new Error('Failed to end session')
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessionCache.get(sessionId)
  }

  /**
   * Get active sessions for a user
   */
  getActiveSessionsForUser(channelUserId: string): ChatSession[] {
    return Array.from(this.sessionCache.values())
      .filter(session => session.channelUserId === channelUserId && session.isActive)
  }

  /**
   * Get channel metrics for a specific date
   */
  async getChannelMetrics(
    channelId: 'web' | 'telegram' | 'whatsapp',
    date: string
  ): Promise<ChannelMetrics | null> {
    try {
      const docRef = doc(db, 'channel_metrics', `${channelId}_${date}`)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return docSnap.data() as ChannelMetrics
      }
      return null
    } catch (error) {
      console.error('Error getting channel metrics:', error)
      return null
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics | null> {
    try {
      const docRef = doc(db, 'user_analytics', userId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return docSnap.data() as UserAnalytics
      }
      return null
    } catch (error) {
      console.error('Error getting user analytics:', error)
      return null
    }
  }

  /**
   * Track channel attribution
   */
  async trackChannelAttribution(
    userId: string,
    channelId: 'web' | 'telegram' | 'whatsapp',
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const attributionData = {
        userId,
        channelId,
        action,
        timestamp: Timestamp.now(),
        metadata: metadata || {}
      }

      await addDoc(collection(db, 'channel_attribution'), attributionData)
    } catch (error) {
      console.error('Error tracking channel attribution:', error)
    }
  }

  /**
   * Update channel metrics
   */
  private async updateChannelMetrics(
    channelId: 'web' | 'telegram' | 'whatsapp',
    sessions: number,
    messages: number
  ): Promise<void> {
    const date = new Date().toISOString().split('T')[0]
    const docRef = doc(db, 'channel_metrics', `${channelId}_${date}`)

    try {
      const docSnap = await getDoc(docRef)
      const today = new Date()

      if (docSnap.exists()) {
        const data = docSnap.data()
        await updateDoc(docRef, {
          totalSessions: data.totalSessions + sessions,
          totalMessages: data.totalMessages + messages,
          lastUpdated: Timestamp.fromDate(today)
        })
      } else {
        await updateDoc(docRef, {
          channelId,
          date,
          totalSessions: sessions,
          totalMessages: messages,
          activeUsers: 0,
          avgSessionDuration: 0,
          conversionRate: 0,
          topIntents: [],
          engagementScore: 0,
          lastUpdated: Timestamp.fromDate(today)
        })
      }
    } catch (error) {
      console.error('Error updating channel metrics:', error)
    }
  }

  /**
   * Update user analytics
   */
  private async updateUserAnalytics(userId: string, session: ChatSession): Promise<void> {
    try {
      const docRef = doc(db, 'user_analytics', userId)
      const docSnap = await getDoc(docRef)

      const sessionDuration = session.sessionDuration || 0
      const channelsUsed = docSnap.exists() ? docSnap.data().channelsUsed : []
      const updatedChannels = [...new Set([...channelsUsed, session.channelId])]

      const analyticsData = {
        userId,
        totalSessions: docSnap.exists() ? docSnap.data().totalSessions + 1 : 1,
        totalMessages: docSnap.exists() ? docSnap.data().totalMessages + session.totalMessages : session.totalMessages,
        avgSessionDuration: docSnap.exists() 
          ? (docSnap.data().avgSessionDuration + sessionDuration) / 2 
          : sessionDuration,
        channelsUsed: updatedChannels,
        lastActive: Timestamp.fromDate(new Date()),
        firstSession: docSnap.exists() ? docSnap.data().firstSession : Timestamp.fromDate(session.startTime),
        engagementLevel: this.calculateEngagementLevel(session.totalMessages, sessionDuration),
        preferredChannel: this.getPreferredChannel(updatedChannels)
      }

      await updateDoc(docRef, analyticsData)
    } catch (error) {
      console.error('Error updating user analytics:', error)
    }
  }

  /**
   * Calculate engagement level based on session data
   */
  private calculateEngagementLevel(totalMessages: number, sessionDuration: number): 'low' | 'medium' | 'high' {
    const durationMinutes = sessionDuration / (1000 * 60)
    
    if (totalMessages >= 10 && durationMinutes >= 5) return 'high'
    if (totalMessages >= 5 && durationMinutes >= 2) return 'medium'
    return 'low'
  }

  /**
   * Get preferred channel based on usage
   */
  private getPreferredChannel(channels: string[]): string {
    // Simple logic - return the first channel for now
    // Could be enhanced to count usage per channel
    return channels[0] || 'web'
  }

  /**
   * Detect device type from user agent
   */
  private detectDeviceType(userAgent?: string): string {
    if (!userAgent) return 'unknown'
    
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return /iPad|Tablet/.test(userAgent) ? 'tablet' : 'mobile'
    }
    return 'desktop'
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardData(): Promise<{
    totalSessions: number
    totalMessages: number
    activeUsers: number
    channelDistribution: Record<string, number>
    topChannels: string[]
  }> {
    try {
      // This would typically aggregate data from Firestore
      // For now, return a basic structure
      return {
        totalSessions: 0,
        totalMessages: 0,
        activeUsers: 0,
        channelDistribution: {},
        topChannels: []
      }
    } catch (error) {
      console.error('Error getting dashboard data:', error)
      return {
        totalSessions: 0,
        totalMessages: 0,
        activeUsers: 0,
        channelDistribution: {},
        topChannels: []
      }
    }
  }
}

export const analyticsService = AnalyticsService.getInstance()
export default AnalyticsService