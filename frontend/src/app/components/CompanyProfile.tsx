import { useParams, useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { Layout } from './Layout'
import {
  MapPin, Globe, Users, Briefcase, Star, ArrowLeft, Sparkles,
  Building2, ExternalLink, TrendingUp, Award, CheckCircle2,
  ChevronRight, Zap, DollarSign, Clock,
  Twitter, Linkedin, Github, Heart,
} from 'lucide-react'
import { motion } from 'motion/react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export function CompanyProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, jobs, companies, loadingData } = useApp()

  // Match by doc ID (slug) or by company name slug
  const company = companies.find(c =>
    c.id === id ||
    c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === id
  )

  const companyJobs = company
    ? jobs.filter(j => j.company.toLowerCase() === company.name.toLowerCase())
    : []

  if (loadingData) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm">Loading company profile…</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!company) {
    const isUserRecruiter = user?.role === 'recruiter'
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-muted-foreground">
          <div className="text-4xl">🏢</div>
          <h2 className="text-lg font-semibold text-foreground">Company not found</h2>
          <p className="text-sm max-w-sm text-center">
            {isUserRecruiter
              ? "Your company profile page doesn't exist yet or is still loading. You can set up or update your company profile in Settings."
              : "This company page doesn't exist yet. If you're a recruiter, complete your onboarding to create your company profile."}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all"
            >
              <ArrowLeft size={14} strokeWidth={1.75} /> Go back
            </button>
            {isUserRecruiter && (
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
              >
                Go to Settings
              </button>
            )}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> Back
        </button>

        {/* Hero */}
        <div className="relative p-8 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-accent/5 border border-primary/20 overflow-hidden mb-6">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/60 border border-border flex items-center justify-center text-4xl shadow-xl flex-shrink-0">
              {company.logo}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
                <div>
                  <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 800 }}>{company.name}</h1>
                  <p className="text-muted-foreground">{company.tagline}</p>
                </div>

              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1.5"><MapPin size={14} strokeWidth={1.75} /> {company.location}</span>
                <span className="flex items-center gap-1.5"><Users size={14} strokeWidth={1.75} /> {company.size} employees</span>
                <span className="flex items-center gap-1.5"><Building2 size={14} strokeWidth={1.75} /> {company.industry}</span>
                <span className="flex items-center gap-1.5"><Award size={14} strokeWidth={1.75} /> Founded {company.founded}</span>
                <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                  <Globe size={14} strokeWidth={1.75} /> {company.website}
                </a>
              </div>
              <div className="flex gap-3">

                <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors group/visit">
                  <ExternalLink size={16} strokeWidth={1.75} className="transition-transform group-hover/visit:scale-105" /> Visit Website
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <div className="p-5 rounded-2xl bg-card border border-border">
              <h2 className="font-semibold mb-3">About {company.name}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{company.description}</p>
            </div>

            {/* Team photos — only show if photos exist */}
            {(company as any).teamPhotos?.length > 0 && (
              <div className="p-5 rounded-2xl bg-card border border-border">
                <h2 className="font-semibold mb-4">Life at {company.name}</h2>
                <div className="grid grid-cols-3 gap-3">
                  {(company as any).teamPhotos.map((photo: string, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="aspect-video rounded-xl overflow-hidden"
                    >
                      <img src={photo} alt={`${company.name} team`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Headcount growth */}
            {(company as any).growthData?.length > 0 && (
              <div className="p-5 rounded-2xl bg-card border border-border group/growth">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} strokeWidth={1.75} className="text-emerald-400 transition-transform duration-300 group-hover/growth:translate-x-0.5 group-hover/growth:-translate-y-0.5" />
                  <h2 className="font-semibold">Team Growth</h2>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={(company as any).growthData}>
                    <defs>
                      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8b92b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#8b92b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0c1023', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="headcount" stroke="#6366f1" fill="url(#growthGrad)" strokeWidth={2} name="Headcount" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Open roles */}
            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Briefcase size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary animate-pulse" />
                  Open Roles at {company.name}
                </h2>
                <span className="text-xs text-muted-foreground">{companyJobs.length} open</span>
              </div>
              <div className="space-y-3">
                {(companyJobs.length > 0 ? companyJobs : []).map(job => (
                  <div
                    key={job.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/20 hover:bg-muted/50 transition-all cursor-pointer group"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium group-hover:text-primary transition-colors">{job.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1"><MapPin size={10} strokeWidth={1.75} /> {job.location}</span>
                        <span className="flex items-center gap-1"><DollarSign size={10} strokeWidth={1.75} /> {job.salary}</span>
                        <span className="flex items-center gap-1"><Clock size={10} strokeWidth={1.75} /> {job.posted}</span>
                      </div>
                    </div>
                    {user && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        <Sparkles size={9} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="animate-pulse" /> {job.match}%
                      </span>
                    )}
                    <ChevronRight size={14} strokeWidth={1.75} className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                ))}
                {companyJobs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No open roles listed yet.</p>
                )}
              </div>
              <button
                onClick={() => navigate('/jobs')}
                className="w-full mt-3 py-2 text-xs text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
              >
                View all open roles →
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Culture */}
            {company.culture?.length > 0 && (
              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2 group/culture">
                  <Zap size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary transition-transform group-hover/culture:scale-110" />
                  Culture & Values
                </h3>
                <div className="space-y-2">
                  {company.culture.map(value => (
                    <div key={value} className="flex items-center gap-2">
                      <CheckCircle2 size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Benefits */}
            {company.benefits?.length > 0 && (
              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2 group/benefits">
                  <Award size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-amber-400 transition-transform group-hover/benefits:scale-110" />
                  Benefits
                </h3>
                <div className="space-y-2">
                  {company.benefits.map(benefit => (
                    <div key={benefit} className="flex items-center gap-2">
                      <CheckCircle2 size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Perks */}
            {company.perks?.length > 0 && (
              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="font-semibold text-sm mb-4">Perks & Offerings</h3>
                <div className="grid grid-cols-2 gap-2">
                  {company.perks.map(perk => (
                    <div key={perk.label} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border">
                      <span>{perk.icon}</span>
                      <span className="text-xs font-medium">{perk.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tech stack */}
            {company.techStack?.length > 0 && (
              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="font-semibold text-sm mb-4">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {company.techStack.map(tech => (
                    <span key={tech} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Social */}
            <div className="p-5 rounded-2xl bg-card border border-border">
              <h3 className="font-semibold text-sm mb-3">Social</h3>
              <div className="flex gap-3">
                {[
                  { icon: Twitter, label: 'Twitter' },
                  { icon: Linkedin, label: 'LinkedIn' },
                  { icon: Github, label: 'GitHub' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all text-xs group"
                  >
                    <Icon size={15} strokeWidth={1.75} className="transition-transform group-hover:scale-110" /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
