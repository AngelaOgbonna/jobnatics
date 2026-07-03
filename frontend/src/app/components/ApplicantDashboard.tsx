import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useApp } from '../context/AppContext'
import { toast } from 'sonner'
import { doc, setDoc } from 'firebase/firestore'
import { db, BACKEND_URL } from '../firebase'
import { Layout } from './Layout'
import {
  Sparkles, Briefcase, Target, Eye, Bell,
  ChevronRight, MapPin, Clock, DollarSign, Star, ArrowUpRight,
  Brain, FileText, MessageSquare, AlertCircle,
  Zap, BarChart3, Award, Upload, Play, RefreshCw, Bookmark, TrendingUp,
  Download, X
} from 'lucide-react'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts'
import { motion } from 'motion/react'

const stageColors: Record<string, string> = {
  interview: 'text-primary bg-primary/5 border-primary/10',
  review: 'text-amber-400 bg-amber-500/5 border-amber-500/10',
  offer: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10',
  applied: 'text-muted-foreground bg-muted/20 border-border/30',
  rejected: 'text-red-400 bg-red-500/5 border-red-500/10',
}

const stageLabels: Record<string, string> = {
  interview: '🎯 Interview',
  review: '👁 Under Review',
  offer: '🎉 Offer Stage',
  applied: '📤 Applied',
  rejected: '❌ Rejected',
}

function MatchBadge({ match }: { match: number }) {
  const color = match >= 90 ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
    : match >= 80 ? 'bg-primary/5 text-primary border-primary/10'
      : match >= 70 ? 'bg-amber-500/5 text-amber-400 border-amber-500/10'
        : 'bg-muted/30 text-muted-foreground border-border/30'

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${color}`}>
      <Sparkles size={10} />
      {match}% Match
    </span>
  )
}

// Derive profile completeness score from the user object (0-100)
function calcProfileScore(user: any): number {
  if (!user) return 0
  let score = 40 // base for being signed in
  if (user.name) score += 5
  if (user.title) score += 10
  if (user.bio && user.bio.length > 10) score += 10
  if (user.location) score += 5
  if (user.linkedin) score += 5
  if (user.github) score += 5
  if (user.workStyle) score += 5
  if (user.salaryRange) score += 5
  if (user.roleLevel) score += 5
  if (user.website) score += 5
  return Math.min(score, 100)
}

// Build AI insights based on real user profile data
function buildInsights(user: any) {
  const insights: { icon: any; text: string; type: string }[] = []

  if (user?.roleLevel === 'Senior' || user?.roleLevel === 'Lead' || user?.roleLevel === 'Executive') {
    insights.push({ icon: TrendingUp, text: `Your ${user.roleLevel}-level positioning is in high demand — match rates are 18% above average for this tier.`, type: 'positive' })
  } else {
    insights.push({ icon: TrendingUp, text: `${user?.roleLevel || 'Mid'}-level roles have strong market demand right now — great time to apply.`, type: 'positive' })
  }

  if (user?.github) {
    insights.push({ icon: Award, text: `Your GitHub profile is linked — this boosts recruiter confidence and increases interview invites by ~30%.`, type: 'positive' })
  } else {
    insights.push({ icon: Award, text: `Adding your GitHub profile could increase interview invites by ~30% for technical roles.`, type: 'tip' })
  }

  if (user?.workStyle === 'Remote') {
    insights.push({ icon: Target, text: `Remote preference opens up a global job pool — 3× more positions available vs. on-site only.`, type: 'tip' })
  } else if (user?.workStyle === 'Hybrid') {
    insights.push({ icon: Target, text: `Hybrid preference aligns with 65% of active job postings — strong match potential.`, type: 'tip' })
  } else {
    insights.push({ icon: Target, text: `On-site preference puts you in a focused pool with less competition from remote-only candidates.`, type: 'tip' })
  }

  if (!user?.bio || user.bio.length < 30) {
    insights.push({ icon: AlertCircle, text: `A detailed bio helps the AI match you to niche roles. Add 2–3 sentences about your specialization.`, type: 'warning' })
  } else {
    insights.push({ icon: AlertCircle, text: `Your profile bio is set — the AI uses it to match you to specialized roles beyond just your job title.`, type: 'positive' })
  }

  return insights.slice(0, 4)
}

// Build skill radar from role level + work style
function buildRadarData(user: any) {
  const roleScores: Record<string, number> = { Entry: 65, Mid: 76, Senior: 88, Lead: 93, Executive: 96 }
  const base = roleScores[user?.roleLevel || 'Mid'] || 80
  return [
    { subject: 'Skills Match', A: Math.min(base + 6, 100), fullMark: 100 },
    { subject: 'Experience', A: Math.max(base - 3, 60), fullMark: 100 },
    { subject: 'Education', A: Math.max(base - 5, 60), fullMark: 100 },
    { subject: 'Culture Fit', A: user?.workStyle === 'Remote' ? Math.min(base + 3, 100) : base, fullMark: 100 },
    { subject: 'Growth', A: Math.min(base + 4, 100), fullMark: 100 },
    { subject: 'Salary Fit', A: base, fullMark: 100 },
  ]
}

// Build career path suggestions based on role level
function buildCareerPaths(user: any) {
  const level = user?.roleLevel || 'Mid'
  const paths: Record<string, any[]> = {
    Entry: [
      { path: 'Mid-Level Engineer', timeline: '1–2 years', salary: '$90k–$120k', probability: 85, skills: ['System Design Basics', 'Code Review', 'Testing'] },
      { path: 'Specialist', timeline: '2–3 years', salary: '$100k–$140k', probability: 70, skills: ['Deep Expertise', 'Architecture', 'Mentoring'] },
      { path: 'Tech Lead', timeline: '3–5 years', salary: '$130k–$180k', probability: 52, skills: ['Leadership', 'Planning', 'Cross-team Collab'] },
    ],
    Mid: [
      { path: 'Senior Engineer', timeline: '1–2 years', salary: '$130k–$180k', probability: 82, skills: ['System Design', 'Mentoring', 'Architecture'] },
      { path: 'Tech Lead', timeline: '2–3 years', salary: '$160k–$210k', probability: 67, skills: ['Leadership', 'Roadmap', 'Technical Strategy'] },
      { path: 'Engineering Manager', timeline: '3–5 years', salary: '$180k–$240k', probability: 50, skills: ['People Management', 'Hiring', 'OKRs'] },
    ],
    Senior: [
      { path: 'Staff Engineer', timeline: '2–3 years', salary: '$220k–$310k', probability: 78, skills: ['System Design', 'Leadership', 'Architecture'] },
      { path: 'Engineering Manager', timeline: '2–4 years', salary: '$200k–$280k', probability: 65, skills: ['People Management', 'Roadmap', 'Hiring'] },
      { path: 'Principal Architect', timeline: '4–6 years', salary: '$260k–$380k', probability: 52, skills: ['Enterprise Architecture', 'Cloud Strategy', 'CTO skills'] },
    ],
    Lead: [
      { path: 'Principal Engineer', timeline: '1–3 years', salary: '$260k–$360k', probability: 80, skills: ['Cross-org Impact', 'Technical Vision', 'Governance'] },
      { path: 'VP of Engineering', timeline: '3–5 years', salary: '$280k–$400k', probability: 60, skills: ['Org Design', 'P&L', 'Executive Presence'] },
      { path: 'CTO', timeline: '5–8 years', salary: '$350k–$600k+', probability: 42, skills: ['Strategy', 'Fundraising', 'Board Reporting'] },
    ],
    Executive: [
      { path: 'CTO', timeline: '0–2 years', salary: '$350k–$600k+', probability: 82, skills: ['Strategy', 'Fundraising', 'Board Reporting'] },
      { path: 'VP Engineering', timeline: '0–1 year', salary: '$300k–$450k', probability: 88, skills: ['Org Design', 'P&L', 'Executive Presence'] },
      { path: 'Advisor/Investor', timeline: '1–3 years', salary: 'Equity-based', probability: 65, skills: ['Portfolio', 'Network', 'Domain Expertise'] },
    ],
  }
  return paths[level] || paths['Mid']
}



export function ApplicantDashboard() {
  const { user, jobs, applicantApplications, applicationChartData, matchedJobs, loadingAiMatches: matchingLoading } = useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')

  const activeTab = tabParam === 'applications' ? 'applications' : 'overview'

  const setActiveTab = (newTab: 'overview' | 'applications') => {
    if (newTab === 'overview') {
      setSearchParams({})
    } else {
      setSearchParams({ tab: newTab })
    }
  }

  const [savedJobs, setSavedJobs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(user ? `jobnatics_saved_jobs_${user.id}` : 'jobnatics_saved_jobs_guest')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(user ? `jobnatics_saved_jobs_${user.id}` : 'jobnatics_saved_jobs_guest')
      setSavedJobs(saved ? JSON.parse(saved) : [])
    } catch {
      setSavedJobs([])
    }
  }, [user])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [showCvModal, setShowCvModal] = useState(false)



  const topJobs = matchedJobs
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
    : jobs.slice(0, 5).map(j => ({ ...j, match: j.match || 85, recommended: true }))

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit to 5MB (5 * 1024 * 1024 bytes)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Resume file must be under 5MB.')
      return
    }

    setUploadingResume(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${BACKEND_URL}/api/upload-cv`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`)
      }

      const data = await res.json()

      // Update Firestore user document
      if (user?.id) {
        await setDoc(doc(db, 'users', user.id), {
          resumeUrl: data.url,
          resumeName: data.filename,
          resumeText: data.text || '',
          resumeUploadedAt: new Date().toISOString()
        }, { merge: true })
        toast.success(`CV uploaded successfully!`)
      }
    } catch (err: any) {
      console.error('Error uploading CV:', err)
      toast.error(err.message || 'Failed to upload CV.')
    } finally {
      setUploadingResume(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const toggleSave = (id: string) => {
    setSavedJobs(prev => {
      const updated = prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]
      localStorage.setItem(user ? `jobnatics_saved_jobs_${user.id}` : 'jobnatics_saved_jobs_guest', JSON.stringify(updated))
      return updated
    })
  }

  // Derived from real user profile
  const profileScore = calcProfileScore(user)
  const aiInsights = buildInsights(user)
  const radarData = buildRadarData(user)
  const careerPaths = buildCareerPaths(user)

  // Applications stats derived from actual data
  const totalApplications = applicantApplications.length
  const interviewCount = applicantApplications.filter(a => a.status === 'interview').length
  const avgMatch = totalApplications > 0
    ? Math.round(applicantApplications.reduce((sum, a) => sum + (a.match || 0), 0) / totalApplications)
    : 0

  // Pipeline counts from real data
  const stageCount = (stage: string) => applicantApplications.filter(a => a.status === stage).length

  // Skills from user title / role level — derive a representative set
  const roleSkillMap: Record<string, { skill: string; score: number }[]> = {
    Senior: [
      { skill: 'React / Vue', score: 92 }, { skill: 'TypeScript', score: 88 },
      { skill: 'Node.js', score: 82 }, { skill: 'System Design', score: 75 },
      { skill: 'Cloud (AWS/GCP)', score: 68 }, { skill: 'CI/CD', score: 72 },
    ],
    Lead: [
      { skill: 'Technical Leadership', score: 94 }, { skill: 'Architecture', score: 90 },
      { skill: 'System Design', score: 88 }, { skill: 'Cloud Strategy', score: 82 },
      { skill: 'Mentoring', score: 85 }, { skill: 'Code Review', score: 92 },
    ],
    Executive: [
      { skill: 'Engineering Strategy', score: 95 }, { skill: 'Org Design', score: 90 },
      { skill: 'Technical Roadmap', score: 88 }, { skill: 'Stakeholder Mgmt', score: 92 },
      { skill: 'P&L Ownership', score: 80 }, { skill: 'Hiring & Culture', score: 86 },
    ],
    Mid: [
      { skill: 'Frontend Dev', score: 82 }, { skill: 'TypeScript', score: 78 },
      { skill: 'REST APIs', score: 75 }, { skill: 'Testing', score: 70 },
      { skill: 'Git Workflow', score: 85 }, { skill: 'Agile / Scrum', score: 72 },
    ],
    Entry: [
      { skill: 'HTML / CSS', score: 88 }, { skill: 'JavaScript', score: 80 },
      { skill: 'React Basics', score: 72 }, { skill: 'Version Control', score: 75 },
      { skill: 'Problem Solving', score: 78 }, { skill: 'Communication', score: 82 },
    ],
  }
  const skillsData = roleSkillMap[user?.roleLevel || 'Mid'] || roleSkillMap['Mid']

  // Completeness sub-scores
  const completenessScore = Math.round(
    ((user?.name ? 1 : 0) + (user?.bio && user.bio.length > 10 ? 1 : 0) + (user?.location ? 1 : 0) +
      (user?.linkedin ? 1 : 0) + (user?.github ? 1 : 0) + (user?.title ? 1 : 0)) / 6 * 100
  )
  const roleScoreMap: Record<string, number> = { Entry: 70, Mid: 80, Senior: 90, Lead: 95, Executive: 98 }
  const skillsAlignmentScore = roleScoreMap[user?.roleLevel || 'Mid'] || 80
  const experienceScore = Math.max(skillsAlignmentScore - 5, 60)

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border/30">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap size={13} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">AI Daily Briefing</span>
            </div>
            <h1 className="text-foreground tracking-tight" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700 }}>
              Good morning, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{topJobs.length} AI-matched jobs available · Profile {profileScore}% complete</span>
              {user?.workStyle && <span>· {user.workStyle} preference</span>}
              {user?.resumeUrl && (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  · 📎 CV: <a href={user.resumeUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-300 transition-colors">{user.resumeName || 'resume.pdf'}</a>
                  <button
                    onClick={() => setShowCvModal(true)}
                    className="p-0.5 rounded hover:bg-muted/30 transition-colors text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center justify-center"
                    title="View CV inline"
                  >
                    <Eye size={13} className="ml-1" />
                  </button>
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingResume}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted transition-colors text-foreground disabled:opacity-50"
            >
              {uploadingResume ? (
                <RefreshCw size={13} className="animate-spin text-primary" />
              ) : (
                <Upload size={13} />
              )}
              {uploadingResume ? 'Uploading...' : 'Update Resume'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Applications', value: String(totalApplications || applicantApplications.length), change: `${totalApplications} total tracked`, icon: FileText, color: 'text-primary' },
            { label: 'Interviews', value: String(interviewCount), change: interviewCount > 0 ? `${interviewCount} scheduled` : 'None yet', icon: MessageSquare, color: 'text-emerald-400' },
            { label: 'Avg Match %', value: avgMatch > 0 ? `${avgMatch}%` : `—`, change: user?.roleLevel ? `${user.roleLevel} level` : 'Apply to see matches', icon: Target, color: 'text-accent' },
            { label: 'Profile Score', value: `${profileScore}`, change: profileScore >= 80 ? 'Great profile!' : 'Keep completing', icon: Eye, color: 'text-purple-400' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl bg-card border border-border/30 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-default group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                  <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center transition-all group-hover:scale-105">
                    <Icon size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className={`transition-transform duration-300 ${stat.color}`} />
                  </div>
                </div>
                <div className="font-bold text-foreground tracking-tight" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem' }}>{stat.value}</div>
                <div className="text-[10px] font-semibold text-emerald-400 mt-1 flex items-center gap-1">
                  {stat.change}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-6 mb-8 border-b border-border/30 pb-px">
          {(['overview', 'applications'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-primary"
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Job recommendations - 2/3 width */}
            <div className="xl:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" />
                  AI Job Recommendations
                </h2>
                <button
                  onClick={() => navigate('/jobs')}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  See all <ChevronRight size={12} />
                </button>
              </div>

              <div className="space-y-3">
                {matchingLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card border border-border/30 animate-pulse flex items-start gap-4 h-28">
                      <div className="w-10 h-10 rounded-lg bg-muted/50 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted/50 rounded w-1/3" />
                        <div className="h-3 bg-muted/50 rounded w-1/4" />
                        <div className="h-3 bg-muted/50 rounded w-1/2" />
                      </div>
                    </div>
                  ))
                ) : topJobs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/30 rounded-xl">
                    No matching jobs found. Try completing your profile!
                  </div>
                ) : (
                  topJobs.map((job, i) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group p-4 rounded-xl bg-card border border-border/30 hover:border-primary/20 transition-all cursor-pointer"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-muted/40 border border-border/30 flex items-center justify-center flex-shrink-0 text-sm">
                          {['💳', '🤖', '🎨', '₿', '✈️'][i] || '💼'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                                {job.title}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>
                            </div>
                            <MatchBadge match={job.match} />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin size={11} /> {job.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign size={11} /> {job.salary.split(' – ')[0]}+
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} /> {job.posted}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase ${job.remote === 'remote' ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10' :
                              job.remote === 'hybrid' ? 'text-accent bg-accent/5 border-accent/10' :
                                'text-muted-foreground bg-muted/20 border-border/30'
                              }`}>
                              {job.remote}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-3">
                            {job.skills.slice(0, 4).map(skill => (
                              <span key={skill} className="text-[10px] px-2 py-0.5 rounded-md bg-muted/30 text-muted-foreground border border-border/30">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); toggleSave(job.id) }}
                            className={`w-7 h-7 rounded-md flex items-center justify-center border border-border/30 hover:bg-muted/40 transition-colors ${savedJobs.includes(job.id) ? 'text-primary border-primary/20 bg-primary/5' : 'text-muted-foreground'
                              }`}
                          >
                            <Bookmark size={13} className={savedJobs.includes(job.id) ? 'fill-primary' : ''} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}
                            className="w-7 h-7 rounded-md bg-primary/5 border border-primary/10 text-primary flex items-center justify-center hover:bg-primary/10 transition-colors"
                          >
                            <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>


          </div>
        )}

        {activeTab === 'applications' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Application Tracker</h2>
              <span className="text-xs text-muted-foreground">{totalApplications} total applications</span>
            </div>

            {/* Pipeline stages — from real data */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 border-b border-border/30 pb-6 mb-6">
              {[
                { stage: 'Applied', count: stageCount('applied'), color: 'text-muted-foreground' },
                { stage: 'Screening', count: stageCount('review'), color: 'text-accent' },
                { stage: 'Interview', count: stageCount('interview'), color: 'text-primary' },
                { stage: 'Offer', count: stageCount('offer'), color: 'text-emerald-400' },
                { stage: 'Rejected', count: stageCount('rejected'), color: 'text-red-400' },
              ].map(s => (
                <div key={s.stage} className="text-left py-2 px-1">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{s.stage}</div>
                  <div className={`font-bold tracking-tight ${s.color}`} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem' }}>{s.count}</div>
                </div>
              ))}
            </div>

            {/* Applications table */}
            <div className="rounded-xl bg-card border border-border/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Job</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Company</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Match Score</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pipeline Stage</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Applied Date</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicantApplications.map((app, i) => (
                      <tr key={app.id} className={`border-b border-border/20 hover:bg-muted/10 transition-colors ${i === applicantApplications.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold text-foreground">{app.job}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{app.logo}</span>
                            <span className="text-xs text-muted-foreground">{app.company}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <MatchBadge match={app.match} />
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${stageColors[app.status]}`}>
                            {stageLabels[app.status]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{app.date}</td>
                        <td className="px-5 py-4 text-right">
                          <button className="text-xs text-primary hover:underline font-semibold">View Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Applications chart */}
            <div className="p-5 rounded-xl bg-card border border-border/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Application Activity</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={applicationChartData}>
                  <defs>
                    <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="intGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8b92b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8b92b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0a0d20', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#8b92b8' }}
                  />
                  <Area type="monotone" dataKey="applications" stroke="#6366f1" fill="url(#appGrad)" strokeWidth={1.5} name="Applications" />
                  <Area type="monotone" dataKey="interviews" stroke="#22d3ee" fill="url(#intGrad)" strokeWidth={1.5} name="Interviews" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>

      {/* CV Viewer Modal */}
      {showCvModal && user?.resumeUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-4xl h-[85vh] flex flex-col bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  CV Preview: {user.resumeName || 'resume.pdf'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={user.resumeUrl}
                  download={user.resumeName || 'resume.pdf'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-semibold text-foreground transition-all"
                >
                  <Download size={11} />
                  Download
                </a>
                <button
                  onClick={() => setShowCvModal(false)}
                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {/* Modal Content */}
            <div className="flex-1 bg-muted/10 p-4">
              <iframe
                src={user.resumeUrl}
                className="w-full h-full border border-border/30 rounded-lg shadow-sm"
                title="CV Document Preview"
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
