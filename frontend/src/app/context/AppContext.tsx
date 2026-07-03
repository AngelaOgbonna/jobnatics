import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  doc,
  setDoc,
  onSnapshot
} from 'firebase/firestore'
import { auth, db, BACKEND_URL } from '../firebase'
import {
  Job,
  Candidate,
  Notification
} from '../data/mockData'

export type UserRole = 'applicant' | 'recruiter'

export interface CompanyProfileData {
  id: string
  name: string
  logo: string
  tagline: string
  description: string
  industry: string
  size: string
  founded: string
  location: string
  website: string
  techStack: string[]
  benefits: string[]
  culture: string[]
  perks: { icon: string; label: string }[]
  rating: number
  reviews: number
  postedBy: string
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar: string
  company?: string
  title?: string
  profileSetupCompleted?: boolean
  bio?: string
  location?: string
  website?: string
  linkedin?: string
  github?: string
  workStyle?: string
  roleLevel?: string
  salaryRange?: string
  relocation?: string
  hiringPriority?: string
  resumeUrl?: string
  resumeName?: string
  resumeText?: string
  resumeUploadedAt?: string
  skills?: string[]
}

interface AppContextType {
  user: User | null
  setUser: (user: User | null) => void
  darkMode: boolean
  toggleDarkMode: () => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Data states
  jobs: Job[]
  candidates: Candidate[]
  notifications: Notification[]
  applicantApplications: any[]
  applicationChartData: any[]
  recruiterHiringData: any[]
  recruiterJobPostings: any[]
  sourceData: any[]
  monthlyHireData: any[]
  companies: CompanyProfileData[]
  loadingData: boolean
  allUsers: any[]
  aiMatchScores: Record<string, number>
  loadingAiMatches: boolean
  matchedJobs: any[] | null

  // Mutators
  addApplicantApplication: (app: any) => Promise<void>
}

export const AppContext = createContext<AppContextType>({
  user: null,
  setUser: () => {},
  darkMode: true,
  toggleDarkMode: () => {},
  sidebarOpen: true,
  setSidebarOpen: () => {},

  jobs: [],
  candidates: [],
  notifications: [],
  applicantApplications: [],
  applicationChartData: [],
  recruiterHiringData: [],
  recruiterJobPostings: [],
  sourceData: [],
  monthlyHireData: [],
  companies: [],
  loadingData: true,
  allUsers: [],
  aiMatchScores: {},
  loadingAiMatches: false,
  matchedJobs: null,

  addApplicantApplication: async () => {},
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // All collections start empty — Firestore is the single source of truth
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [applicantApplications, setApplicantApplications] = useState<any[]>([])
  const [applicationChartData, setApplicationChartData] = useState<any[]>([])
  const [recruiterHiringData, setRecruiterHiringData] = useState<any[]>([])
  const [recruiterJobPostings, setRecruiterJobPostings] = useState<any[]>([])
  const [sourceData, setSourceData] = useState<any[]>([])
  const [monthlyHireData, setMonthlyHireData] = useState<any[]>([])
  const [companies, setCompanies] = useState<CompanyProfileData[]>([])
  const [loadingData, setLoadingData] = useState<boolean>(true)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [aiMatchScores, setAiMatchScores] = useState<Record<string, number>>({})
  const [loadingAiMatches, setLoadingAiMatches] = useState(false)
  const [matchedJobs, setMatchedJobs] = useState<any[] | null>(null)



  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Listen to Firestore real-time updates when user is authenticated
  useEffect(() => {
    if (!user?.id) {
      // Clear all data on logout
      setJobs([])
      setCandidates([])
      setNotifications([])
      setApplicantApplications([])
      setApplicationChartData([])
      setRecruiterHiringData([])
      setRecruiterJobPostings([])
      setSourceData([])
      setMonthlyHireData([])
      setCompanies([])
      setLoadingData(false)
      setAiMatchScores({})
      setLoadingAiMatches(false)
      setMatchedJobs(null)
      return
    }

    console.log('User authenticated. Starting real-time Firestore listeners...')
    setLoadingData(true)

    const unsubJobs = onSnapshot(collection(db, 'jobs'), (snapshot) => {
      const list: Job[] = []
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as Job)
      })
      setJobs(list)
      setLoadingData(false)
    }, err => {
      console.error('Error listening to jobs:', err)
      setLoadingData(false)
    })

    const unsubCandidates = onSnapshot(collection(db, 'candidates'), (snapshot) => {
      const list: Candidate[] = []
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as Candidate)
      })
      setCandidates(list)
    }, err => console.error('Error listening to candidates:', err))

    const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snapshot) => {
      const list: Notification[] = []
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as Notification)
      })
      setNotifications(list)
    }, err => console.error('Error listening to notifications:', err))

    const unsubApplicantApplications = onSnapshot(collection(db, 'applicantApplications'), (snapshot) => {
      const list: any[] = []
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id })
      })
      // If recruiter, show all applications (so they can manage applicants for their roles)
      // Otherwise, only show the applicant's own applications
      if (user?.role === 'recruiter') {
        setApplicantApplications(list)
      } else {
        setApplicantApplications(list.filter(a => a.userId === user?.id))
      }
    }, err => console.error('Error listening to applicantApplications:', err))

    const unsubAllUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: any[] = []
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id })
      })
      setAllUsers(list)
    }, err => console.error('Error listening to users collection:', err))

    const unsubApplicationChartData = onSnapshot(collection(db, 'applicationChartData'), (snapshot) => {
      const list: any[] = []
      snapshot.forEach(docSnap => {
        list.push(docSnap.data())
      })
      setApplicationChartData(list)
    }, err => console.error('Error listening to applicationChartData:', err))

    const unsubRecruiterHiringData = onSnapshot(collection(db, 'recruiterHiringData'), (snapshot) => {
      const list: any[] = []
      snapshot.forEach(docSnap => {
        list.push(docSnap.data())
      })
      setRecruiterHiringData(list)
    }, err => console.error('Error listening to recruiterHiringData:', err))

    const unsubRecruiterJobPostings = onSnapshot(collection(db, 'recruiterJobPostings'), (snapshot) => {
      const list: any[] = []
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id })
      })
      setRecruiterJobPostings(list)
    }, err => console.error('Error listening to recruiterJobPostings:', err))

    const unsubSourceData = onSnapshot(collection(db, 'sourceData'), (snapshot) => {
      const list: any[] = []
      snapshot.forEach(docSnap => {
        list.push(docSnap.data())
      })
      setSourceData(list)
    }, err => console.error('Error listening to sourceData:', err))

    const unsubMonthlyHireData = onSnapshot(collection(db, 'monthlyHireData'), (snapshot) => {
      const list: any[] = []
      snapshot.forEach(docSnap => {
        list.push(docSnap.data())
      })
      setMonthlyHireData(list)
    }, err => console.error('Error listening to monthlyHireData:', err))

    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
      const list: CompanyProfileData[] = []
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as CompanyProfileData)
      })
      setCompanies(list)
    }, err => console.error('Error listening to companies:', err))

    return () => {
      console.log('Cleaning up Firestore listeners...')
      unsubJobs()
      unsubCandidates()
      unsubNotifications()
      unsubApplicantApplications()
      unsubApplicationChartData()
      unsubRecruiterHiringData()
      unsubRecruiterJobPostings()
      unsubSourceData()
      unsubMonthlyHireData()
      unsubCompanies()
      unsubAllUsers()
    }
  }, [user?.id])

  // Firebase auth state listener
  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous user document listener if any
      if (unsubUserDoc) {
        unsubUserDoc()
        unsubUserDoc = null
      }

      if (firebaseUser) {
        // First, check if there is a local cache to avoid flash of un-onboarded state while loading
        const cachedProfile = localStorage.getItem(`jobnatics_profile_${firebaseUser.uid}`)
        if (cachedProfile) {
          try {
            const profile = JSON.parse(cachedProfile)
            setUser({
              id: firebaseUser.uid,
              name: profile.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: profile.role || 'applicant',
              avatar: profile.avatar || firebaseUser.photoURL || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face',
              company: profile.company,
              title: profile.title,
              profileSetupCompleted: !!profile.profileSetupCompleted,
              bio: profile.bio || '',
              location: profile.location || '',
              website: profile.website || '',
              linkedin: profile.linkedin || '',
              github: profile.github || '',
              workStyle: profile.workStyle || '',
              roleLevel: profile.roleLevel || '',
              salaryRange: profile.salaryRange || '',
              relocation: profile.relocation || '',
              hiringPriority: profile.hiringPriority || '',
              resumeUrl: profile.resumeUrl || '',
              resumeName: profile.resumeName || '',
              resumeUploadedAt: profile.resumeUploadedAt || '',
              skills: profile.skills,
            })
          } catch (e) {
            console.error('Error parsing cached profile:', e)
          }
        }

        // Set up real-time listener on user doc
        unsubUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data()
            const updatedUser = {
              id: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: data.role || 'applicant',
              avatar: data.avatar || firebaseUser.photoURL || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face',
              company: data.company,
              title: data.title,
              profileSetupCompleted: !!data.profileSetupCompleted,
              bio: data.bio || '',
              location: data.location || '',
              website: data.website || '',
              linkedin: data.linkedin || '',
              github: data.github || '',
              workStyle: data.workStyle || '',
              roleLevel: data.roleLevel || '',
              salaryRange: data.salaryRange || '',
              relocation: data.relocation || '',
              hiringPriority: data.hiringPriority || '',
              resumeUrl: data.resumeUrl || '',
              resumeName: data.resumeName || '',
              resumeUploadedAt: data.resumeUploadedAt || '',
              skills: data.skills,
            }
            setUser(updatedUser)
            // Update LocalStorage cache
            localStorage.setItem(`jobnatics_profile_${firebaseUser.uid}`, JSON.stringify(updatedUser))
          } else {
            // User doc does not exist yet (newly signed up or database cleared)
            const cachedRaw = localStorage.getItem(`jobnatics_profile_${firebaseUser.uid}`)
            let profile: any = null
            try {
              profile = cachedRaw ? JSON.parse(cachedRaw) : null
            } catch (e) {
              console.error('Error parsing cached profile during init:', e)
            }
            if (!profile) {
              profile = {
                role: 'applicant',
                avatar: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face',
                profileSetupCompleted: false,
              }
            }
            const initialUser = {
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: profile.role,
              avatar: profile.avatar || firebaseUser.photoURL || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face',
              company: profile.company,
              title: profile.title,
              profileSetupCompleted: !!profile.profileSetupCompleted,
              bio: profile.bio || '',
              location: profile.location || '',
              website: profile.website || '',
              linkedin: profile.linkedin || '',
              github: profile.github || '',
              workStyle: profile.workStyle || '',
              roleLevel: profile.roleLevel || '',
              salaryRange: profile.salaryRange || '',
              relocation: profile.relocation || '',
              hiringPriority: profile.hiringPriority || '',
              skills: profile.skills,
            }
            setUser({ id: firebaseUser.uid, ...initialUser })

            // Create user document in Firestore
            setDoc(doc(db, 'users', firebaseUser.uid), initialUser)
              .catch(err => console.error('Error initializing user doc in Firestore:', err))
          }
        }, (error) => {
          console.error('Error in user doc snapshot listener:', error)
        })
      } else {
        setUser(null)
      }
    })

    return () => {
      unsubscribeAuth()
      if (unsubUserDoc) {
        unsubUserDoc()
      }
    }
  }, [])

  useEffect(() => {
    if (!user || user.role !== 'applicant') {
      setAiMatchScores({})
      setMatchedJobs(null)
      return
    }

    const fetchModelMatches = async () => {
      setLoadingAiMatches(true)
      try {
        const resumeText = user.resumeText ||
          [user.title, user.roleLevel, user.workStyle, user.bio, user.location, user.github].filter(Boolean).join('\n') ||
          'No resume details provided.'

        const res = await fetch(`${BACKEND_URL}/api/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume_text: resumeText,
            demographic_group: 0,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const scoreMap: Record<string, number> = {}
          data.recommendations?.forEach((rec: any) => {
            const key = `${rec.job_title.toLowerCase().trim()}_${rec.company.toLowerCase().trim()}`
            scoreMap[key] = Math.round(rec.similarity_score * 100)
          })
          setAiMatchScores(scoreMap)
          setMatchedJobs(data.recommendations || [])
        }
      } catch (err) {
        console.error('Failed to fetch model matches:', err)
      } finally {
        setLoadingAiMatches(false)
      }
    }

    fetchModelMatches()
  }, [user, jobs])



  const addApplicantApplication = async (app: any) => {
    if (user?.role === 'recruiter') {
      return
    }
    try {
      await setDoc(doc(db, 'applicantApplications', app.id), app)
    } catch (err) {
      console.error('Error adding application to Firestore:', err)
    }
  }

  const toggleDarkMode = () => setDarkMode(prev => !prev)

  return (
    <AppContext.Provider value={{
      user, setUser, darkMode, toggleDarkMode, sidebarOpen, setSidebarOpen,
      jobs, candidates, notifications,
      applicantApplications, applicationChartData, recruiterHiringData,
      recruiterJobPostings, sourceData, monthlyHireData, companies, loadingData,
      allUsers,
      aiMatchScores,
      loadingAiMatches,
      matchedJobs,
      addApplicantApplication
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
