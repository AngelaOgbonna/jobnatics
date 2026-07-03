import { useParams, useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { Layout } from './Layout'
import {
  MapPin, DollarSign, Clock, Briefcase, Sparkles, ArrowLeft,
  Bookmark, Share2, Building2, Users, CheckCircle2, AlertCircle,
  Star, Zap, Globe, MessageSquare, CalendarDays, Award,
  ChevronRight, Brain, Target,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { calculateJobMatchScore } from '../data/mockData'
const matchBreakdown = [
  { label: 'Skills Match', score: 96, detail: '9/10 required skills matched' },
  { label: 'Experience Level', score: 92, detail: 'Your 7 years aligns with Senior req.' },
  { label: 'Education', score: 100, detail: 'BS CS meets all requirements' },
  { label: 'Culture Fit', score: 88, detail: 'Strong alignment with engineering values' },
  { label: 'Location / Remote', score: 100, detail: 'Hybrid matches your preference' },
  { label: 'Salary Alignment', score: 90, detail: 'Within your expected range' },
]

export function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, jobs, applicantApplications, loadingData, addApplicantApplication, aiMatchScores } = useApp()
  const [saved, setSaved] = useState(false)
  const [applied, setApplied] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)

  const rawJob = jobs.find(j => j.id === id)
  const job = rawJob ? {
    ...rawJob,
    match: user && user.role !== 'recruiter'
      ? calculateJobMatchScore(user.skills, rawJob.skills, rawJob.id, rawJob.title, rawJob.company, aiMatchScores)
      : 75
  } : undefined

  // Initialize and sync saved state
  useEffect(() => {
    if (user && id) {
      try {
        const savedList = localStorage.getItem(`jobnatics_saved_jobs_${user.id}`)
        setSaved(savedList ? JSON.parse(savedList).includes(id) : false)
      } catch {
        setSaved(false)
      }
    } else {
      setSaved(false)
    }
  }, [user, id])

  // Sync applied state with Firestore applications
  useEffect(() => {
    if (user && job && applicantApplications) {
      const hasApplied = applicantApplications.some(
        a => a.jobId === job.id && a.userId === user.id
      )
      setApplied(hasApplied)
    } else {
      setApplied(false)
    }
  }, [user, job, applicantApplications])

  const handleToggleSave = () => {
    if (!user) {
      navigate('/auth')
      return
    }
    const storageKey = `jobnatics_saved_jobs_${user.id}`
    try {
      const savedListStr = localStorage.getItem(storageKey)
      let savedList: string[] = savedListStr ? JSON.parse(savedListStr) : []
      if (savedList.includes(id!)) {
        savedList = savedList.filter(item => item !== id)
        setSaved(false)
      } else {
        savedList.push(id!)
        setSaved(true)
      }
      localStorage.setItem(storageKey, JSON.stringify(savedList))
    } catch (err) {
      console.error(err)
    }
  }

  const handleApply = async () => {
    if (!user || !job) {
      navigate('/auth')
      return
    }
    if (user.role === 'recruiter') return

    setApplyLoading(true)
    const appDoc = {
      id: `${job.id}_${user.id}`,
      userId: user.id,
      jobId: job.id,
      job: job.title,
      company: job.company,
      logo: job.companyLogo || '💼',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      match: job.match,
      stage: 'Applied',
      status: 'applied'
    }
    try {
      await addApplicantApplication(appDoc)
      setApplied(true)
    } catch (err) {
      console.error('Error applying:', err)
    } finally {
      setApplyLoading(false)
    }
  }

  if (loadingData) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm">Loading job details…</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!job) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-muted-foreground">
          <div className="text-4xl">💼</div>
          <h2 className="text-lg font-semibold text-foreground">Job not found</h2>
          <p className="text-sm">This listing may have been removed or the link is invalid.</p>
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <ArrowLeft size={14} strokeWidth={1.75} /> Browse all jobs
          </button>
        </div>
      </Layout>
    )
  }

  const relatedJobs = jobs.filter(j => j.id !== job.id && j.category === job.category).slice(0, 3)
  const matchColor = job.match >= 90 ? 'text-emerald-400' : job.match >= 80 ? 'text-primary' : 'text-amber-400'
  const matchBg = job.match >= 90 ? 'from-emerald-500/20' : job.match >= 80 ? 'from-primary/20' : 'from-amber-500/20'

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/jobs')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> Back to Jobs
        </button>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="xl:col-span-2 space-y-6">
            {/* Job header */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 border border-border flex items-center justify-center text-3xl flex-shrink-0">
                    {['💳', '🤖', '🎨', '₿', '✈️', '▲', '🍎', '🎬', '☁️', '🔍', '🛍️', '📐'][parseInt(job.id) - 1] || '💼'}
                  </div>
                  <div>
                    <h1 className="text-foreground mb-1" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 700 }}>
                      {job.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <button onClick={() => navigate(`/company/${job.company.toLowerCase()}`)} className="flex items-center gap-1 hover:text-primary transition-colors group"><Building2 size={14} strokeWidth={1.75} className="text-muted-foreground/80 group-hover:text-primary transition-all group-hover:scale-105" /> {job.company}</button>
                      <span className="flex items-center gap-1"><MapPin size={14} strokeWidth={1.75} /> {job.location}</span>
                      <span className="flex items-center gap-1"><Clock size={14} strokeWidth={1.75} /> {job.posted}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={handleToggleSave}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all group/bookmark ${saved ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted'
                      }`}
                  >
                    <Bookmark size={16} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} className={`transition-all duration-200 group-hover/bookmark:scale-110 ${saved ? 'fill-primary' : ''}`} />
                  </button>
                  <button className="w-9 h-9 rounded-xl flex items-center justify-center border border-border text-muted-foreground hover:border-primary/30 hover:bg-muted transition-colors group/share">
                    <Share2 size={16} strokeWidth={1.75} className="transition-transform group-hover/share:scale-110" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-xs font-medium">
                  <Briefcase size={13} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} /> {job.type}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-xs font-medium">
                  <Star size={13} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} /> {job.level}
                </span>
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${job.remote === 'remote' ? 'bg-emerald-500/10 text-emerald-400' :
                  job.remote === 'hybrid' ? 'bg-accent/10 text-accent' :
                    'bg-muted text-muted-foreground'
                  }`}>
                  <Globe size={13} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} /> {job.remote.charAt(0).toUpperCase() + job.remote.slice(1)}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-xs font-medium">
                  <DollarSign size={13} strokeWidth={1.75} /> {job.salary}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-xs font-medium">
                  <Users size={13} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} /> {job.applicants} applicants
                </span>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-2">
                {job.skills.map(skill => (
                  <span key={skill} className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="font-semibold mb-4">About the Role</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">{job.description}</p>

              <h3 className="font-semibold text-sm mb-3">Requirements</h3>
              <ul className="space-y-2 mb-6">
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={15} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary flex-shrink-0 mt-0.5" />
                    {req}
                  </li>
                ))}
              </ul>

              <h3 className="font-semibold text-sm mb-3">Benefits & Perks</h3>
              <ul className="space-y-2">
                {job.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Award size={15} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Company info */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="font-semibold mb-4">About {job.company}</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: 'Industry', value: job.industry },
                  { label: 'Company Size', value: job.companySize },
                  { label: 'Category', value: job.category },
                ].map(info => (
                  <div key={info.label} className="p-3 rounded-xl bg-muted/50 border border-border">
                    <div className="text-xs text-muted-foreground mb-1">{info.label}</div>
                    <div className="text-sm font-medium">{info.value}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {job.company} is a world-class organization in the {job.industry} sector, known for its innovative culture, exceptional engineering standards, and commitment to building products that make a meaningful impact.
              </p>
            </div>

            {/* Related jobs */}
            {relatedJobs.length > 0 && (
              <div>
                <h2 className="font-semibold mb-4">Similar Roles</h2>
                <div className="space-y-3">
                  {relatedJobs.map(rj => (
                    <div
                      key={rj.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all cursor-pointer group"
                      onClick={() => navigate(`/jobs/${rj.id}`)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg flex-shrink-0">
                        {['💳', '🤖', '🎨', '₿', '✈️', '▲', '🍎', '🎬', '☁️', '🔍', '🛍️', '📐'][parseInt(rj.id) - 1] || '💼'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium group-hover:text-primary transition-colors">{rj.title}</div>
                        <div className="text-xs text-muted-foreground">{rj.company} · {rj.salary}</div>
                      </div>
                      {user && user.role !== 'recruiter' && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          <Sparkles size={9} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="animate-pulse" /> {rj.match}%
                        </span>
                      )}
                      <ChevronRight size={16} strokeWidth={1.75} className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Apply card */}
            <div className="sticky top-24 space-y-4">


              <div className="p-5 rounded-2xl bg-card border border-border">
                {user?.role === 'recruiter' ? (
                  <div className="space-y-3">
                    {job.postedBy === user.id ? (
                      <button
                        onClick={() => navigate('/app/recruiter')}
                        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90"
                      >
                        <Users size={16} strokeWidth={1.75} />
                        Manage Applicants
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Recruiters can view job details but cannot apply to roles.
                      </p>
                    )}
                  </div>
                ) : applied ? (
                  <div className="text-center py-4">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
                      <CheckCircle2 size={24} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-emerald-400 animate-bounce" />
                    </div>
                    <h3 className="font-semibold text-emerald-400 mb-1">Application Submitted!</h3>
                    <p className="text-xs text-muted-foreground mb-0">We've sent your AI-optimized application to {job.company}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={user ? handleApply : () => navigate('/auth')}
                      disabled={applyLoading}
                      className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90 disabled:opacity-70 group"
                    >
                      {applyLoading ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Generating AI Application...</span>
                        </>
                      ) : (
                        <>
                          {user ? <><Zap size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" /> Apply with AI</> : 'Sign In to Apply'}
                        </>
                      )}
                    </button>
                    <div className="text-center text-xs text-muted-foreground">
                      AI will craft a personalized cover letter and optimize your application
                    </div>
                  </div>
                )}
              </div>



              {/* Deadline */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <CalendarDays size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-400">Application Deadline</p>
                  <p className="text-xs text-muted-foreground">{job.deadline || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
