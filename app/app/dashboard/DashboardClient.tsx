'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, CheckCircle, Clock, Folder, Calendar } from 'lucide-react'

interface ProjectProgress {
  projectId: string
  projectName: string
  projectColor: string | null
  totalTasks: number
  completedTasks: number
  activeTasks: number
  progress: number
}

interface CompletedTaskByPeriod {
  date: string
  count: number
  dayName: string
}

interface ProductivityByDay {
  date: string
  dayName: string
  completed: number
  created: number
  productivity: number
}

interface OverallStats {
  totalTasks: number
  activeTasks: number
  completedTasks: number
  completionRate: number
  totalProjects: number
}

interface DealStageStat {
  stage: 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
  count: number
  value: number
}

interface CrmStats {
  totalContacts: number
  totalCompanies: number
  activeDeals: number
  overdueFollowUps: number
  upcomingFollowUps: number
  dealsByStage: DealStageStat[]
  pipelineTotalValue: number
  conversionRate: number
}

export default function DashboardClient() {
  const [projectProgress, setProjectProgress] = useState<ProjectProgress[]>([])
  const [completedTasksByPeriod, setCompletedTasksByPeriod] = useState<CompletedTaskByPeriod[]>([])
  const [productivityByDay, setProductivityByDay] = useState<ProductivityByDay[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [crmStats, setCrmStats] = useState<CrmStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [section, setSection] = useState<'tasks' | 'crm'>('tasks')
  const [isDark, setIsDark] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
    // Check if dark mode is active
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [period])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/stats?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setProjectProgress(data.projectProgress || [])
        setCompletedTasksByPeriod(data.completedTasksByPeriod || [])
        setProductivityByDay(data.productivityByDay || [])
        setOverallStats(data.overallStats || null)
        setCrmStats(data.crmStats || null)
      }
    } catch (error) {
      // Error fetching dashboard stats
    } finally {
      setLoading(false)
    }
  }

  // Colors for pie chart
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
  
  // Chart colors based on theme
  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const textColor = isDark ? '#d1d5db' : '#6b7280'
  const tooltipBg = isDark ? '#0f172a' : '#fff'
  const tooltipBorder = isDark ? '#1e293b' : '#e5e7eb'
  const tooltipText = isDark ? '#cbd5e1' : '#111827'
  const stageLabel: Record<DealStageStat['stage'], string> = {
    NEW: 'Nou',
    QUALIFIED: 'Calificat',
    PROPOSAL: 'Propunere',
    NEGOTIATION: 'Negociere',
    WON: 'Câștigat',
    LOST: 'Pierdut',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500 dark:text-gray-400">Se încarcă statisticile...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSection('tasks')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              section === 'tasks'
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Task-uri
          </button>
          <button
            onClick={() => setSection('crm')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              section === 'crm'
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            CRM
          </button>
        </div>
      </div>

      {section === 'tasks' && (
        <>
      <div className="flex gap-2">
        <button
          onClick={() => setPeriod('week')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            period === 'week'
              ? 'bg-blue-600 text-white dark:bg-blue-500'
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Săptămâna
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            period === 'month'
              ? 'bg-blue-600 text-white dark:bg-blue-500'
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Luna
        </button>
      </div>

      {/* Overall Stats Cards */}
      {overallStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Sarcini</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {overallStats.totalTasks}
                </p>
              </div>
              <Folder className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {overallStats.activeTasks}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Finalizate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {overallStats.completedTasks}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Rata Completare</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {overallStats.completionRate}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Progress Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Progres pe Proiecte
          </h2>
          {projectProgress.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={projectProgress}
                onMouseLeave={() => setSelectedProject(null)}
                onMouseMove={(state: any) => {
                  if (state && state.activePayload && state.activePayload[0]) {
                    const projectId = state.activePayload[0].payload.projectId
                    setSelectedProject(projectId)
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="projectName"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fill: textColor, fontSize: 12 }}
                />
                <YAxis tick={{ fill: textColor }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: '8px',
                    color: tooltipText,
                    boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                  labelStyle={{ color: tooltipText, fontWeight: 'bold' }}
                  itemStyle={{ color: tooltipText }}
                  cursor={{ 
                    fill: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(229, 231, 235, 0.5)',
                    stroke: isDark ? '#334155' : '#9ca3af',
                    strokeWidth: 1,
                  }}
                />
                <Legend wrapperStyle={{ color: textColor }} iconType="rect" />
                <Bar 
                  dataKey="completedTasks" 
                  name="Finalizate"
                  fill="#10b981"
                  onMouseEnter={(data: any) => {
                    if (data && data.projectId) {
                      setSelectedProject(data.projectId)
                    }
                  }}
                >
                  {projectProgress.map((entry, index) => (
                    <Cell
                      key={`cell-completed-${index}`}
                      fill={selectedProject === entry.projectId ? '#059669' : '#10b981'}
                      style={{
                        opacity: selectedProject && selectedProject !== entry.projectId ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    />
                  ))}
                </Bar>
                <Bar 
                  dataKey="activeTasks" 
                  name="Active"
                  fill="#f59e0b"
                  onMouseEnter={(data: any) => {
                    if (data && data.projectId) {
                      setSelectedProject(data.projectId)
                    }
                  }}
                >
                  {projectProgress.map((entry, index) => (
                    <Cell
                      key={`cell-active-${index}`}
                      fill={selectedProject === entry.projectId ? '#d97706' : '#f59e0b'}
                      style={{
                        opacity: selectedProject && selectedProject !== entry.projectId ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              Nu există proiecte
            </div>
          )}
        </div>

        {/* Project Progress Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Distribuție Proiecte
          </h2>
          {projectProgress.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={projectProgress}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="progress"
                  >
                    {projectProgress.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.projectColor || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: '8px',
                      color: tooltipText,
                      boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    }}
                    labelStyle={{ color: tooltipText, fontWeight: 'bold' }}
                    itemStyle={{ color: tooltipText }}
                    formatter={(value: any, name: any, props: any) => {
                      const numValue = typeof value === 'number' ? value : 0
                      const projectName = props?.payload?.projectName || name || ''
                      return [`${numValue}%`, projectName]
                    }}
                    labelFormatter={(label: any, payload: any) => {
                      if (payload && payload.length > 0 && payload[0]?.payload?.projectName) {
                        return payload[0].payload.projectName
                      }
                      return label || ''
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend for projects */}
              <div className="mt-4 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {projectProgress.map((entry, index) => (
                    <div
                      key={`legend-${index}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: entry.projectColor || COLORS[index % COLORS.length],
                        }}
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                        {entry.projectName}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">
                        {entry.progress}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              Nu există proiecte
            </div>
          )}
        </div>
      </div>

      {/* Completed Tasks by Period */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Sarcini Finalizate pe Perioadă ({period === 'week' ? 'Ultimele 7 zile' : 'Luna curentă'})
        </h2>
        {completedTasksByPeriod.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={completedTasksByPeriod}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="dayName"
                tick={{ fill: textColor }}
              />
              <YAxis tick={{ fill: textColor }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '8px',
                  color: tooltipText,
                  boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                }}
                labelStyle={{ color: tooltipText }}
                itemStyle={{ color: tooltipText }}
              />
              <Legend wrapperStyle={{ color: textColor }} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Sarcini Finalizate"
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            Nu există date pentru această perioadă
          </div>
        )}
      </div>

      {/* Productivity by Day */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Productivitate pe Zile (Ultimele 7 zile)
        </h2>
        {productivityByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={productivityByDay}
              onMouseLeave={() => setSelectedDay(null)}
              onMouseMove={(state: any) => {
                if (state && state.activePayload && state.activePayload[0]) {
                  const dayName = state.activePayload[0].payload.dayName
                  setSelectedDay(dayName)
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="dayName"
                tick={{ fill: textColor }}
              />
              <YAxis tick={{ fill: textColor }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '8px',
                  color: tooltipText,
                  boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                }}
                labelStyle={{ color: tooltipText, fontWeight: 'bold' }}
                itemStyle={{ color: tooltipText }}
                cursor={{ 
                  fill: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(229, 231, 235, 0.5)',
                  stroke: isDark ? '#334155' : '#9ca3af',
                  strokeWidth: 1,
                }}
              />
              <Legend 
                wrapperStyle={{ color: textColor }}
                iconType="rect"
              />
              <Bar 
                dataKey="created" 
                name="Sarcini Create"
                fill="#3b82f6"
                onMouseEnter={(data: any) => {
                  if (data && data.dayName) {
                    setSelectedDay(data.dayName)
                  }
                }}
              >
                {productivityByDay.map((entry, index) => (
                  <Cell
                    key={`cell-created-${index}`}
                    fill={selectedDay === entry.dayName ? '#2563eb' : '#3b82f6'}
                    style={{
                      opacity: selectedDay && selectedDay !== entry.dayName ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </Bar>
              <Bar 
                dataKey="completed" 
                name="Sarcini Finalizate"
                fill="#10b981"
                onMouseEnter={(data: any) => {
                  if (data && data.dayName) {
                    setSelectedDay(data.dayName)
                  }
                }}
              >
                {productivityByDay.map((entry, index) => (
                  <Cell
                    key={`cell-completed-${index}`}
                    fill={selectedDay === entry.dayName ? '#059669' : '#10b981'}
                    style={{
                      opacity: selectedDay && selectedDay !== entry.dayName ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            Nu există date pentru această perioadă
          </div>
        )}
      </div>
        </>
      )}

      {section === 'crm' && crmStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Contacte</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{crmStats.totalContacts}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Companii</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{crmStats.totalCompanies}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Oportunități active</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{crmStats.activeDeals}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Conversie</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{crmStats.conversionRate}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Follow-ups</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Astăzi</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{crmStats.upcomingFollowUps}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Întârziate</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{crmStats.overdueFollowUps}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Valoare pipeline totală</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{crmStats.pipelineTotalValue} EUR</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pipeline pe stadii</h2>
              {crmStats.dealsByStage.length > 0 ? (
                <div className="space-y-2">
                  {crmStats.dealsByStage.map((item) => (
                    <div key={item.stage} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{stageLabel[item.stage]}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{item.count} ({item.value} EUR)</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">Nu există date de pipeline.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

