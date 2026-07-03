// ─────────────────────────────────────────────────────────────────────────────
// Type definitions only – all mock data has been removed.
// Data is now sourced entirely from Firebase Firestore.
// ─────────────────────────────────────────────────────────────────────────────

export interface Job {
  id: string
  title: string
  company: string
  companyLogo: string
  location: string
  remote: 'remote' | 'hybrid' | 'onsite'
  salary: string
  salaryMin: number
  salaryMax: number
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship'
  level: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive'
  posted: string
  match: number
  skills: string[]
  description: string
  requirements: string[]
  benefits: string[]
  applicants: number
  category: string
  featured: boolean
  urgent: boolean
  companySize: string
  industry: string
  postedBy?: string
  views?: number
  deadline?: string
}

export interface Candidate {
  id: string
  name: string
  title: string
  location: string
  avatar: string
  skills: string[]
  experience: number
  education: string
  match: number
  aiScore: number
  status: 'Available' | 'Open to offers' | 'Not looking'
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
  appliedDate: string
  bio: string
  achievements: string[]
  jobId?: string
}

export interface Notification {
  id: string
  type: 'match' | 'application' | 'message' | 'interview' | 'offer' | 'system'
  title: string
  description: string
  time: string
  read: boolean
  avatar?: string
  actionLabel?: string
}

export function calculateJobMatchScore(
  userSkills: string[] | undefined,
  jobSkills: string[] | undefined,
  jobId: string,
  jobTitle?: string,
  jobCompany?: string,
  aiMatchScores?: Record<string, number>
): number {
  // 1. Try to fetch from backend model scores
  if (jobTitle && jobCompany && aiMatchScores) {
    const key = `${jobTitle.toLowerCase().trim()}_${jobCompany.toLowerCase().trim()}`
    if (aiMatchScores[key] !== undefined) {
      return aiMatchScores[key]
    }
  }

  // 2. Fallback to client-side match calculation
  if (!userSkills || userSkills.length === 0) {
    let hash = 0
    for (let i = 0; i < jobId.length; i++) {
      hash = jobId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return 70 + Math.abs(hash % 16)
  }

  const jSkills = jobSkills || []
  if (jSkills.length === 0) return 75

  const matches = jSkills.filter(s =>
    userSkills.some(us => us.toLowerCase().trim() === s.toLowerCase().trim())
  ).length

  const baseScore = 60
  const overlapRatio = matches / jSkills.length
  const calculated = Math.round(baseScore + overlapRatio * 35)

  return calculated
}
