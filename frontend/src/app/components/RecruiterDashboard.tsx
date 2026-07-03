import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useApp } from '../context/AppContext'
import { Layout } from './Layout'
import {
  Sparkles, Users, Briefcase, Clock, BarChart3,
  ChevronRight, ArrowUpRight, Brain, Plus, Filter,
  Calendar, MessageSquare, AlertCircle, Zap, RefreshCw, Eye, TrendingUp, Star,
  ArrowLeft, MapPin, DollarSign, FileText, Download, X
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts'
import { motion } from 'motion/react'
import { doc, setDoc } from 'firebase/firestore'
import { db, BACKEND_URL } from '../firebase'

function MatchBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
    : score >= 80 ? 'bg-primary/5 text-primary border-primary/10'
      : score >= 70 ? 'bg-amber-500/5 text-amber-400 border-amber-500/10'
        : 'bg-muted/30 text-muted-foreground border-border/30'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${color}`}>
      <Sparkles size={10} /> {score}%
    </span>
  )
}

const stageColors: Record<string, string> = {
  applied: 'text-muted-foreground bg-muted/20 border-border/30',
  screening: 'text-accent bg-accent/5 border-accent/10',
  interview: 'text-primary bg-primary/5 border-primary/10',
  offer: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10',
  hired: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  rejected: 'text-red-400 bg-red-500/5 border-red-500/10',
}

const stageLabels: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer Sent',
  hired: 'Hired',
  rejected: 'Rejected',
}

function buildUserResumeText(u: { title?: string; roleLevel?: string; workStyle?: string; bio?: string; location?: string; github?: string }) {
  const parts = [u.title, u.roleLevel, u.workStyle, u.bio, u.location, u.github].filter(Boolean)
  return parts.join('\n') || 'No resume details provided.'
}

export function RecruiterDashboard() {
  const {
    user, jobs, candidates, recruiterHiringData, recruiterJobPostings,
    sourceData, monthlyHireData, allUsers, applicantApplications
  } = useApp()
  const navigate = useNavigate()

  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')

  const activeTab = (tabParam === 'match') ? tabParam : 'overview'

  const setActiveTab = (newTab: 'overview' | 'match') => {
    if (newTab === 'overview') {
      setSearchParams({})
    } else {
      setSearchParams({ tab: newTab })
    }
  }

  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [showCvModal, setShowCvModal] = useState(false)
  const [viewingCvUrl, setViewingCvUrl] = useState('')
  const [viewingCvName, setViewingCvName] = useState('')
  const [customJobDescription, setCustomJobDescription] = useState<string>('')
  const [matchingResults, setMatchingResults] = useState<any | null>(null)
  const [matchingLoading, setMatchingLoading] = useState<boolean>(false)
  const [matchingError, setMatchingError] = useState<string | null>(null)

  const [selectedManageJob, setSelectedManageJob] = useState<any | null>(null)
  const [applicantScores, setApplicantScores] = useState<Record<string, { score: number, base_outcome: boolean }>>({})

  // Fetch match scores for job postings overview (Top Match column)
  useEffect(() => {
    if (!selectedManageJob) {
      setApplicantScores({})
      return
    }

    const jobApplicants = applicantApplications.filter(a => a.jobId === selectedManageJob.id)
    if (jobApplicants.length === 0) {
      setApplicantScores({})
      return
    }

    const fetchApplicantScores = async () => {
      try {
        const payloadApplicants = jobApplicants.map(app => {
          const prof = allUsers.find(u => u.id === app.userId)
          return {
            applicant_id: app.userId,
            resume_text: buildUserResumeText(prof || {}),
            demographic_group: 0
          }
        })

        const res = await fetch(`${BACKEND_URL}/api/match-applicants`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            job_description: `${selectedManageJob.title}\n\n${selectedManageJob.description}\n\n${(selectedManageJob.requirements || []).join('\n')}`,
            applicants: payloadApplicants
          })
        })

        if (res.ok) {
          const data = await res.json()
          const scoresMap: Record<string, { score: number, base_outcome: boolean }> = {}
          data.matches.forEach((m: any) => {
            scoresMap[m.applicant_id] = {
              score: m.score,
              base_outcome: m.base_outcome
            }
          })
          setApplicantScores(scoresMap)
        }
      } catch (err) {
        console.error('Error fetching applicant match scores:', err)
      }
    }

    fetchApplicantScores()
  }, [selectedManageJob, applicantApplications, allUsers])

  const handleUpdateStatus = async (appId: string, newStatus: string) => {
    const stageMap: Record<string, string> = {
      applied: 'Applied',
      screening: 'Screening',
      interview: 'Interview',
      offer: 'Offer Sent',
      hired: 'Hired',
      rejected: 'Rejected'
    }
    try {
      const appRef = doc(db, 'applicantApplications', appId)
      await setDoc(appRef, {
        status: newStatus,
        stage: stageMap[newStatus] || 'Applied'
      }, { merge: true })
    } catch (err) {
      console.error('Error updating application status:', err)
    }
  }
  // Auto-populate customJobDescription when selectedJobId changes
  useEffect(() => {
    if (selectedJobId) {
      const selected = jobs.find(j => j.id === selectedJobId)
      if (selected) {
        setCustomJobDescription(
          `Job Title: ${selected.title}\nCompany: ${selected.company}\n\nDescription:\n${selected.description}\n\nRequirements:\n${selected.requirements?.join('\n') || ''}`
        )
      }
    } else {
      setCustomJobDescription('')
    }
  }, [selectedJobId, jobs])

  const handleMatchCandidates = async () => {
    if (!customJobDescription.trim()) return

    setMatchingLoading(true)
    setMatchingError(null)
    setMatchingResults(null)

    try {
      const res = await fetch(`${BACKEND_URL}/api/match-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_description: customJobDescription,
        }),
      })

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`)
      }

      const data = await res.json()

      const professionalNames = [
        "Sarah Jenkins", "Michael Chang", "Amara Okafor", "David Vance", "Elena Rostova",
        "Marcus Aurelius", "Priya Patel", "Carlos Mendez", "Yuki Tanaka", "John Doe",
        "Sophia Dubois", "Liam O'Connor", "Aisha Bello", "Hans Schmidt", "Ji-Won Kim"
      ]
      const locations = ["San Francisco, CA", "New York, NY", "London, UK", "Berlin, DE", "Tokyo, JP", "Toronto, ON", "Chicago, IL", "Austin, TX"]

      const ranked = data.candidates.map((cand: any, index: number) => {
        const name = professionalNames[index % professionalNames.length]
        const location = locations[index % locations.length]
        const fallbackAvatar = `https://i.pravatar.cc/150?img=${index + 10}`

        // Find matching real user in Firestore by name (case-insensitive)
        const realUser = allUsers.find(u => u.name && u.name.toLowerCase().trim() === name.toLowerCase().trim())

        return {
          userId: realUser?.id || `csv-${cand.rank}`,
          rank: cand.rank,
          name: name,
          avatar: realUser?.avatar || fallbackAvatar,
          title: cand.category,
          location: realUser?.location || location,
          bioSnippet: cand.resume_snippet,
          similarity_score: cand.similarity_score,
          shortlisted_base: cand.shortlisted_base,
          shortlisted_fair: cand.shortlisted_fair,
          reranked: cand.reranked,
          demographic_group: cand.demographic_group,
          resumeUrl: realUser?.resumeUrl || "https://res.cloudinary.com/demo/image/upload/v1234567890/sample.pdf",
          resumeName: realUser?.resumeName || "resume.pdf"
        }
      })

      setMatchingResults({
        cohort_size: data.cohort_size,
        fairness_correction_applied: data.fairness_correction_applied,
        optimizer_used: data.optimizer_used,
        fairness_metrics: data.fairness_metrics,
        candidates: ranked,
      })
    } catch (err: any) {
      setMatchingError(err.message || 'An error occurred during matching.')
    } finally {
      setMatchingLoading(false)
    }
  }
  // Real-time Firestore-backed metrics
  const myJobs = jobs.filter(j => j.postedBy === user?.id)
  const myApplications = applicantApplications.filter(a => myJobs.some(j => j.id === a.jobId))
  const myInterviews = myApplications.filter(a => a.status === 'interview')
  const myOffers = myApplications.filter(a => a.status === 'offer')
  const myPendingReview = myApplications.filter(a => a.status === 'applied')

  const myHighRiskCandidates = myApplications
    .filter(a => (a.status === 'interview' || a.status === 'offer'))
    .map(a => {
      const realUser = allUsers.find(u => u.id === a.userId)
      return {
        name: realUser?.name || 'Applicant',
        stage: a.status || 'interview',
        aiScore: a.match || 75
      }
    })
    .filter(c => c.aiScore >= 85)

  const aiInsights = [
    { icon: TrendingUp, text: `Your avg time-to-fill is 18 days — 24% faster than industry average`, type: 'positive' },
    myHighRiskCandidates.length >= 2
      ? { icon: Star, text: `${myHighRiskCandidates[0].name} & ${myHighRiskCandidates[1].name} are at offer/interview stage — act fast to prevent competing offers`, type: 'warning' }
      : myHighRiskCandidates.length === 1
        ? { icon: Star, text: `${myHighRiskCandidates[0].name} is at ${myHighRiskCandidates[0].stage} stage with a ${myHighRiskCandidates[0].aiScore}% match — consider fast-tracking`, type: 'warning' }
        : { icon: Star, text: `No high-priority candidates at risk yet — your pipeline looks stable`, type: 'positive' },
    { icon: Brain, text: `${myPendingReview.length} candidate${myPendingReview.length !== 1 ? 's' : ''} in your pipeline haven't been reviewed yet`, type: 'tip' },
    myJobs.length > 0
      ? { icon: AlertCircle, text: `${myJobs.length} active job${myJobs.length !== 1 ? 's' : ''} open — keep refreshing listings to attract top talent`, type: 'tip' }
      : { icon: AlertCircle, text: 'No active job postings — post a new role to start receiving applicants', type: 'warning' },
  ]

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border/30">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap size={13} className="text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Recruiter Intelligence</span>
            </div>
            <h1 className="text-foreground tracking-tight" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700 }}>
              Welcome back, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {user?.company || 'Your company'} · {myApplications.length} total applicants · {myInterviews.length} interviews · {myPendingReview.length} pending review
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/post-job')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/95 transition-all shadow-sm"
            >
              <Plus size={13} />
              Post New Job
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Active Jobs', value: String(myJobs.length), change: `${myJobs.length} active postings`, icon: Briefcase, color: 'text-primary' },
            { label: 'Total Applicants', value: String(myApplications.length), change: `${myPendingReview.length} unreviewed`, icon: Users, color: 'text-accent' },
            { label: 'Interviews', value: String(myInterviews.length), change: `${myOffers.length} at offer stage`, icon: Calendar, color: 'text-purple-400' },
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

        {selectedManageJob ? (
          <div className="space-y-6">
            {/* Header / Back */}
            <div className="flex items-center justify-between pb-4 border-b border-border/30">
              <button
                onClick={() => setSelectedManageJob(null)}
                className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group"
              >
                <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
                Back to Dashboard
              </button>
              <span className="text-[10px] px-2.5 py-1 rounded-full border uppercase font-bold bg-emerald-500/5 text-emerald-400 border-emerald-500/10">
                Active Posting
              </span>
            </div>

            {/* Job Header Card */}
            <div className="p-6 rounded-xl bg-card border border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1.5" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {selectedManageJob.title}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin size={12} /> {selectedManageJob.location || 'Remote'}</span>
                  <span className="flex items-center gap-1"><DollarSign size={12} /> {selectedManageJob.salary || '$80k - $120k'}</span>
                  <span className="flex items-center gap-1"><Briefcase size={12} /> {selectedManageJob.type || 'Full-time'} · {selectedManageJob.level || 'Mid-Level'}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedJobId(selectedManageJob.id)
                  setActiveTab('match')
                  setSelectedManageJob(null)
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs font-semibold transition-all"
              >
                <Sparkles size={13} />
                Run AI Matcher Cohort
              </button>
            </div>

            {/* Grid layout: Description & Applicants */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Left Column: Job Description */}
              <div className="lg:col-span-1 space-y-6">
                <div className="p-5 rounded-xl bg-card border border-border/30">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Briefcase size={13} className="text-primary" />
                    Role Description
                  </h3>
                  <div className="text-xs text-muted-foreground space-y-3 leading-relaxed max-h-[450px] overflow-y-auto pr-1">
                    <p className="whitespace-pre-line">{selectedManageJob.description}</p>
                    {selectedManageJob.requirements && selectedManageJob.requirements.length > 0 && (
                      <div>
                        <h4 className="font-bold text-foreground mt-4 mb-2">Requirements:</h4>
                        <ul className="list-disc pl-4 space-y-1">
                          {selectedManageJob.requirements.map((req: string, idx: number) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Applicants List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="p-5 rounded-xl bg-card border border-border/30">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Users size={14} className="text-accent" />
                    Job Applicants ({applicantApplications.filter(a => a.jobId === selectedManageJob.id).length})
                  </h3>

                  {/* Applicants Table/List */}
                  {(() => {
                    const jobApplicants = applicantApplications.filter(a => a.jobId === selectedManageJob.id)
                    if (jobApplicants.length === 0) {
                      return (
                        <div className="p-12 text-center text-muted-foreground">
                          <Users size={32} className="mx-auto mb-3 stroke-[1.25] text-muted-foreground/30" />
                          <p className="text-xs">No candidates have applied to this posting yet.</p>
                        </div>
                      )
                    }

                    return (
                      <div className="space-y-4">
                        {jobApplicants.map((app) => {
                          const prof = allUsers.find(u => u.id === app.userId)
                          const name = prof?.name || 'Applicant'
                          const title = prof?.title || 'Software Engineer'
                          const location = prof?.location || 'Remote'
                          const avatar = prof?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face'
                          const email = prof?.email || ''

                          return (
                            <div key={app.id} className="p-4 rounded-lg bg-muted/10 border border-border/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <img src={avatar} alt={name} className="w-10 h-10 rounded-lg object-cover ring-2 ring-primary/10 flex-shrink-0" />
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground">{name}</h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">{title} · {location}</p>
                                  {email && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{email}</p>}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-4">
                                {/* Status Selector */}
                                <div>
                                  <div className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Status</div>
                                  <select
                                    value={app.status || 'applied'}
                                    onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                                    className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary transition-colors font-semibold"
                                  >
                                    <option value="applied">Applied</option>
                                    <option value="screening">Screening</option>
                                    <option value="interview">Interview</option>
                                    <option value="offer">Offer Sent</option>
                                    <option value="hired">Hired</option>
                                    <option value="rejected">Rejected</option>
                                  </select>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5 md:ml-2">

                                  <button
                                    onClick={() => navigate(`/profile/${app.userId}`)}
                                    className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    title="View Profile"
                                  >
                                    <Eye size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>

            </div>

          </div>
        ) : (
          <>
            {/* Tab navigation */}
            <div className="flex gap-6 mb-8 border-b border-border/30 pb-px">
              {(['overview', 'match'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {tab === 'match' ? 'AI Candidate Matcher' : tab}
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

                {/* Left column 2/3 */}
                <div className="xl:col-span-2 space-y-6">

                  {/* Job postings */}
                  <div className="rounded-xl bg-card border border-border/30 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border/30 bg-muted/10">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Job Postings</h3>
                      <button
                        onClick={() => navigate('/jobs')}
                        className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                      >
                        Manage all <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      {(() => {
                        const myJobs = jobs.filter(j => j.postedBy === user?.id)
                        if (myJobs.length === 0) {
                          return (
                            <div className="p-8 text-center text-muted-foreground">
                              <Briefcase size={32} className="mx-auto mb-3 stroke-[1.25] text-muted-foreground/30" />
                              <p className="text-xs">You haven't posted any jobs yet.</p>
                              <button
                                onClick={() => navigate('/post-job')}
                                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/95 transition-all shadow-sm"
                              >
                                <Plus size={12} /> Post your first job
                              </button>
                            </div>
                          )
                        }

                        return (
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-border/30">
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Applicants</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Today</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Match</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Views</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {myJobs.map((job, i) => {
                                const jobApplicants = applicantApplications.filter(a => a.jobId === job.id)
                                const topScore = jobApplicants.length > 0
                                  ? Math.max(...jobApplicants.map(a => applicantScores[a.userId]?.score || a.match || 75))
                                  : 0
                                return (
                                  <tr key={job.id} className={`border-b border-border/20 hover:bg-muted/10 transition-colors ${i === myJobs.length - 1 ? 'border-b-0' : ''}`}>
                                    <td className="px-5 py-3.5 text-xs font-semibold text-foreground">{job.title}</td>
                                    <td className="px-5 py-3.5 text-xs">{jobApplicants.length}</td>
                                    <td className="px-5 py-3.5">
                                      <span className="text-xs text-emerald-400 font-semibold">
                                        +{jobApplicants.filter(a => a.status === 'applied').length}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                      {topScore > 0 ? <MatchBadge score={Math.round(topScore)} /> : <span className="text-xs text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{(job.views || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3.5">
                                      <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold bg-emerald-500/5 text-emerald-400 border-emerald-500/10`}>
                                        Active
                                      </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                      <button
                                        onClick={() => setSelectedManageJob(job)}
                                        className="text-xs text-primary hover:underline font-semibold"
                                      >
                                        Manage
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )
                      })()}
                    </div>
                  </div>

                </div>

                {/* Right sidebar 1/3 */}
                <div className="space-y-6">

                  {/* AI top candidates */}
                  <div className="p-5 rounded-xl bg-card border border-border/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Brain size={14} className="text-primary" />
                        AI Top Candidates
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {candidates.slice(0, 4).map((candidate, i) => (
                        <div
                          key={candidate.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-muted/10 hover:border-primary/20 transition-all cursor-pointer group"
                          onClick={() => navigate(`/profile/${candidate.id}`)}
                        >
                          <div className="relative flex-shrink-0">
                            <img src={candidate.avatar} alt={candidate.name} className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/10" />
                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-card border border-border/30 flex items-center justify-center text-[8px] font-bold text-primary">
                              {i + 1}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate group-hover:text-primary transition-colors text-foreground">{candidate.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">{candidate.title}</div>
                          </div>
                          <MatchBadge score={candidate.aiScore} />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'match' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                  {/* Left Column: Job Selector & Description Input */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="p-5 rounded-xl bg-card border border-border/30 flex flex-col space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase size={16} className="text-primary" />
                        <h3 className="text-sm font-bold text-foreground">Select Job Posting</h3>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-2">
                          Choose Active Role
                        </label>
                        <select
                          value={selectedJobId}
                          onChange={(e) => setSelectedJobId(e.target.value)}
                          className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary transition-colors"
                        >
                          <option value="" className="bg-card text-muted-foreground">-- Custom Search / Paste Description --</option>
                          {jobs.map((job) => (
                            <option key={job.id} value={job.id} className="bg-card text-foreground">
                              {job.title} ({job.company})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col flex-1">
                        <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-2">
                          Job Description & Requirements
                        </label>
                        <textarea
                          value={customJobDescription}
                          onChange={(e) => setCustomJobDescription(e.target.value)}
                          placeholder="Paste details of the role here to find relevant, fair-aware candidates..."
                          rows={12}
                          className="w-full flex-1 rounded-lg border border-border bg-muted/20 p-3 text-xs text-foreground focus:outline-none focus:border-primary transition-all resize-none placeholder-muted-foreground/60 leading-relaxed"
                        />
                      </div>

                      <button
                        onClick={handleMatchCandidates}
                        disabled={matchingLoading || !customJobDescription.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white text-xs font-bold transition-all shadow-md active:scale-[0.98]"
                      >
                        {matchingLoading ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            Analyzing Cohort...
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            Find Fair-Aware Matches
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Fairness Dashboard & Matches */}
                  <div className="lg:col-span-2 space-y-8">

                    {matchingLoading && (
                      <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-card border border-border/30 h-96 text-center space-y-4">
                        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        <p className="text-xs text-muted-foreground font-semibold">Running TF-IDF similarity mapping and fairness ThresholdOptimizer...</p>
                      </div>
                    )}

                    {matchingError && (
                      <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 flex items-start gap-3">
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold uppercase mb-1">Server Error</h4>
                          <p className="text-xs leading-relaxed">{matchingError}</p>
                        </div>
                      </div>
                    )}

                    {!matchingResults && !matchingLoading && !matchingError && (
                      <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-card border border-border/30 h-96 text-center text-muted-foreground space-y-3">
                        <Brain size={40} className="stroke-[1.25] text-muted-foreground/40" />
                        <div>
                          <h4 className="text-xs font-bold uppercase text-foreground mb-1">Interactive AI Candidate Matcher</h4>
                          <p className="text-xs max-w-sm mt-1 leading-relaxed">Select or paste a job description on the left to rank applicants from your user pool by AI fit score.</p>
                        </div>
                      </div>
                    )}

                    {matchingResults && !matchingLoading && (
                      <div className="space-y-6">
                        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary flex items-center gap-3">
                          <Users size={14} className="flex-shrink-0" />
                          <span className="text-xs font-semibold">
                            Ranked {matchingResults.candidates.length} top matches from a global pool of {matchingResults.cohort_size} candidate profiles.
                          </span>
                        </div>

                        {/* Candidates Matches Table */}
                        <div className="rounded-xl bg-card border border-border/30 overflow-hidden">
                          <div className="p-4 border-b border-border/30 bg-muted/10">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Candidates Matched to Role</h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-border/30">
                                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-12">Rank</th>
                                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-56">Candidate</th>
                                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bio</th>
                                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Fit Score</th>
                                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-44">Recommendation</th>
                                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-10"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {matchingResults.candidates.map((cand: any) => (
                                  <tr
                                    key={cand.userId}
                                    onClick={() => {
                                      if (!cand.userId.startsWith('csv-')) {
                                        navigate(`/profile/${cand.userId}`)
                                      }
                                    }}
                                    className={`border-b border-border/20 hover:bg-muted/10 transition-colors ${cand.userId.startsWith('csv-') ? 'cursor-default' : 'cursor-pointer'
                                      } group`}
                                  >
                                    <td className="px-5 py-4 text-xs font-bold text-foreground">
                                      {cand.rank}
                                    </td>
                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-3">
                                        <img
                                          src={cand.avatar}
                                          alt={cand.name}
                                          className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/10 flex-shrink-0"
                                        />
                                        <div className="min-w-0">
                                          <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                            <span className="truncate">{cand.name}</span>
                                          </div>
                                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                            {cand.title}{cand.location ? ` · ${cand.location}` : ''}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">
                                      {cand.bioSnippet}
                                    </td>
                                    <td className="px-5 py-4 text-xs">
                                      <MatchBadge score={Math.round(cand.similarity_score * 100)} />
                                    </td>
                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold ${cand.shortlisted_fair
                                          ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
                                          : 'bg-muted/30 text-muted-foreground border-border/30'
                                          }`}>
                                          {cand.shortlisted_fair ? 'Recommend' : 'Skip'}
                                        </span>
                                        {cand.reranked && (
                                          <span className="text-[9px] px-2 py-0.5 rounded border uppercase font-bold bg-purple-500/5 text-purple-400 border-purple-500/10 flex items-center gap-0.5">
                                            ⚖️ Reranked
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                      {cand.resumeUrl ? (
                                        <button
                                          onClick={() => {
                                            setViewingCvUrl(cand.resumeUrl)
                                            setViewingCvName(cand.resumeName || 'resume.pdf')
                                            setShowCvModal(true)
                                          }}
                                          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center inline-flex"
                                          title="View CV inline"
                                        >
                                          <Eye size={14} />
                                        </button>
                                      ) : (
                                        !cand.userId.startsWith('csv-') ? (
                                          <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                        ) : null
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CV Viewer Modal */}
      {showCvModal && viewingCvUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-4xl h-[85vh] flex flex-col bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  CV Preview: {viewingCvName}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={viewingCvUrl}
                  download={viewingCvName}
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
                src={viewingCvUrl}
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
