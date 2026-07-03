import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { Layout } from './Layout'
import {
  Briefcase, MapPin, DollarSign, Users, Sparkles, ArrowLeft,
  Plus, Trash2, CheckCircle2, Building2, Tag, Clock, Zap,
  Globe, ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../firebase'

const JOB_CATEGORIES = [
  'Engineering', 'AI/ML', 'Design', 'Product', 'Data Science',
  'DevOps', 'Security', 'Mobile', 'Research', 'Marketing', 'Sales', 'Other',
]

const JOB_LEVELS = ['Entry', 'Mid', 'Senior', 'Lead', 'Executive']
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship']
const REMOTE_OPTIONS = [
  { value: 'remote', label: 'Fully Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

function TagInput({ tags, onChange, placeholder }: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) onChange([...tags, val])
    setInput('')
  }

  return (
    <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/30 border border-border focus-within:border-primary/40 transition-colors min-h-[48px]">
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-xs border border-primary/20 font-medium">
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter(x => x !== t))}
            className="hover:text-red-400 transition-colors ml-0.5"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : 'Add more…'}
        className="flex-1 min-w-[120px] bg-transparent text-sm placeholder:text-muted-foreground/60 outline-none"
      />
    </div>
  )
}

function ListInput({ items, onChange, placeholder }: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  const add = () => onChange([...items, ''])
  const update = (i: number, val: string) => {
    const next = [...items]
    next[i] = val
    onChange(next)
  }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <CheckCircle2 size={14} strokeWidth={1.75} className="text-primary flex-shrink-0" />
          <input
            type="text"
            value={item}
            onChange={e => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-lg bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm placeholder:text-muted-foreground/60 transition-colors"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
      >
        <Plus size={13} strokeWidth={1.75} /> Add item
      </button>
    </div>
  )
}

function Select({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[] | string[]
  placeholder?: string
}) {
  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm transition-colors cursor-pointer"
      >
        <option value="" disabled>{placeholder || 'Select…'}</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} strokeWidth={1.75} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  )
}

export function PostJob() {
  const navigate = useNavigate()
  const { user } = useApp()

  const [form, setForm] = useState({
    title: '',
    company: user?.company || '',
    location: '',
    remote: 'hybrid' as 'remote' | 'hybrid' | 'onsite',
    type: 'Full-time' as 'Full-time' | 'Part-time' | 'Contract' | 'Internship',
    level: 'Senior' as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive',
    category: '',
    salaryMin: '',
    salaryMax: '',
    description: '',
    requirements: [''],
    benefits: [''],
    skills: [] as string[],
    companySize: '',
    industry: '',
    featured: false,
    urgent: false,
  })

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const TOTAL_STEPS = 3

  const step1Valid =
    form.title.trim() &&
    form.company.trim() &&
    form.category &&
    form.level &&
    form.type

  const step2Valid =
    form.description.trim().length >= 20 &&
    form.requirements.some(r => r.trim())

  const canSubmit = step1Valid && step2Valid

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    try {
      const salaryMin = parseInt(form.salaryMin.replace(/\D/g, '')) || 0
      const salaryMax = parseInt(form.salaryMax.replace(/\D/g, '')) || 0
      const salaryStr = salaryMin && salaryMax
        ? `$${salaryMin.toLocaleString()} – $${salaryMax.toLocaleString()}`
        : salaryMin
        ? `$${salaryMin.toLocaleString()}+`
        : 'Competitive'

      const jobDoc = {
        title: form.title.trim(),
        company: form.company.trim(),
        companyLogo: '',
        location: form.location.trim() || 'Remote',
        remote: form.remote,
        salary: salaryStr,
        salaryMin,
        salaryMax,
        type: form.type,
        level: form.level,
        posted: 'Just now',
        match: 0,
        skills: form.skills,
        description: form.description.trim(),
        requirements: form.requirements.filter(r => r.trim()),
        benefits: form.benefits.filter(b => b.trim()),
        applicants: 0,
        category: form.category,
        featured: form.featured,
        urgent: form.urgent,
        companySize: form.companySize,
        industry: form.industry,
        postedBy: user?.id || '',
        postedAt: new Date().toISOString(),
      }

      await addDoc(collection(db, 'jobs'), jobDoc)
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Failed to post job. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"
          >
            <CheckCircle2 size={40} strokeWidth={1.5} className="text-emerald-400" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 700 }} className="mb-2">
              Job Posted Successfully!
            </h2>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">{form.title}</strong> at <strong className="text-foreground">{form.company}</strong> is now live and will appear in candidate job searches.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex gap-3">
            <button
              onClick={() => { setDone(false); setForm(f => ({ ...f, title: '', description: '', requirements: [''], benefits: [''], skills: [] })); setStep(1) }}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Post Another Job
            </button>
            <button
              onClick={() => navigate('/app/recruiter')}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
            >
              Back to Dashboard
            </button>
          </motion.div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group"
          >
            <ArrowLeft size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> Back
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Briefcase size={18} strokeWidth={1.75} className="text-white" />
            </div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 700 }}>
              Post a New Job Opening
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-12">
            Fill in the details below — candidates will be matched by AI automatically.
          </p>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => s < step && setStep(s)}
                className={`w-8 h-8 rounded-full text-xs font-semibold transition-all flex items-center justify-center flex-shrink-0 ${
                  s < step ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer hover:scale-105' :
                  s === step ? 'bg-primary text-white shadow-md shadow-primary/30' :
                  'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {s < step ? <CheckCircle2 size={14} strokeWidth={2} /> : s}
              </button>
              <span className={`text-xs font-medium hidden sm:block ${s === step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {['Role Details', 'Description', 'Preview & Post'][i]}
              </span>
              {i < TOTAL_STEPS - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-colors ${s < step ? 'bg-emerald-500/40' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Role Details ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="p-6 rounded-2xl bg-card border border-border space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={15} strokeWidth={1.75} className="text-primary" />
                  <h2 className="font-semibold">Role Information</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Job Title *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => set('title', e.target.value)}
                      placeholder="e.g. Senior Frontend Engineer"
                      className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm placeholder:text-muted-foreground/60 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Company *</label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={e => set('company', e.target.value)}
                      placeholder="Your company name"
                      className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm placeholder:text-muted-foreground/60 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Industry</label>
                    <input
                      type="text"
                      value={form.industry}
                      onChange={e => set('industry', e.target.value)}
                      placeholder="e.g. Fintech, SaaS"
                      className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm placeholder:text-muted-foreground/60 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category *</label>
                    <Select value={form.category} onChange={v => set('category', v)} options={JOB_CATEGORIES} placeholder="Select category" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Level *</label>
                    <Select value={form.level} onChange={v => set('level', v)} options={JOB_LEVELS} placeholder="Select level" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type *</label>
                    <Select value={form.type} onChange={v => set('type', v)} options={JOB_TYPES} placeholder="Select type" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                      <MapPin size={12} strokeWidth={1.75} /> Location
                    </label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={e => set('location', e.target.value)}
                      placeholder="e.g. San Francisco, CA"
                      className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm placeholder:text-muted-foreground/60 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                      <Globe size={12} strokeWidth={1.75} /> Work Style *
                    </label>
                    <Select value={form.remote} onChange={v => set('remote', v)} options={REMOTE_OPTIONS} placeholder="Select work style" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                    <DollarSign size={12} strokeWidth={1.75} /> Salary Range (USD / year)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={form.salaryMin}
                      onChange={e => set('salaryMin', e.target.value)}
                      placeholder="Min e.g. 120000"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm placeholder:text-muted-foreground/60 transition-colors"
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <input
                      type="text"
                      value={form.salaryMax}
                      onChange={e => set('salaryMax', e.target.value)}
                      placeholder="Max e.g. 180000"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm placeholder:text-muted-foreground/60 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                    <Tag size={12} strokeWidth={1.75} /> Required Skills
                  </label>
                  <TagInput
                    tags={form.skills}
                    onChange={v => set('skills', v)}
                    placeholder="Type a skill and press Enter…"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1.5">Press Enter or comma after each skill</p>
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => set('featured', !form.featured)}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${form.featured ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/40'}`}
                    >
                      {form.featured && <CheckCircle2 size={12} strokeWidth={2.5} className="text-white" />}
                    </div>
                    <span className="text-sm">Feature this listing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => set('urgent', !form.urgent)}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${form.urgent ? 'bg-amber-500 border-amber-500' : 'border-border group-hover:border-amber-500/40'}`}
                    >
                      {form.urgent && <Zap size={11} strokeWidth={2.5} className="text-white" fill="currentColor" />}
                    </div>
                    <span className="text-sm">Mark as urgent</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => step1Valid && setStep(2)}
                  disabled={!step1Valid}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20 transition-all"
                >
                  Continue →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Description ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="p-6 rounded-2xl bg-card border border-border space-y-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Job Description *</label>
                  <textarea
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Describe the role, responsibilities, and what makes it exciting…"
                    rows={7}
                    className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border focus:border-primary/40 focus:outline-none text-sm placeholder:text-muted-foreground/60 transition-colors resize-none leading-relaxed"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{form.description.length} characters</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Requirements *</label>
                  <ListInput items={form.requirements} onChange={v => set('requirements', v)} placeholder="e.g. 5+ years of React experience" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Benefits & Perks</label>
                  <ListInput items={form.benefits} onChange={v => set('benefits', v)} placeholder="e.g. Competitive salary + equity" />
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => step2Valid && setStep(3)}
                  disabled={!step2Valid}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20 transition-all"
                >
                  Preview →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="p-6 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles size={15} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-primary animate-pulse" />
                  <h2 className="font-semibold">Listing Preview</h2>
                  <span className="ml-auto text-xs text-muted-foreground">How candidates will see it</span>
                </div>

                {/* Preview card */}
                <div className="p-5 rounded-xl bg-muted/30 border border-border space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center text-xl">
                        💼
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">{form.title || 'Job Title'}</h3>
                        <p className="text-sm text-muted-foreground">{form.company || 'Company'}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1.5">
                          {form.location && <span className="flex items-center gap-1"><MapPin size={10} strokeWidth={1.75} /> {form.location}</span>}
                          <span className="flex items-center gap-1"><Clock size={10} strokeWidth={1.75} /> {form.type}</span>
                          {(form.salaryMin || form.salaryMax) && (
                            <span className="flex items-center gap-1">
                              <DollarSign size={10} strokeWidth={1.75} />
                              {form.salaryMin && `$${parseInt(form.salaryMin).toLocaleString()}`}
                              {form.salaryMin && form.salaryMax && ' – '}
                              {form.salaryMax && `$${parseInt(form.salaryMax).toLocaleString()}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">{form.level}</span>
                      {form.urgent && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center gap-1"><Zap size={9} fill="currentColor" /> Urgent</span>}
                      {form.featured && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><Sparkles size={9} /> Featured</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {form.skills.map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">{s}</span>
                    ))}
                  </div>

                  {form.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{form.description}</p>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                  ← Edit
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmit}
                  className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 transition-all"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Posting…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="animate-pulse" />
                      Post Job Opening
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}
