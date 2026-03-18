import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Globe, 
  Smartphone, 
  Clock,
  Activity,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react'
import { analyticsService, ChannelMetrics, UserAnalytics } from '@/lib/analytics'

interface AnalyticsData {
  totalSessions: number
  totalMessages: number
  activeUsers: number
  channelDistribution: Record<string, number>
  topChannels: string[]
  recentSessions: Array<{
    id: string
    channelId: string
    startTime: Date
    duration: number
    messages: number
    engagementLevel: string
  }>
  dailyMetrics: Array<{
    date: string
    sessions: number
    messages: number
    users: number
  }>
}

const AnalyticsDashboard: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')

  const fetchAnalyticsData = async () => {
    setLoading(true)
    try {
      const data = await analyticsService.getDashboardData()
      
      // Mock data for demonstration - in a real app, this would come from Firestore
      const mockData: AnalyticsData = {
        totalSessions: 1247,
        totalMessages: 8932,
        activeUsers: 456,
        channelDistribution: {
          web: 65,
          telegram: 25,
          whatsapp: 10
        },
        topChannels: ['web', 'telegram', 'whatsapp'],
        recentSessions: [
          {
            id: 'session_001',
            channelId: 'web',
            startTime: new Date(Date.now() - 3600000),
            duration: 1200,
            messages: 15,
            engagementLevel: 'high'
          },
          {
            id: 'session_002',
            channelId: 'telegram',
            startTime: new Date(Date.now() - 7200000),
            duration: 800,
            messages: 8,
            engagementLevel: 'medium'
          },
          {
            id: 'session_003',
            channelId: 'whatsapp',
            startTime: new Date(Date.now() - 10800000),
            duration: 300,
            messages: 3,
            engagementLevel: 'low'
          }
        ],
        dailyMetrics: [
          { date: '2024-01-01', sessions: 120, messages: 850, users: 45 },
          { date: '2024-01-02', sessions: 140, messages: 980, users: 52 },
          { date: '2024-01-03', sessions: 160, messages: 1100, users: 61 },
          { date: '2024-01-04', sessions: 180, messages: 1250, users: 68 },
          { date: '2024-01-05', sessions: 200, messages: 1400, users: 75 },
          { date: '2024-01-06', sessions: 220, messages: 1550, users: 82 },
          { date: '2024-01-07', sessions: 240, messages: 1700, users: 89 }
        ]
      }

      setAnalyticsData(mockData)
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
  }, [timeRange])

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getEngagementColor = (level: string): string => {
    switch (level) {
      case 'high': return '#10b981'
      case 'medium': return '#f59e0b'
      case 'low': return '#ef4444'
      default: return '#9ca3af'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-excel-green"></div>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    )
  }

  const channelColors = {
    web: '#3b82f6',
    telegram: '#0088cc',
    whatsapp: '#25d366'
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold">{analyticsData.totalSessions.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold">{analyticsData.totalMessages.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-2xl font-bold">{analyticsData.activeUsers.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Session Duration</p>
                <p className="text-2xl font-bold">8m 24s</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Range Selector */}
      <div className="flex justify-end">
        <div className="flex space-x-2">
          {['1d', '7d', '30d', '90d'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              onClick={() => setTimeRange(range)}
              className="text-sm"
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Dashboard */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="channels">Channel Analysis</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="sessions">Recent Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Daily Metrics Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="messages" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="users" stroke="#f59e0b" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          {/* Channel Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Channel Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(analyticsData.channelDistribution).map(([name, value]) => ({
                          name: name.charAt(0).toUpperCase() + name.slice(1),
                          value
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.keys(analyticsData.channelDistribution).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={channelColors[entry as keyof typeof channelColors]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Channel Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.dailyMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sessions" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          {/* Engagement Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Engagement Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">45%</div>
                  <div className="text-sm text-green-600">High Engagement</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">35%</div>
                  <div className="text-sm text-yellow-600">Medium Engagement</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">20%</div>
                  <div className="text-sm text-red-600">Low Engagement</div>
                </div>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.recentSessions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="id" />
                    <YAxis />
                    <Tooltip />
                    <Bar 
                      dataKey="messages" 
                      fill="#10b981" 
                      name="Messages"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getEngagementColor(session.engagementLevel) }}
                      />
                      <div>
                        <p className="font-medium">Session {session.id}</p>
                        <p className="text-sm text-gray-600">
                          {session.channelId.toUpperCase()} • {session.startTime.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{session.messages} messages</p>
                      <p className="text-sm text-gray-600">{formatDuration(session.duration)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AnalyticsDashboard