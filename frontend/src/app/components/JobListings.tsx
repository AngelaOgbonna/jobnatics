import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useApp } from '../context/AppContext'
import { toast } from 'sonner'
import { Layout } from './Layout'
import {
  Search, Filter, MapPin, DollarSign, Clock, Sparkles, Briefcase,
  Bookmark, ArrowUpRight, SlidersHorizontal, ChevronDown, X,
  Star, Zap, Globe, Building2,
} from 'lucide-react'
import { motion } from 'motion/react'
import { calculateJobMatchScore } from '../data/mockData'
const categories = ['All', 'Engineering', 'Design', 'Product', 'AI/ML', 'Data Science', 'DevOps', 'Security', 'Research', 'Mobile']
const remoteOptions = ['All', 'Remote', 'Hybrid', 'On-site']
const levelOptions = ['All', 'Entry', 'Mid', 'Senior', 'Lead', 'Executive']
const typeOptions = ['All', 'Full-time', 'Part-time', 'Contract', 'Internship']

function MatchBadge({ match }: { match: number }) {
  const color = match >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : match >= 80 ? 'bg-primary/10 text-primary border-primary/20'
    : match >= 70 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-muted text-muted-foreground border-border'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      <Sparkles size={10} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="animate-pulse" /> {match}% Match
    </span>
  )
}

export function JobListings() {
  const navigate = useNavigate()
  const { user, jobs, addApplicantApplication, aiMatchScores } = useApp()
  const [searchParams] = useSearchParams()
  const filterParam = searchParams.get('filter')

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeRemote, setActiveRemote] = useState('All')
  const [activeLevel, setActiveLevel] = useState('All')
  const [sortBy, setSortBy] = useState<'match' | 'date' | 'salary'>('match')
  const [showFilters, setShowFilters] = useState(false)

  const [savedJobs, setSavedJobs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(user ? `jobnatics_saved_jobs_${user.id}` : 'jobnatics_saved_jobs_guest')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    try {
      const applied = localStorage.getItem(user ? `jobnatics_applied_jobs_${user.id}` : 'jobnatics_applied_jobs_guest')
      return applied ? JSON.parse(applied) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (user?.role === 'recruiter' && sortBy === 'match') {
      setSortBy('date')
    }
  }, [user?.role, sortBy])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(user ? `jobnatics_saved_jobs_${user.id}` : 'jobnatics_saved_jobs_guest')
      setSavedJobs(saved ? JSON.parse(saved) : [])
      const applied = localStorage.getItem(user ? `jobnatics_applied_jobs_${user.id}` : 'jobnatics_applied_jobs_guest')
      setAppliedJobs(applied ? JSON.parse(applied) : [])
    } catch {
      setSavedJobs([])
      setAppliedJobs([])
    }
  }, [user])

  const jobsWithMatches = useMemo(() => {
    if (!user || user.role === 'recruiter') return jobs
    return jobs.map(j => ({
      ...j,
      match: calculateJobMatchScore(user.skills, j.skills, j.id, j.title, j.company, aiMatchScores)
    }))
  }, [jobs, user, aiMatchScores])

  const filtered = useMemo(() => {
    return jobsWithMatches
      .filter(j => {
        if (user && user.role === 'recruiter') {
          if (j.postedBy !== user.id) return false
        }
        if (filterParam === 'saved' && !savedJobs.includes(j.id)) return false

        const matchesSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.company.toLowerCase().includes(search.toLowerCase()) || j.skills.some(s => s.toLowerCase().includes(search.toLowerCase()))
        const matchesCat = activeCategory === 'All' || j.category === activeCategory
        const matchesRemote = activeRemote === 'All' || j.remote.toLowerCase() === activeRemote.toLowerCase().replace('-', '').replace(' ', '')
        const matchesLevel = activeLevel === 'All' || j.level === activeLevel
        return matchesSearch && matchesCat && matchesRemote && matchesLevel
      })
      .sort((a, b) => {
        if (sortBy === 'match') return b.match - a.match
        if (sortBy === 'salary') return b.salaryMax - a.salaryMax
        return 0
      })
  }, [jobsWithMatches, user, search, activeCategory, activeRemote, activeLevel, sortBy, filterParam, savedJobs])

  const toggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSavedJobs(prev => {
      const updated = prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]
      localStorage.setItem(user ? `jobnatics_saved_jobs_${user.id}` : 'jobnatics_saved_jobs_guest', JSON.stringify(updated))
      return updated
    })
  }

  const handleApply = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      navigate('/auth')
      return
    }
    if (user.role === 'recruiter') return

    const job = jobsWithMatches.find(j => j.id === id)
    if (!job) return

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
      setAppliedJobs(prev => {
        if (prev.includes(id)) return prev
        const updated = [...prev, id]
        localStorage.setItem(`jobnatics_applied_jobs_${user.id}`, JSON.stringify(updated))
        return updated
      })
      toast.success(`Successfully applied to ${job.title}!`)
    } catch (err) {
      console.error('Error applying to job:', err)
      toast.error('Failed to submit application.')
    }
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-1" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700 }}>
            {filterParam === 'saved' ? (
              <span>Your Saved Jobs <span className="text-primary">({filtered.length})</span></span>
            ) : user?.role === 'recruiter' ? (
              <span>Your Job Postings <span className="text-primary">({filtered.length})</span></span>
            ) : user ? (
              <span>Your AI-Matched Jobs <span className="text-primary">({filtered.length})</span></span>
            ) : (
              'Explore Jobs'
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {filterParam === 'saved'
              ? 'Keep track of positions you have bookmarked'
              : user?.role === 'recruiter'
              ? 'Manage, update, and track your active job listings'
              : user
              ? 'Ranked by AI match score based on your skills, experience, and career goals'
              : 'Find your next opportunity from thousands of vetted companies'
            }
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search jobs, companies, skills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all font-medium text-sm ${
              showFilters ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-card border-border hover:border-primary/30'
            }`}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'match' | 'date' | 'salary')}
            className="px-4 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary transition-all cursor-pointer"
          >
            {user?.role !== 'recruiter' && <option value="match">Sort: Best Match</option>}
            <option value="salary">Sort: Highest Salary</option>
            <option value="date">Sort: Most Recent</option>
          </select>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-card border border-border"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Work Style</label>
                <div className="flex flex-wrap gap-2">
                  {remoteOptions.map(o => (
                    <button
                      key={o}
                      onClick={() => setActiveRemote(o)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeRemote === o ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Level</label>
                <div className="flex flex-wrap gap-2">
                  {levelOptions.map(o => (
                    <button
                      key={o}
                      onClick={() => setActiveLevel(o)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeLevel === o ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Active Filters</label>
                <div className="flex flex-wrap gap-2">
                  {[activeCategory !== 'All' && activeCategory, activeRemote !== 'All' && activeRemote, activeLevel !== 'All' && activeLevel].filter(Boolean).map(f => (
                    <span key={f as string} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs border border-primary/20">
                      {f}
                      <X size={10} className="cursor-pointer" />
                    </span>
                  ))}
                  {activeCategory === 'All' && activeRemote === 'All' && activeLevel === 'All' && (
                    <span className="text-xs text-muted-foreground">No active filters</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> jobs
            {user && user.role !== 'recruiter' && ` · Ranked by AI match score`}
          </span>
          {user && user.role !== 'recruiter' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              AI matching active
            </div>
          )}
        </div>

        {/* Jobs grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group relative p-5 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer"
              onClick={() => navigate(`/jobs/${job.id}`)}
            >
              {job.featured && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium">
                  <Star size={10} className="fill-amber-400" /> Featured
                </div>
              )}
              {job.urgent && !job.featured && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium">
                  <Zap size={10} /> Urgent
                </div>
              )}

              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-muted to-muted/50 border border-border flex items-center justify-center text-xl flex-shrink-0">
                  {['💳', '🤖', '🎨', '₿', '✈️', '▲', '🍎', '🎬', '☁️', '🔍', '🛍️', '📐'][parseInt(job.id) - 1] || '💼'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-tight mb-0.5 truncate">
                    {job.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">{job.company}</p>
                </div>
              </div>

              {user && user.role !== 'recruiter' && (
                <div className="mb-3">
                  <MatchBadge match={job.match} />
                </div>
              )}

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin size={11} strokeWidth={1.75} className="text-muted-foreground/60" /> {job.location}
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${
                    job.remote === 'remote' ? 'text-emerald-400 bg-emerald-500/10' :
                    job.remote === 'hybrid' ? 'text-accent bg-accent/10' :
                    'text-muted-foreground bg-muted'
                  }`}>
                    {job.remote.charAt(0).toUpperCase() + job.remote.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DollarSign size={11} strokeWidth={1.75} className="text-muted-foreground/60" /> {job.salary}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase size={11} strokeWidth={1.75} className="text-muted-foreground/60" /> {job.type} · {job.level}
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={10} strokeWidth={1.75} className="text-muted-foreground/60" /> {job.posted}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {job.skills.slice(0, 3).map(skill => (
                  <span key={skill} className="text-xs px-2 py-0.5 rounded-md bg-muted border border-border text-muted-foreground">
                    {skill}
                  </span>
                ))}
                {job.skills.length > 3 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-muted border border-border text-muted-foreground">
                    +{job.skills.length - 3}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border">
                {user?.role === 'recruiter' ? (
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20 hover:scale-[1.01] text-center"
                  >
                    View Details & Applicants
                  </button>
                ) : (
                  <>
                    <button
                      onClick={e => handleApply(job.id, e)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200 group/apply ${
                        appliedJobs.includes(job.id)
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20 hover:scale-[1.01]'
                      }`}
                    >
                      {appliedJobs.includes(job.id) ? 'Applied' : user ? '⚡ AI Apply' : 'Apply Now'}
                    </button>
                    <button
                      onClick={e => toggleSave(job.id, e)}
                      className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 flex-shrink-0 group/bookmark"
                    >
                      <Bookmark size={14} strokeWidth={1.75} fill={savedJobs.includes(job.id) ? 'currentColor' : 'none'} className={`transition-all duration-200 group-hover/bookmark:scale-110 ${savedJobs.includes(job.id) ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground border border-border hover:border-primary/30 hover:text-primary transition-colors"
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </>
                )}
              </div>

              <div className="text-xs text-muted-foreground mt-2 text-center">
                {job.applicants} applicants
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <Search size={24} className="text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No jobs found</h3>
            {user?.role === 'recruiter' && jobs.filter(j => j.postedBy === user.id).length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">You haven't posted any job openings yet.</p>
                <button
                  onClick={() => navigate('/post-job')}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Post a New Job
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or search terms</p>
                <button
                  onClick={() => { setSearch(''); setActiveCategory('All'); setActiveRemote('All'); setActiveLevel('All') }}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Clear All Filters
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
