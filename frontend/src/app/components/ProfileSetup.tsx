import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import {
  Sparkles, MapPin, Briefcase, Globe, Linkedin, Github,
  CheckCircle2, ArrowRight, ArrowLeft, Building2, Target, DollarSign
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'

export function ProfileSetup() {
  const navigate = useNavigate()
  const { user, setUser, darkMode, companies, loadingData } = useApp()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // If the recruiter has completed general profile setup but doesn't have a company, default to step 4 (the company step)
  useEffect(() => {
    if (user && user.role === 'recruiter' && user.profileSetupCompleted && !loadingData) {
      const hasCompany = companies.some(c => c.postedBy === user.id)
      if (!hasCompany) {
        setStep(4)
      }
    }
  }, [user, companies, loadingData])

  // Pre-populate form data using the current user settings if available
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        location: user.location || prev.location,
        bio: user.bio || prev.bio,
        website: user.website || prev.website,
        linkedin: user.linkedin || prev.linkedin,
        github: user.github || prev.github,
        workStyle: user.workStyle || prev.workStyle,
        roleLevel: user.roleLevel || prev.roleLevel,
        salaryRange: user.salaryRange || prev.salaryRange,
        relocation: user.relocation || prev.relocation,
        hiringPriority: user.hiringPriority || prev.hiringPriority,
        companyName: user.company || prev.companyName,
      }))
    }
  }, [user])

  // Redirect to Auth if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/auth')
    } else if (user.profileSetupCompleted && !loadingData) {
      const needsCompanySetup = user.role === 'recruiter' && !user.company && !companies.some(c => c.postedBy === user.id)
      if (!needsCompanySetup) {
        // If profile is already complete and no company setup is needed, redirect to dashboard
        navigate(user.role === 'recruiter' ? '/app/recruiter' : '/app/applicant')
      }
    }
  }, [user, companies, loadingData, navigate])

  const [form, setForm] = useState({
    location: '',
    bio: '',
    website: '',
    linkedin: '',
    github: '',
    workStyle: 'Remote',
    roleLevel: 'Senior',
    salaryRange: '$120k–$150k',
    relocation: 'No',
    hiringPriority: 'Technical Depth',
    // Recruiter company fields
    companyName: '',
    companyTagline: '',
    companyDescription: '',
    companyIndustry: '',
    companySize: '',
    companyFounded: '',
    companyLogo: '🏢',
    companyTechStack: '' as string,
    companyCulture: '' as string,
  })

  if (!user || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#07091a] via-[#0d1228] to-[#070918]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">Loading onboarding settings...</p>
        </div>
      </div>
    )
  }

  const handleNext = () => {
    const newErrors: Record<string, string> = {}
    if (step === 1) {
      if (!form.location.trim()) {
        newErrors.location = 'Location is required.'
      } else if (form.location.trim().length < 3) {
        newErrors.location = 'Location must be at least 3 characters.'
      }
      if (!form.bio.trim()) {
        newErrors.bio = 'Bio details are required.'
      } else if (form.bio.trim().length < 15) {
        newErrors.bio = 'Please write at least 15 characters to help our AI profile builder.'
      }
    } else if (step === 2) {
      const isValidUrl = (url: string) => {
        if (!url) return true
        const pattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/i
        return pattern.test(url)
      }
      if (form.website && !isValidUrl(form.website)) {
        newErrors.website = 'Please enter a valid website URL.'
      }
      if (form.linkedin && (!isValidUrl(form.linkedin) || !form.linkedin.includes('linkedin.com'))) {
        newErrors.linkedin = 'Please enter a valid LinkedIn URL (containing linkedin.com).'
      }
      if (user.role === 'applicant' && form.github && (!isValidUrl(form.github) || !form.github.includes('github.com'))) {
        newErrors.github = 'Please enter a valid GitHub URL (containing github.com).'
      }
    } else if (step === 4 && user.role === 'recruiter') {
      // step 4 for recruiters = company details
      if (!form.companyName.trim()) newErrors.companyName = 'Company name is required.'
      if (!form.companyDescription.trim() || form.companyDescription.trim().length < 20) {
        newErrors.companyDescription = 'Please write at least 20 characters describing your company.'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Please fix the validation errors before continuing.')
      return
    }

    setErrors({})
    setStep(prev => prev + 1)
  }

  const handleBack = () => {
    setStep(prev => prev - 1)
  }

  // Total steps: applicants = 3, recruiters = 4 (extra company step)
  const totalSteps = user.role === 'recruiter' ? 4 : 3

  const handleFinish = async () => {
    // Validate recruiter company details on the final step
    if (user.role === 'recruiter') {
      const newErrors: Record<string, string> = {}
      if (!form.companyName.trim()) newErrors.companyName = 'Company name is required.'
      if (!form.companyDescription.trim() || form.companyDescription.trim().length < 20) {
        newErrors.companyDescription = 'Please write at least 20 characters describing your company.'
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        toast.error('Please fix the validation errors before continuing.')
        return
      }
    }

    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1500))

    // If recruiter, save company profile to Firestore companies collection
    if (user.role === 'recruiter' && form.companyName.trim()) {
      const slug = form.companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      const techStack = form.companyTechStack.split(',').map(s => s.trim()).filter(Boolean)
      const culture = form.companyCulture.split(',').map(s => s.trim()).filter(Boolean)
      const companyDoc = {
        name: form.companyName.trim(),
        logo: form.companyLogo,
        tagline: form.companyTagline.trim(),
        description: form.companyDescription.trim(),
        industry: form.companyIndustry.trim(),
        size: form.companySize,
        founded: form.companyFounded.trim(),
        location: form.location.trim(),
        website: form.website.trim(),
        techStack,
        benefits: [],
        culture,
        perks: [],
        rating: 0,
        reviews: 0,
        postedBy: user.id,
      }
      try {
        await setDoc(doc(db, 'companies', slug), companyDoc)
      } catch (err) {
        console.error('Error saving company to Firestore:', err)
      }
    }

    const updatedProfile = {
      role: user.role,
      avatar: user.avatar,
      title: user.role === 'applicant' ? (user.title || form.roleLevel + ' Engineer') : user.title,
      company: user.role === 'recruiter' ? form.companyName.trim() : user.company,
      location: form.location,
      bio: form.bio,
      website: form.website,
      linkedin: form.linkedin,
      github: user.role === 'applicant' ? form.github : '',
      workStyle: form.workStyle,
      roleLevel: form.roleLevel,
      salaryRange: user.role === 'applicant' ? form.salaryRange : '',
      relocation: user.role === 'applicant' ? form.relocation : '',
      hiringPriority: user.role === 'recruiter' ? form.hiringPriority : '',
      profileSetupCompleted: true, // Complete onboarding!
    }

    try {
      await setDoc(doc(db, 'users', user.id), {
        name: user.name,
        email: user.email,
        ...updatedProfile
      }, { merge: true })
    } catch (err) {
      console.error('Error saving user profile to Firestore:', err)
      toast.error('Failed to save profile to database.')
      setLoading(false)
      return
    }

    // Save details to LocalStorage under user uid
    localStorage.setItem(`jobnatics_profile_${user.id}`, JSON.stringify(updatedProfile))

    // Fire Confetti!
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#a855f7', '#10b981', '#3b82f6']
    })

    toast.success('Onboarding complete! Welcome to Jobnatics AI.')

    setUser({
      ...user,
      ...updatedProfile,
    })

    // Redirect to dashboard
    navigate(user.role === 'recruiter' ? '/app/recruiter' : '/app/applicant')
    setLoading(false)
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-[#07091a] via-[#0d1228] to-[#070918] p-6 ${darkMode ? 'dark' : ''}`}>
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8 group cursor-default">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-105">
            <Sparkles size={20} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="text-white animate-pulse" />
          </div>
          <span className="font-bold text-white text-xl" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Jobnatics <span className="text-primary">AI</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-card/60 backdrop-blur-xl border border-border/30 rounded-2xl shadow-xl overflow-hidden">
          {/* Progress Header */}
          <div className="bg-muted/30 p-6 border-b border-border/20">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Complete Your Profile
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Let's personalize your AI recruiter & matchmaking settings
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                Step {step} of {totalSteps}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-border/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    1. Basic Profile
                  </h2>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <MapPin size={14} strokeWidth={1.75} className="text-primary" /> Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. San Francisco, CA or London, UK"
                      value={form.location}
                      onChange={e => {
                        setForm({ ...form, location: e.target.value })
                        if (errors.location) setErrors({ ...errors, location: '' })
                      }}
                      className={`w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 ${errors.location
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-border/30 focus:border-primary focus:ring-primary/20'
                        }`}
                    />
                    {errors.location && (
                      <p className="text-[11px] text-red-400 mt-1.5 font-medium">{errors.location}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <Briefcase size={14} strokeWidth={1.75} className="text-primary" />
                      {user.role === 'recruiter' ? 'About Your Hiring Needs' : 'Professional Biography'}
                    </label>
                    <textarea
                      rows={4}
                      placeholder={user.role === 'recruiter'
                        ? "Describe the role, company culture, or key skills you're seeking to hire..."
                        : "Describe your professional background, core technical skills, and career interests..."
                      }
                      value={form.bio}
                      onChange={e => {
                        setForm({ ...form, bio: e.target.value })
                        if (errors.bio) setErrors({ ...errors, bio: '' })
                      }}
                      className={`w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 resize-none leading-relaxed ${errors.bio
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-border/30 focus:border-primary focus:ring-primary/20'
                        }`}
                    />
                    {errors.bio && (
                      <p className="text-[11px] text-red-400 mt-1.5 font-medium">{errors.bio}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    2. Professional Links
                  </h2>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <Globe size={14} strokeWidth={1.75} className="text-primary" />
                      {user.role === 'recruiter' ? 'Company Website' : 'Personal Portfolio / Website'}
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={form.website}
                      onChange={e => {
                        setForm({ ...form, website: e.target.value })
                        if (errors.website) setErrors({ ...errors, website: '' })
                      }}
                      className={`w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 ${errors.website
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-border/30 focus:border-primary focus:ring-primary/20'
                        }`}
                    />
                    {errors.website && (
                      <p className="text-[11px] text-red-400 mt-1.5 font-medium">{errors.website}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <Linkedin size={14} strokeWidth={1.75} className="text-primary" /> LinkedIn URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/username"
                      value={form.linkedin}
                      onChange={e => {
                        setForm({ ...form, linkedin: e.target.value })
                        if (errors.linkedin) setErrors({ ...errors, linkedin: '' })
                      }}
                      className={`w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 ${errors.linkedin
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-border/30 focus:border-primary focus:ring-primary/20'
                        }`}
                    />
                    {errors.linkedin && (
                      <p className="text-[11px] text-red-400 mt-1.5 font-medium">{errors.linkedin}</p>
                    )}
                  </div>
                  {user.role === 'applicant' && (
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                        <Github size={14} strokeWidth={1.75} className="text-primary" /> GitHub URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://github.com/username"
                        value={form.github}
                        onChange={e => {
                          setForm({ ...form, github: e.target.value })
                          if (errors.github) setErrors({ ...errors, github: '' })
                        }}
                        className={`w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 ${errors.github
                            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-border/30 focus:border-primary focus:ring-primary/20'
                          }`}
                      />
                      {errors.github && (
                        <p className="text-[11px] text-red-400 mt-1.5 font-medium">{errors.github}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    3. AI Matchmaking Preferences
                  </h2>

                  {user.role === 'applicant' ? (
                    <>
                      {/* Work style */}
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                          <Building2 size={14} strokeWidth={1.75} className="text-primary" /> Preferred Work Style
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Remote', 'Hybrid', 'On-site'].map(style => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setForm({ ...form, workStyle: style })}
                              className={`py-2 text-xs font-semibold rounded-lg border transition-all ${form.workStyle === style
                                  ? 'bg-primary/10 border-primary text-primary'
                                  : 'bg-muted/20 border-border/30 text-muted-foreground hover:border-primary/30'
                                }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Expected salary */}
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                          <DollarSign size={14} strokeWidth={1.75} className="text-primary" /> Expected Salary Range
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['$90k–$120k', '$120k–$150k', '$150k–$200k+'].map(salary => (
                            <button
                              key={salary}
                              type="button"
                              onClick={() => setForm({ ...form, salaryRange: salary })}
                              className={`py-2.5 text-xs font-semibold rounded-lg border transition-all ${form.salaryRange === salary
                                  ? 'bg-primary/10 border-primary text-primary'
                                  : 'bg-muted/20 border-border/30 text-muted-foreground hover:border-primary/30'
                                }`}
                            >
                              {salary}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Relocation */}
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2">Open to Relocation?</label>
                        <div className="flex gap-4">
                          {['Yes', 'No'].map(opt => (
                            <label key={opt} className="flex items-center gap-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                              <input
                                type="radio"
                                name="relocation"
                                checked={form.relocation === opt}
                                onChange={() => setForm({ ...form, relocation: opt })}
                                className="accent-primary w-4 h-4"
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Recruiter hiring priority */}
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                          <Target size={14} strokeWidth={1.75} className="text-accent" /> Key Hiring Priority
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {['Speed to Hire', 'Technical Depth', 'Cultural Fit', 'Domain Experience'].map(priority => (
                            <button
                              key={priority}
                              type="button"
                              onClick={() => setForm({ ...form, hiringPriority: priority })}
                              className={`py-3 text-xs font-semibold rounded-lg border transition-all ${form.hiringPriority === priority
                                  ? 'bg-accent/15 border-accent text-accent'
                                  : 'bg-muted/20 border-border/30 text-muted-foreground hover:border-accent/30'
                                }`}
                            >
                              {priority}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Work style recruiter */}
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2">Office Policy</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Remote', 'Hybrid', 'On-site'].map(style => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setForm({ ...form, workStyle: style })}
                              className={`py-2 text-xs font-semibold rounded-lg border transition-all ${form.workStyle === style
                                  ? 'bg-primary/10 border-primary text-primary'
                                  : 'bg-muted/20 border-border/30 text-muted-foreground hover:border-primary/30'
                                }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* ── Step 4 (Recruiter only): Company Details ── */}
              {step === 4 && user.role === 'recruiter' && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    4. Company Profile
                  </h2>
                  <p className="text-xs text-muted-foreground -mt-2 mb-3">This will populate your public company page shown to candidates.</p>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Company Name *</label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={e => { setForm({ ...form, companyName: e.target.value }); if (errors.companyName) setErrors({ ...errors, companyName: '' }) }}
                      placeholder="e.g. Acme Corp"
                      className={`w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 ${errors.companyName ? 'border-red-500/50 focus:ring-red-500/20' : 'border-border/30 focus:border-primary focus:ring-primary/20'}`}
                    />
                    {errors.companyName && <p className="text-[11px] text-red-400 mt-1">{errors.companyName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Tagline</label>
                    <input
                      type="text"
                      value={form.companyTagline}
                      onChange={e => setForm({ ...form, companyTagline: e.target.value })}
                      placeholder="e.g. Building the future of work"
                      className="w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border border-border/30 focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Company Description *</label>
                    <textarea
                      rows={3}
                      value={form.companyDescription}
                      onChange={e => { setForm({ ...form, companyDescription: e.target.value }); if (errors.companyDescription) setErrors({ ...errors, companyDescription: '' }) }}
                      placeholder="What does your company do? What makes it a great place to work?"
                      className={`w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 resize-none ${errors.companyDescription ? 'border-red-500/50 focus:ring-red-500/20' : 'border-border/30 focus:border-primary focus:ring-primary/20'}`}
                    />
                    {errors.companyDescription && <p className="text-[11px] text-red-400 mt-1">{errors.companyDescription}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">Industry</label>
                      <input
                        type="text"
                        value={form.companyIndustry}
                        onChange={e => setForm({ ...form, companyIndustry: e.target.value })}
                        placeholder="e.g. Fintech, SaaS"
                        className="w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border border-border/30 focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">Founded Year</label>
                      <input
                        type="text"
                        value={form.companyFounded}
                        onChange={e => setForm({ ...form, companyFounded: e.target.value })}
                        placeholder="e.g. 2018"
                        className="w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border border-border/30 focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-2">Company Size</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['1–50', '50–200', '200–1,000', '1,000–5,000', '5,000–10,000', '10,000+'].map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setForm({ ...form, companySize: size })}
                          className={`py-2 text-xs font-semibold rounded-lg border transition-all ${form.companySize === size ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/20 border-border/30 text-muted-foreground hover:border-primary/30'}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Tech Stack <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
                    <input
                      type="text"
                      value={form.companyTechStack}
                      onChange={e => setForm({ ...form, companyTechStack: e.target.value })}
                      placeholder="e.g. React, Node.js, PostgreSQL, AWS"
                      className="w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border border-border/30 focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Culture Values <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
                    <input
                      type="text"
                      value={form.companyCulture}
                      onChange={e => setForm({ ...form, companyCulture: e.target.value })}
                      placeholder="e.g. Transparency, Innovation, Ownership"
                      className="w-full px-4 py-3 text-sm rounded-xl bg-muted/40 border border-border/30 focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Footer */}
          <div className="p-6 bg-muted/10 border-t border-border/20 flex justify-between items-center">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 group"
              >
                <ArrowLeft size={14} strokeWidth={1.75} className="transition-transform group-hover:-translate-x-0.5" /> Back
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-all hover:scale-[1.02] shadow shadow-primary/25 group"
              >
                Continue
                <ArrowRight size={14} strokeWidth={1.75} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-white font-bold text-xs hover:scale-[1.02] transition-all shadow-md shadow-primary/25 disabled:opacity-50 group"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Saving setup...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-white" />
                    Complete Profile Setup
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
