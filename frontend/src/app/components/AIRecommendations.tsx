import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { Layout } from './Layout'
import {
  Brain, Sparkles, Target, TrendingUp, Send, Bot, User,
  ChevronRight, Zap, ArrowUpRight, RefreshCw, Star,
  AlertCircle, BookOpen, MapPin, DollarSign,
} from 'lucide-react'
import { motion } from 'motion/react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts'
import { BACKEND_URL } from '../firebase'

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: Date
}

// Build AI responses using actual user profile data
function buildAIResponses(user: any): Record<string, string> {
  const firstName = user?.name?.split(' ')[0] || 'there'
  const roleLevel = user?.roleLevel || 'Senior'
  const workStyle = user?.workStyle || 'Remote'
  const salaryRange = user?.salaryRange || '$120k–$150k'
  const location = user?.location || 'your area'
  const title = user?.title || 'engineer'
  const github = user?.github

  return {
    default: `Based on your ${roleLevel} ${title} profile, I recommend focusing on roles that align with your ${workStyle.toLowerCase()} work preference. Your profile shows strong positioning for ${roleLevel}-level positions. Would you like me to break down your top matches?`,
    salary: `Based on your ${roleLevel} ${title} profile in ${location}, market data suggests targeting ${salaryRange}. Your current preference of ${salaryRange} is well-calibrated. Consider negotiating stock equity on top of base compensation — it can add 30–50% to total compensation.`,
    interview: `For ${roleLevel} ${title} roles, interviews typically focus on: (1) System design scaled to your experience level, (2) Behavioral questions using STAR format, (3) Technical depth in your core stack, (4) Culture and collaboration scenarios. Want me to generate practice questions tailored to your profile?`,
    career: `Your ${roleLevel} ${title} trajectory shows strong paths forward. Based on your ${workStyle} preference and target salary of ${salaryRange}, I see two directions: (1) Technical leadership at your current company, or (2) A senior IC role at a high-growth startup. Which direction interests you more?`,
    skills: `Looking at your ${roleLevel}-level positioning${github ? ' and your linked GitHub' : ''}: the highest-ROI improvements are system design breadth, cloud certifications, and cross-functional leadership exposure. These open up the next tier of roles. Want a detailed learning roadmap?`,
  }
}

// Build radar data from user profile
function buildRadarData(user: any) {
  const roleScores: Record<string, number> = { Entry: 65, Mid: 76, Senior: 88, Lead: 93, Executive: 96 }
  const base = roleScores[user?.roleLevel || 'Mid'] || 80
  return [
    { subject: 'Skills', score: Math.min(base + 6, 100) },
    { subject: 'Experience', score: Math.max(base - 3, 60) },
    { subject: 'Education', score: Math.max(base - 5, 60) },
    { subject: 'Culture', score: user?.workStyle === 'Remote' ? Math.min(base + 3, 100) : base },
    { subject: 'Growth', score: Math.min(base + 4, 100) },
    { subject: 'Salary', score: base },
  ]
}

// Build skill gap data relevant to the user's role level
function buildGapData(user: any) {
  const level = user?.roleLevel || 'Mid'
  const maps: Record<string, { skill: string; current: number; target: number; color: string }[]> = {
    Entry: [
      { skill: 'System Design', current: 40, target: 70, color: '#6366f1' },
      { skill: 'Cloud (AWS)', current: 30, target: 65, color: '#f59e0b' },
      { skill: 'Testing/QA', current: 55, target: 80, color: '#a855f7' },
      { skill: 'TypeScript', current: 60, target: 85, color: '#22d3ee' },
      { skill: 'Git Workflow', current: 70, target: 90, color: '#10b981' },
    ],
    Mid: [
      { skill: 'System Design', current: 65, target: 85, color: '#6366f1' },
      { skill: 'AWS / Cloud', current: 60, target: 80, color: '#f59e0b' },
      { skill: 'Leadership', current: 55, target: 75, color: '#a855f7' },
      { skill: 'Architecture', current: 62, target: 82, color: '#22d3ee' },
      { skill: 'CI/CD', current: 70, target: 85, color: '#10b981' },
    ],
    Senior: [
      { skill: 'AWS Certification', current: 65, target: 85, color: '#f59e0b' },
      { skill: 'System Design', current: 70, target: 92, color: '#6366f1' },
      { skill: 'Technical Leadership', current: 72, target: 88, color: '#a855f7' },
      { skill: 'Architecture', current: 76, target: 90, color: '#22d3ee' },
      { skill: 'Cross-team Collab', current: 78, target: 88, color: '#10b981' },
    ],
    Lead: [
      { skill: 'Org Design', current: 60, target: 82, color: '#f59e0b' },
      { skill: 'Executive Presence', current: 65, target: 85, color: '#6366f1' },
      { skill: 'P&L Ownership', current: 55, target: 80, color: '#a855f7' },
      { skill: 'Roadmapping', current: 75, target: 90, color: '#22d3ee' },
      { skill: 'Hiring & Culture', current: 70, target: 88, color: '#10b981' },
    ],
    Executive: [
      { skill: 'Board Communication', current: 70, target: 90, color: '#f59e0b' },
      { skill: 'Fundraising', current: 55, target: 80, color: '#6366f1' },
      { skill: 'M&A Strategy', current: 50, target: 75, color: '#a855f7' },
      { skill: 'Public Speaking', current: 72, target: 90, color: '#22d3ee' },
      { skill: 'Advisor Network', current: 65, target: 85, color: '#10b981' },
    ],
  }
  return maps[level] || maps['Mid']
}

// Build AI career insights from user profile
function buildCareerInsights(user: any) {
  const insights = []
  const level = user?.roleLevel || 'Mid'
  const location = user?.location

  if (level === 'Senior' || level === 'Lead' || level === 'Executive') {
    insights.push({ icon: TrendingUp, type: 'positive', text: `${level}-level profiles are in the top 15% of applicant demand — your positioning is strong.` })
  } else {
    insights.push({ icon: TrendingUp, type: 'positive', text: `${level}-level candidates have high hiring velocity right now — apply to roles while market is hot.` })
  }

  if (user?.github) {
    insights.push({ icon: Star, type: 'positive', text: `Your linked GitHub profile puts you ahead of 68% of applicants who don't share public code.` })
  } else {
    insights.push({ icon: Star, type: 'warning', text: `Linking your GitHub could put you ahead of 68% of applicants — add it in Settings.` })
  }

  if (!user?.bio || user.bio.length < 30) {
    insights.push({ icon: AlertCircle, type: 'warning', text: `Adding a detailed bio boosts AI match accuracy — share your specialization and goals.` })
  } else {
    insights.push({ icon: AlertCircle, type: 'positive', text: `Your bio is set — the AI matches you to niche roles that fit your specific background.` })
  }

  if (location) {
    insights.push({ icon: BookOpen, type: 'tip', text: `Local market in ${location} shows strong demand for ${level} talent — consider hybrid/on-site roles too.` })
  } else {
    insights.push({ icon: BookOpen, type: 'tip', text: `Adding your location in Settings helps the AI surface local opportunities alongside remote roles.` })
  }

  return insights
}

function buildUserResumeText(u: any) {
  if (!u) return 'No resume details provided.'
  const parts = [u.title, u.roleLevel, u.workStyle, u.bio, u.location, u.github].filter(Boolean)
  return parts.join('\n') || 'No resume details provided.'
}

export function AIRecommendations() {
  const navigate = useNavigate()
  const { user, jobs } = useApp()

  const aiResponses = buildAIResponses(user)
  const radarData = buildRadarData(user)
  const gapData = buildGapData(user)
  const careerInsights = buildCareerInsights(user)

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'ai',
      content: `Hey ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your Jobnatics AI career assistant. I've analyzed your ${user?.roleLevel || ''} profile and found high-match opportunities based on your ${user?.workStyle || 'work'} preference${user?.salaryRange ? ` and ${user.salaryRange} salary target` : ''}. What would you like to explore?`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function getAIResponse(input: string): string {
    const lower = input.toLowerCase()
    if (lower.includes('salary') || lower.includes('compensation') || lower.includes('pay')) return aiResponses.salary
    if (lower.includes('interview') || lower.includes('prepare') || lower.includes('question')) return aiResponses.interview
    if (lower.includes('career') || lower.includes('path') || lower.includes('grow') || lower.includes('future')) return aiResponses.career
    if (lower.includes('skill') || lower.includes('learn') || lower.includes('gap')) return aiResponses.skills
    return aiResponses.default
  }

  const sendMessage = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault()
    const text = typeof e === 'string' ? e : input.trim()
    if (!text) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      content: getAIResponse(text),
      timestamp: new Date(),
    }
    setIsTyping(false)
    setMessages(prev => [...prev, aiMsg])
  }

  const quickPrompts = [
    'What are my top job matches?',
    user?.title ? `Help me prepare for a ${user.title} interview` : 'Help me prepare for my next interview',
    `What salary should I negotiate?`,
    'Show my skill gaps',
  ]

  const [matchedJobs, setMatchedJobs] = useState<any[] | null>(null)
  const [matchingLoading, setMatchingLoading] = useState(false)

  useEffect(() => {
    if (!user) return

    const fetchMatches = async () => {
      setMatchingLoading(true)
      try {
        const resumeText = buildUserResumeText(user)
        const res = await fetch(`${BACKEND_URL}/api/match`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resume_text: resumeText,
            demographic_group: 0,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          setMatchedJobs(data.recommendations || [])
        }
      } catch (err) {
        console.error('Error fetching matched jobs in AI Recommendations:', err)
      } finally {
        setMatchingLoading(false)
      }
    }

    fetchMatches()
  }, [user])

  const topMatches = matchedJobs
    ? matchedJobs.map((rec, i) => {
        const fullJob = jobs.find(
          j => j.title.toLowerCase().trim() === rec.job_title.toLowerCase().trim() &&
               j.company.toLowerCase().trim() === rec.company.toLowerCase().trim()
        )
        return {
          id: fullJob?.id || `fallback-${i}`,
          title: rec.job_title,
          company: rec.company,
          location: fullJob?.location || 'Remote',
          salary: fullJob?.salary || '$80K – $120K',
          posted: fullJob?.posted || 'Just now',
          remote: fullJob?.remote || 'remote',
          skills: fullJob?.skills || ['Engineering'],
          match: Math.round(rec.similarity_score * 100),
          recommended: rec.recommended
        }
      }).slice(0, 5)
    : jobs.slice(0, 5).map(j => ({ ...j, match: j.match || 85, recommended: true })).sort((a, b) => b.match - a.match)

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700 }} className="mb-1">
            AI Recommendations
          </h1>
          <p className="text-sm text-muted-foreground">
            Powered by Jobnatics intelligence engine
            {user?.roleLevel ? ` · Personalized for your ${user.roleLevel} profile` : ''}
            {user?.workStyle ? ` · ${user.workStyle} preference` : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: AI Chat */}
          <div className="xl:col-span-2 space-y-6">



            {/* Top matches */}
            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary animate-pulse" />
                  Your Top AI Matches
                </h3>
                <button onClick={() => navigate('/jobs')} className="text-xs text-primary hover:underline flex items-center gap-1 group/see">
                  See all <ChevronRight size={12} strokeWidth={1.75} className="transition-transform duration-200 group-hover/see:translate-x-0.5" />
                </button>
              </div>
              <div className="space-y-3">
                {matchingLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border/30 animate-pulse h-16">
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex-shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-muted/50 rounded w-1/3" />
                        <div className="h-2 bg-muted/50 rounded w-1/4" />
                      </div>
                    </div>
                  ))
                ) : topMatches.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No matching jobs found.
                  </div>
                ) : (
                  topMatches.map((job, i) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base">
                        {['💳', '🛍️', '🤖', '₿', '✈️'][i] || '💼'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium group-hover:text-primary transition-colors truncate">{job.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {job.company}
                          <span className="flex items-center gap-1"><DollarSign size={10} /> {job.salary.split(' – ')[0]}+</span>
                        </div>
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${job.match >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          job.match >= 80 ? 'bg-primary/10 text-primary border-primary/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                          <Sparkles size={9} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="animate-pulse" /> {job.match}%
                        </span>
                      </div>
                      <ArrowUpRight size={14} strokeWidth={1.75} className="text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Match radar — derived from user role level */}
            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-1">
                <Brain size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary animate-pulse" />
                <h3 className="font-semibold text-sm">AI Match Profile</h3>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">
                Based on your {user?.roleLevel || 'current'} level
                {user?.workStyle ? ` · ${user.workStyle}` : ''}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#8b92b8' }} />
                  <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Skill gap analysis — derived from user's role level */}
            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-1">
                <Target size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-amber-400" />
                <h3 className="font-semibold text-sm">Skill Gap Analysis</h3>
              </div>
              <p className="text-[10px] text-muted-foreground mb-4">
                Key skills to advance from {user?.roleLevel || 'current'} level
              </p>
              <div className="space-y-3">
                {gapData.map(item => (
                  <div key={item.skill}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium">{item.skill}</span>
                      <span className="text-muted-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {item.current}% → {item.target}%
                      </span>
                    </div>
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${item.target}%`, background: item.color }} />
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${item.current}%`, background: item.color }} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      +{item.target - item.current}% gap
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-3 py-2 text-xs text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors">
                Get skill improvement plan
              </button>
            </div>

            {/* AI Insights — personalized from user profile */}
            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-accent animate-pulse" />
                <h3 className="font-semibold text-sm">AI Career Insights</h3>
              </div>
              <div className="space-y-3">
                {careerInsights.map((insight, i) => {
                  const Icon = insight.icon
                  return (
                    <div key={i} className={`flex gap-2.5 p-3 rounded-lg border text-xs group ${insight.type === 'positive' ? 'bg-emerald-500/5 border-emerald-500/15' :
                      insight.type === 'warning' ? 'bg-amber-500/5 border-amber-500/15' :
                        'bg-primary/5 border-primary/15'
                      }`}>
                      <Icon size={13} strokeWidth={1.75} fill={insight.type === 'positive' || insight.type === 'tip' ? 'currentColor' : 'none'} fillOpacity={0.15} className={`flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110 ${insight.type === 'positive' ? 'text-emerald-400' :
                        insight.type === 'warning' ? 'text-amber-400' : 'text-primary'
                        }`} />
                      <span className="text-foreground/80 leading-relaxed transition-colors group-hover:text-foreground">{insight.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
