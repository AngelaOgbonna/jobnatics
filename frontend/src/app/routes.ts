import { createHashRouter, redirect } from 'react-router'
import { LandingPage } from './components/LandingPage'
import { AuthPage } from './components/AuthPage'
import { ApplicantDashboard } from './components/ApplicantDashboard'
import { RecruiterDashboard } from './components/RecruiterDashboard'
import { JobListings } from './components/JobListings'
import { JobDetails } from './components/JobDetails'
import { Notifications } from './components/Notifications'

import { CandidateProfile } from './components/CandidateProfile'
import { CompanyProfile } from './components/CompanyProfile'
import { Settings } from './components/Settings'
import { ProfileSetup } from './components/ProfileSetup'
import { PostJob } from './components/PostJob'

export const router = createHashRouter([
  { path: '/', Component: LandingPage },
  { path: '/auth', Component: AuthPage },
  { path: '/app/applicant', Component: ApplicantDashboard },
  { path: '/app/recruiter', Component: RecruiterDashboard },
  { path: '/jobs', Component: JobListings },
  { path: '/jobs/:id', Component: JobDetails },
  { path: '/notifications', Component: Notifications },
  { path: '/profile/:id', Component: CandidateProfile },
  { path: '/company/:id', Component: CompanyProfile },
  { path: '/settings', Component: Settings },
  { path: '/profile-setup', Component: ProfileSetup },
  { path: '/post-job', Component: PostJob },
  { path: '*', loader: () => redirect('/') },
])
