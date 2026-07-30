import { useParams, useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { Layout } from './Layout'
import {
  MapPin, Briefcase, GraduationCap, Star, Sparkles,
  Calendar, ArrowLeft, ExternalLink, Award, TrendingUp, CheckCircle2,
  Brain, Target, Clock, Users, Globe, Github, Linkedin,
} from 'lucide-react'
import { useState } from 'react'
import { motion } from 'motion/react'

const stageColors: Record<string, string> = {
  applied: 'text-muted-foreground bg-muted border-border',
  screening: 'text-accent bg-accent/15 border-accent/30',
  interview: 'text-primary bg-primary/15 border-primary/30',
  offer: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  hired: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40',
  rejected: 'text-red-400 bg-red-500/15 border-red-500/30',
}

const stageLabels: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer Sent',
  hired: 'Hired',
  rejected: 'Rejected',
}

export function CandidateProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, candidates, jobs, applicantApplications, loadingData, allUsers } = useApp()
  const [activeTab, setActiveTab] = useState<'overview' | 'experience' | 'ai'>('overview')
  const [stageOverride, setStageOverride] = useState<string | null>(null)

  const stages = ['applied', 'screening', 'interview', 'offer', 'hired']

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm">Loading profile…</p>
          </div>
        </div>
      </Layout>
    )
  }

  // ── Resolve profile source ─────────────────────────────────────────────────
  // If the route ID is the current user's ID (or the user is an applicant
  // viewing their own profile), build from the `user` Firestore object.
  const isOwnProfile = user && (id === user.id || user.role === 'applicant')

  // Normalise everything into a single "profile" shape for rendering
  let profile: {
    name: string
    title: string
    location: string
    avatar: string
    bio: string
    skills: string[]
    experience: number
    education: string
    status: string
    aiScore: number
    stage: string
    appliedDate: string
    achievements: string[]
    jobId?: string
    // user-only fields
    website?: string
    linkedin?: string
    github?: string
    workStyle?: string
    roleLevel?: string
    salaryRange?: string
  } | null = null

  if (isOwnProfile && user) {
    // Build from real user profile data stored in Firestore `users` collection
    const userSkills = user.title
      ? [user.title.split(' ')[0], ...(user.roleLevel ? [user.roleLevel] : []), ...(user.workStyle ? [user.workStyle] : [])]
      : []

    profile = {
      name: user.name,
      title: user.title || 'Professional',
      location: user.location || '',
      avatar: user.avatar,
      bio: user.bio || '',
      skills: userSkills.filter(Boolean),
      experience: 0, // not stored on user object; show role level instead
      education: '',
      status: 'Available',
      aiScore: 0,
      stage: applicantApplications[0]?.status || 'applied',
      appliedDate: applicantApplications[0]?.date
        ? new Date().toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      achievements: [],
      website: user.website,
      linkedin: user.linkedin,
      github: user.github,
      workStyle: user.workStyle,
      roleLevel: user.roleLevel,
      salaryRange: user.salaryRange,
    }
  } else {
    const candidate = candidates.find(c => c.id === id)
    const profileUser = allUsers.find(u => u.id === id)

    if (candidate) {
      profile = {
        name: candidate.name,
        title: candidate.title,
        location: candidate.location,
        avatar: candidate.avatar,
        bio: candidate.bio,
        skills: candidate.skills,
        experience: candidate.experience,
        education: candidate.education,
        status: candidate.status,
        aiScore: candidate.aiScore,
        stage: candidate.stage,
        appliedDate: candidate.appliedDate,
        achievements: candidate.achievements,
        jobId: candidate.jobId,
      }
    } else if (profileUser) {
      const userSkills = profileUser.title
        ? [profileUser.title.split(' ')[0], ...(profileUser.roleLevel ? [profileUser.roleLevel] : []), ...(profileUser.workStyle ? [profileUser.workStyle] : [])]
        : []
      const userApplication = applicantApplications.find(a => a.userId === profileUser.id)

      profile = {
        name: profileUser.name,
        title: profileUser.title || 'Professional',
        location: profileUser.location || '',
        avatar: profileUser.avatar,
        bio: profileUser.bio || '',
        skills: userSkills.filter(Boolean),
        experience: 0,
        education: '',
        status: 'Available',
        aiScore: 0,
        stage: userApplication?.status || 'applied',
        appliedDate: userApplication?.date
          ? new Date(userApplication.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        achievements: [],
        website: profileUser.website,
        linkedin: profileUser.linkedin,
        github: profileUser.github,
        workStyle: profileUser.workStyle,
        roleLevel: profileUser.roleLevel,
        salaryRange: profileUser.salaryRange,
      }
    } else {
      return (
        <Layout>
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-muted-foreground">
            <div className="text-4xl">🔍</div>
            <h2 className="text-lg font-semibold text-foreground">Candidate not found</h2>
            <p className="text-sm">This candidate may have been removed or the link is invalid.</p>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
            >
              <ArrowLeft size={14} strokeWidth={1.75} /> Go back
            </button>
          </div>
        </Layout>
      )
    }
  }

  if (!profile) return null

  // ── Derived state ──────────────────────────────────────────────────────────
  const appliedJob = profile.jobId ? jobs.find(j => j.id === profile!.jobId) : null
  const currentStage = stageOverride || profile.stage
  const base = profile.aiScore || 75
  const aiMatchBreakdown = [
    { label: 'Skills Match', score: Math.min(base + 3, 100) },
    { label: 'Experience Level', score: Math.max(base - 1, 60) },
    { label: 'Education Fit', score: Math.max(base - 5, 60) },
    { label: 'Culture Alignment', score: Math.max(base - 8, 60) },
    { label: 'Communication', score: Math.max(base - 3, 60) },
    { label: 'Growth Potential', score: Math.min(base + 1, 100) },
  ]
  const profileTabs = user?.role === 'recruiter'
    ? (['overview', 'experience'] as const)
    : (['overview', 'experience', 'ai'] as const)

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> Back
        </button>

        {/* Profile header */}
        <div className="p-6 rounded-2xl bg-card border border-border mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="relative">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-primary/20"
              />
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card flex items-center justify-center ${
                profile.status === 'Available' ? 'bg-emerald-400' :
                profile.status === 'Open to offers' ? 'bg-amber-400' : 'bg-muted-foreground'
              }`} />
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div>
                  <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 700 }}>{profile.name}</h1>
                  <p className="text-muted-foreground">{profile.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isOwnProfile && profile.roleLevel && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border bg-primary/10 text-primary border-primary/20">
                      {profile.roleLevel}
                    </span>
                  )}
                  {!isOwnProfile && user?.role !== 'recruiter' && profile.aiScore > 0 && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${
                      profile.aiScore >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      profile.aiScore >= 80 ? 'bg-primary/10 text-primary border-primary/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      <Sparkles size={13} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="animate-pulse" /> {profile.aiScore}% AI Score
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                {profile.location && (
                  <span className="flex items-center gap-1.5"><MapPin size={14} strokeWidth={1.75} /> {profile.location}</span>
                )}
                {profile.experience > 0 && (
                  <span className="flex items-center gap-1.5"><Briefcase size={14} strokeWidth={1.75} /> {profile.experience} years experience</span>
                )}
                {profile.roleLevel && (
                  <span className="flex items-center gap-1.5"><Star size={14} strokeWidth={1.75} /> {profile.roleLevel}</span>
                )}
                {profile.workStyle && (
                  <span className="flex items-center gap-1.5"><Users size={14} strokeWidth={1.75} /> {profile.workStyle}</span>
                )}
                {profile.education && (
                  <span className="flex items-center gap-1.5"><GraduationCap size={14} strokeWidth={1.75} /> {profile.education}</span>
                )}
                {profile.salaryRange && (
                  <span className="flex items-center gap-1.5"><Briefcase size={14} strokeWidth={1.75} /> {profile.salaryRange}</span>
                )}
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400' :
                  profile.status === 'Open to offers' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {profile.status}
                </span>
              </div>

              {/* Skills */}
              {profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {profile.skills.map(skill => (
                    <span key={skill} className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {/* Links — own profile */}
              {isOwnProfile && (profile.website || profile.linkedin || profile.github) && (
                <div className="flex gap-3 mb-4">
                  {profile.website && (
                    <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Globe size={13} strokeWidth={1.75} /> {profile.website}
                    </a>
                  )}
                  {profile.linkedin && (
                    <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Linkedin size={13} strokeWidth={1.75} /> LinkedIn
                    </a>
                  )}
                  {profile.github && (
                    <a href={profile.github.startsWith('http') ? profile.github : `https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Github size={13} strokeWidth={1.75} /> GitHub
                    </a>
                  )}
                </div>
              )}

              {/* Recruiter actions */}
              {user?.role === 'recruiter' && (
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors group/cal">
                    <Calendar size={16} strokeWidth={1.75} className="transition-transform group-hover/cal:scale-105" /> Schedule Interview
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors group/port">
                    <ExternalLink size={16} strokeWidth={1.75} className="transition-transform group-hover/port:scale-105" /> View Portfolio
                  </button>
                </div>
              )}

              {/* Applicant quick action */}
              {isOwnProfile && (
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
                >
                  <ExternalLink size={14} strokeWidth={1.75} /> Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline stage (recruiters only) */}
        {user?.role === 'recruiter' && (
          <div className="p-5 rounded-2xl bg-card border border-border mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Target size={16} className="text-primary" />
                Pipeline Stage
              </h3>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${stageColors[currentStage]}`}>
                {stageLabels[currentStage]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {stages.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => setStageOverride(s)}
                    className={`w-full h-2 rounded-full transition-all ${
                      stages.indexOf(currentStage) >= i
                        ? 'bg-primary'
                        : 'bg-muted hover:bg-muted-foreground/30'
                    }`}
                  />
                  <span className="text-xs text-muted-foreground capitalize hidden sm:block">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-muted rounded-xl w-fit">
          {profileTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'ai' ? '🤖 AI Analysis' : tab}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Bio / About */}
              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="font-semibold mb-3">About</h3>
                {profile.bio ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No bio added yet.{isOwnProfile ? ' Add one in Settings → AI Profile.' : ''}
                  </p>
                )}
              </div>

              {/* Achievements (candidates from recruiter pipeline) */}
              {profile.achievements && profile.achievements.length > 0 && (
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 group/title">
                    <Award size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-amber-400 transition-transform group-hover/title:scale-110" /> Key Achievements
                  </h3>
                  <ul className="space-y-2">
                    {profile.achievements.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 size={15} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Applied-for job */}
              {appliedJob && (
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <h3 className="font-semibold mb-3">Applied For</h3>
                  <div
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border hover:border-primary/20 transition-all cursor-pointer group"
                    onClick={() => navigate(`/jobs/${appliedJob.id}`)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                      {['💳', '🤖', '🎨', '₿', '✈️'][parseInt(appliedJob.id) - 1] || '💼'}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium group-hover:text-primary transition-colors">{appliedJob.title}</div>
                      <div className="text-xs text-muted-foreground">{appliedJob.company} · {appliedJob.salary}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                      {appliedJob.match}% match
                    </span>
                  </div>
                </div>
              )}

              {/* Applications summary for own profile */}
              {isOwnProfile && applicantApplications.length > 0 && (
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Briefcase size={15} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary" /> My Applications
                  </h3>
                  <div className="space-y-2">
                    {applicantApplications.slice(0, 4).map((app: any) => (
                      <div key={app.id} className="flex items-center justify-between text-sm py-2 border-b border-border/40 last:border-0">
                        <div>
                          <div className="font-medium">{app.job}</div>
                          <div className="text-xs text-muted-foreground">{app.company} · {app.date}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          app.status === 'interview' ? 'bg-primary/10 text-primary border-primary/20' :
                          app.status === 'offer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          app.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>
                          {app.stage}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5">
              {/* Quick stats */}
              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="font-semibold text-sm mb-3">Quick Stats</h3>
                <div className="space-y-3">
                  {[
                    profile.roleLevel && { label: 'Level', value: profile.roleLevel, icon: Star },
                    profile.workStyle && { label: 'Work Style', value: profile.workStyle, icon: Users },
                    profile.salaryRange && { label: 'Salary Target', value: profile.salaryRange, icon: Briefcase },
                    !isOwnProfile && user?.role !== 'recruiter' && profile.experience > 0 && { label: 'Experience', value: `${profile.experience} yrs`, icon: Briefcase },
                    !isOwnProfile && user?.role !== 'recruiter' && profile.aiScore > 0 && { label: 'AI Score', value: `${profile.aiScore}/100`, icon: Sparkles },
                    !isOwnProfile && { label: 'Applied', value: new Date(profile.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), icon: Clock },
                    !isOwnProfile && { label: 'Status', value: profile.status, icon: Users },
                    isOwnProfile && { label: 'Applications', value: String(applicantApplications.length), icon: Briefcase },
                  ].filter(Boolean).map((stat: any) => {
                    const Icon = stat.icon
                    return (
                      <div key={stat.label} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Icon size={14} strokeWidth={1.75} className="transition-transform group-hover:scale-110" />
                          {stat.label}
                        </div>
                        <span className="text-sm font-medium">{stat.value}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Skills sidebar */}
              {profile.skills.length > 0 && (
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <h3 className="font-semibold text-sm mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map(skill => (
                      <span key={skill} className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Experience tab */}
        {activeTab === 'experience' && (
          <div className="space-y-4">
            {((): { role: string; company: string; period: string; desc: string; skills: string[] }[] => {
              const exp = profile!.experience || 3
              const currentYear = new Date().getFullYear()
              const entries = []
              if (exp >= 1) {
                entries.push({
                  role: profile!.title,
                  company: profile!.location ? `Company in ${profile!.location}` : 'Current Employer',
                  period: `${currentYear - Math.min(exp, 3)}–Present`,
                  desc: `${profile!.bio ? profile!.bio.split('.')[0] + '.' : `Working as ${profile!.title} with a focus on delivering high-quality solutions.`}`,
                  skills: profile!.skills.slice(0, 3),
                })
              }
              if (exp >= 3) {
                entries.push({
                  role: exp >= 6 ? 'Senior Engineer' : 'Software Engineer',
                  company: 'Previous Employer',
                  period: `${currentYear - exp}–${currentYear - Math.min(exp, 3)}`,
                  desc: `Built and maintained core product features, contributing to ${profile!.skills[0] || 'engineering'} initiatives across the platform.`,
                  skills: profile!.skills.slice(1, 4),
                })
              }
              if (exp >= 6) {
                entries.push({
                  role: 'Junior / Mid-level Engineer',
                  company: 'Early Career',
                  period: `${currentYear - exp}–${currentYear - exp + 2}`,
                  desc: `Started career building ${profile!.skills.slice(-2).join(' and ')} expertise through client projects and internal tooling.`,
                  skills: profile!.skills.slice(-2),
                })
              }
              if (entries.length === 0) {
                entries.push({
                  role: profile!.title || 'Professional',
                  company: 'Current Employer',
                  period: `${currentYear - 1}–Present`,
                  desc: profile!.bio || `Working as ${profile!.title || 'a professional'}.`,
                  skills: profile!.skills.slice(0, 3),
                })
              }
              return entries
            })().map((exp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-2xl bg-card border border-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{exp.role}</h3>
                    <p className="text-sm text-muted-foreground">{exp.company}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{exp.period}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{exp.desc}</p>
                {exp.skills.length > 0 && (
                  <div className="flex gap-2">
                    {exp.skills.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">{s}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* AI Analysis tab */}
        {activeTab === 'ai' && user?.role !== 'recruiter' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Brain size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary animate-pulse" />
                <h3 className="font-semibold text-sm">AI Match Breakdown</h3>
              </div>
              <div className="space-y-3">
                {aiMatchBreakdown.map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.score}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.score}%` }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-accent animate-pulse" />
                <h3 className="font-semibold text-sm">AI-Generated Summary</h3>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="leading-relaxed">
                  <strong className="text-foreground">{profile.name}</strong>{' '}
                  {isOwnProfile
                    ? `has a ${profile.roleLevel || 'growing'} profile with ${profile.workStyle || 'flexible'} work preferences. ${profile.bio ? profile.bio.split('.')[0] + '.' : 'Complete your profile to get better AI match results.'}`
                    : `is an exceptional candidate with a rare combination of deep technical expertise and demonstrated leadership ability. Their ${profile.experience}-year track record shows consistent growth and impact.`
                  }
                </p>
                {!isOwnProfile && profile.skills.length > 0 && (
                  <p className="leading-relaxed">
                    Their skills in {profile.skills.slice(0, 3).join(', ')} directly align with open requirements. The AI predicts a <strong className="text-emerald-400">{profile.aiScore}% probability of success</strong> based on skill alignment, experience trajectory, and historical performance patterns.
                  </p>
                )}
                {isOwnProfile && (
                  <p className="leading-relaxed">
                    {profile.github ? '✅ GitHub linked — +30% interview invite rate.' : '⚠️ Link your GitHub in Settings to boost recruiter visibility.'}
                    {' '}
                    {profile.bio && profile.bio.length > 30 ? '✅ Bio is set — AI can match you to niche roles.' : '⚠️ Add a detailed bio to improve AI match accuracy.'}
                  </p>
                )}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 group/rec">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={12} strokeWidth={1.75} className="text-primary transition-transform group-hover/rec:translate-x-0.5 group-hover/rec:-translate-y-0.5" />
                    <span className="text-xs font-medium text-primary">AI Recommendation</span>
                  </div>
                  <p className="text-xs">
                    {isOwnProfile
                      ? `Based on your ${profile.roleLevel || 'current'} level and ${profile.workStyle || 'preferred'} work style, focus on roles that match both criteria for highest success rate.`
                      : 'High priority candidate. Recommend fast-tracking to interview stage to prevent competing offer loss.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
