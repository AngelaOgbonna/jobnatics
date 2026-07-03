import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import {
  Zap, Sparkles, Brain, Target, Users, BarChart3, MessageSquare,
  CheckCircle2, ArrowRight, Star, Moon, Sun, ChevronRight,
  Briefcase, TrendingUp, Shield, Globe, Award, Rocket,
  Play, Menu, X, Building2,
} from 'lucide-react'
import { motion } from 'motion/react'

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Matching',
    description: 'Our semantic matching engine analyzes 200+ signals to pair candidates with the perfect opportunities, achieving 94% placement accuracy.',
    color: 'from-indigo-500 to-violet-500',
    glow: 'shadow-indigo-500/20',
  },
  {
    icon: Target,
    title: 'Match Score Ranking',
    description: 'Every job and candidate gets an AI match score. Recruiters see ranked applicants, candidates see ranked opportunities — no more guessing.',
    color: 'from-cyan-500 to-blue-500',
    glow: 'shadow-cyan-500/20',
  },
  {
    icon: Sparkles,
    title: 'Resume Intelligence',
    description: 'Upload your resume and our AI extracts skills, quantifies achievements, identifies gaps, and generates tailored improvement suggestions.',
    color: 'from-purple-500 to-pink-500',
    glow: 'shadow-purple-500/20',
  },
  {
    icon: MessageSquare,
    title: 'AI Interview Coach',
    description: 'Practice with our AI interviewer trained on thousands of real interview transcripts. Get instant feedback and personalized prep plans.',
    color: 'from-emerald-500 to-teal-500',
    glow: 'shadow-emerald-500/20',
  },
  {
    icon: BarChart3,
    title: 'Hiring Analytics',
    description: 'Deep insights into your pipeline. Track conversion rates, identify bottlenecks, benchmark against industry standards, and forecast hiring.',
    color: 'from-orange-500 to-amber-500',
    glow: 'shadow-orange-500/20',
  },
  {
    icon: Shield,
    title: 'Bias-Free Screening',
    description: 'Our AI is designed to evaluate candidates on merit, skills, and fit — not demographics. Build diverse, high-performing teams with confidence.',
    color: 'from-rose-500 to-red-500',
    glow: 'shadow-rose-500/20',
  },
]

const steps = [
  { role: 'applicant', step: '01', title: 'Upload Your Resume', desc: 'Our AI parses your CV, extracts skills, and builds your intelligent profile in seconds.' },
  { role: 'applicant', step: '02', title: 'Get AI-Ranked Jobs', desc: 'See a personalized feed ranked by match %. The top opportunities rise to the surface automatically.' },
  { role: 'applicant', step: '03', title: 'Apply & Track', desc: 'One-click applications with AI-generated cover letters. Track every application in your dashboard.' },
  { role: 'recruiter', step: '01', title: 'Post Your Job', desc: 'Use AI to generate compelling job descriptions. Set your ideal candidate parameters.' },
  { role: 'recruiter', step: '02', title: 'AI Ranks Applicants', desc: 'Every applicant gets scored and ranked. Your shortlist is ready before you even open your inbox.' },
  { role: 'recruiter', step: '03', title: 'Interview & Hire', desc: 'Schedule interviews, collaborate with your team, and close the best candidates fast.' },
]

const testimonials = [
  {
    name: 'Priya Sharma',
    title: 'Engineering Manager at Stripe',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face',
    quote: 'We hired our entire frontend team in 3 weeks using Jobnatics AI. The match quality was incredible — 9 of 10 hires are still with us 18 months later.',
    rating: 5,
  },
  {
    name: 'Marcus Chen',
    title: 'Senior SWE, hired at OpenAI',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
    quote: "The AI knew exactly what roles fit my background. I had 4 interviews in my first week and an offer from OpenAI within 3 weeks. It's like having a personal recruiter who actually knows tech.",
    rating: 5,
  },
  {
    name: 'Sarah Kim',
    title: 'Head of Talent at Vercel',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face',
    quote: "Our time-to-hire dropped from 47 days to 18. The AI shortlist saves us 15+ hours per role, and the candidates it surfaces consistently outperform LinkedIn sourcing.",
    rating: 5,
  },
]

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with AI-powered job matching',
    features: ['AI match scores on 10 jobs/month', 'Basic profile analysis', 'Application tracking', 'Job search & filtering', 'Community support'],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For serious job seekers and growing teams',
    features: ['Unlimited AI job matching', 'Full resume intelligence', 'AI cover letter generator', 'Interview prep assistant', 'Priority in recruiter searches', 'Real-time notifications', 'Analytics dashboard', 'Priority support'],
    cta: 'Start 14-day Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Built for teams hiring at scale',
    features: ['Unlimited job postings', 'Full candidate ranking AI', 'Custom ATS integration', 'Bias detection & reporting', 'Dedicated success manager', 'API access', 'SSO/SAML', 'SLA guarantee'],
    cta: 'Contact Sales',
    highlight: false,
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const { darkMode, toggleDarkMode } = useApp()
  const [activeRole, setActiveRole] = useState<'applicant' | 'recruiter'>('applicant')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleGetStarted = (role?: 'recruiter') => {
    navigate(role ? '/auth?role=recruiter' : '/auth')
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/90 backdrop-blur-xl border-b border-border shadow-lg' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-105">
              <Zap size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="text-white transition-transform duration-300 group-hover:rotate-12" />
            </div>
            <span className="font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Jobnatics <span className="text-primary">AI</span>
            </span>
          </div>

          {/* <div className="hidden md:flex items-center gap-8">
            {['Features', 'How It Works', 'Pricing', 'Blog'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {item}
              </a>
            ))}
          </div> */}

          <div className="hidden md:flex items-center gap-3">
            <button onClick={toggleDarkMode} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors group">
              {darkMode ? (
                <Sun size={18} strokeWidth={1.75} className="transition-transform duration-500 group-hover:rotate-90 group-hover:text-amber-400" />
              ) : (
                <Moon size={18} strokeWidth={1.75} className="transition-transform duration-500 group-hover:-rotate-12 group-hover:text-indigo-400" />
              )}
            </button>

            <button
              onClick={() => handleGetStarted()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Get Started Free
            </button>
          </div>

          <button className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors group" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? (
              <X size={20} strokeWidth={1.75} className="transition-transform duration-200 group-hover:rotate-90" />
            ) : (
              <Menu size={20} strokeWidth={1.75} className="transition-transform duration-200 group-hover:scale-105" />
            )}
          </button>
        </div>

        {/* {mobileMenuOpen && (
          <div className="md:hidden bg-card border-b border-border px-4 py-4 space-y-3">
            {['Features', 'How It Works', 'Pricing'].map(item => (
              <a key={item} href="#" className="block text-sm text-muted-foreground">{item}</a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <button onClick={() => navigate('/auth')} className="w-full py-2 text-sm border border-border rounded-lg">Sign In</button>
              <button onClick={() => handleGetStarted()} className="w-full py-2 text-sm bg-primary text-white rounded-lg">Get Started Free</button>
            </div>
          </div>
        )} */}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full bg-accent/15 blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-purple-500/15 blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 hover:bg-primary/15 transition-colors group cursor-default">
              <Sparkles size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="animate-pulse text-primary group-hover:scale-110 transition-transform duration-300" />
              <span>AI-Powered Recruitment Intelligence</span>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6"
            style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(2.5rem, 7vw, 5rem)', fontWeight: 800, lineHeight: 1.1 }}
          >
            Hire Smarter.{' '}
            <span className="bg-gradient-to-r from-primary via-purple-500 to-accent bg-clip-text text-transparent">
              Get Hired Faster.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-muted-foreground max-w-2xl mx-auto mb-10"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', lineHeight: 1.7 }}
          >
            Jobnatics AI uses advanced semantic matching to connect top talent with the right opportunities.
            Upload your resume. Get ranked matches. Land your dream job in days, not months.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <button
              onClick={() => handleGetStarted()}
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white font-semibold shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-200 group"
            >
              <Rocket size={18} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              Find My Perfect Job
              <ArrowRight size={18} strokeWidth={1.75} className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => handleGetStarted('recruiter')}
              className="flex items-center gap-2 px-8 py-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 font-semibold transition-all duration-200 group"
            >
              <Users size={18} strokeWidth={1.75} fill="currentColor" fillOpacity={0.1} className="transition-transform duration-300 group-hover:scale-105 text-muted-foreground group-hover:text-primary" />
              I'm Hiring
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-16"
          >
            {[
              { value: '50K+', label: 'Active Jobs' },
              { value: '200K+', label: 'Candidates' },
              { value: '94%', label: 'Match Accuracy' },
              { value: '12K+', label: 'Successful Hires' },
            ].map(stat => (
              <div key={stat.label} className="p-4 rounded-xl bg-card/60 backdrop-blur border border-border">
                <div className="font-bold text-foreground mb-1" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem' }}>{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative max-w-4xl mx-auto rounded-2xl overflow-hidden border border-border shadow-2xl shadow-primary/10"
          >
            <div className="bg-card/80 backdrop-blur p-1">
              <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2 mb-3">
                <div className="flex gap-1.5">
                  {['bg-red-400', 'bg-yellow-400', 'bg-green-400'].map(c => <div key={c} className={`w-3 h-3 rounded-full ${c}`} />)}
                </div>
                <div className="flex-1 bg-background/50 rounded-lg px-3 py-1 text-xs text-muted-foreground text-center">app.jobnatics.ai/dashboard</div>
              </div>
              {/* Mock dashboard UI */}
              <div className="grid grid-cols-3 gap-3 p-3">
                <div className="col-span-3 grid grid-cols-4 gap-3">
                  {[
                    { label: 'Match Rate', value: '94%', color: 'text-emerald-400' },
                    { label: 'Applications', value: '12', color: 'text-primary' },
                    { label: 'Interviews', value: '3', color: 'text-accent' },
                    { label: 'AI Score', value: '87', color: 'text-purple-400' },
                  ].map(card => (
                    <div key={card.label} className="bg-background/60 rounded-lg p-3 border border-border">
                      <div className={`text-xl font-bold ${card.color}`} style={{ fontFamily: 'Outfit, sans-serif' }}>{card.value}</div>
                      <div className="text-xs text-muted-foreground">{card.label}</div>
                    </div>
                  ))}
                </div>
                {[
                  { title: 'Senior Frontend Engineer', company: 'Stripe', match: 94 },
                  { title: 'ML Engineer', company: 'OpenAI', match: 91 },
                  { title: 'Full Stack Engineer', company: 'Vercel', match: 88 },
                ].map((job) => (
                  <div key={job.company} className="bg-background/60 rounded-lg p-3 border border-border text-left group hover:bg-background transition-colors duration-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                        <Briefcase size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="text-primary" />
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{job.match}%</span>
                    </div>
                    <div className="text-xs font-medium truncate">{job.title}</div>
                    <div className="text-xs text-muted-foreground">{job.company}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4 hover:bg-primary/15 transition-colors group cursor-default">
              <Brain size={12} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="group-hover:scale-110 transition-transform duration-300" /> Platform Features
            </div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.2 }} className="mb-4">
              Intelligence at every touchpoint
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From the moment you join to the day you close a hire, Jobnatics AI works tirelessly to give you an unfair advantage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-xl ${feature.glow} cursor-default`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Icon size={22} strokeWidth={1.5} fill="currentColor" fillOpacity={0.2} className="text-white transition-all duration-300 group-hover:rotate-6 group-hover:scale-105" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-4 hover:bg-accent/15 transition-colors group cursor-default">
              <Play size={12} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="group-hover:scale-110 transition-transform duration-300" /> How It Works
            </div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 700 }} className="mb-4">
              Built for both sides of hiring
            </h2>
          </div>

          <div className="flex items-center justify-center gap-3 mb-12">
            {(['applicant', 'recruiter'] as const).map(role => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${activeRole === role
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                  }`}
              >
                {role === 'applicant' ? '👤 Job Seeker' : '🏢 Recruiter'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.filter(s => s.role === activeRole).map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="relative text-center"
              >
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-px border-t-2 border-dashed border-primary/30" />
                )}
                <div className="relative z-10 w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.25rem', fontWeight: 600 }} className="text-primary">{step.step}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-4 hover:bg-purple-500/15 transition-colors group cursor-default">
              <Award size={12} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="group-hover:scale-110 transition-transform duration-300" /> Success Stories
            </div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 700 }} className="mb-4">
              Trusted by the best teams & talent
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-card border border-border hover:border-primary/20 transition-all duration-300"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} strokeWidth={1.5} className="text-amber-400 fill-amber-400 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" style={{ transitionDelay: `${i * 50}ms` }} />
                  ))}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" />
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.title}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>





      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center transition-all duration-300 group-hover:shadow-md group-hover:shadow-primary/20">
                <Zap size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
              </div>
              <span className="font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Jobnatics AI</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              {['Privacy', 'Terms', 'Cookies', 'Status'].map(l => (
                <a key={l} href="#" className="hover:text-foreground transition-colors">{l}</a>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">© 2026 Jobnatics AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
