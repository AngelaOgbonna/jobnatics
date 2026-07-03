import { ReactNode, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useApp } from '../context/AppContext'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import {
  LayoutDashboard, Briefcase, FileText, Sparkles, MessageSquare,
  Bell, Bookmark, UserCircle, Settings, LogOut, Users, BarChart3,
  Moon, Sun, Menu, X, ChevronRight, Search, Zap, Building2,
} from 'lucide-react'

interface NavItem {
  label: string
  icon: React.ComponentType<{
    size?: number
    strokeWidth?: number
    fill?: string
    fillOpacity?: number
    className?: string
  }>
  path: string
  badge?: number
}

const applicantNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/app/applicant' },
  { label: 'Job Feed', icon: Briefcase, path: '/jobs' },
  { label: 'Applications', icon: FileText, path: '/app/applicant?tab=applications' },
  { label: 'Saved Jobs', icon: Bookmark, path: '/jobs?filter=saved' },
  { label: 'Profile', icon: UserCircle, path: '/profile/me' },
]

const recruiterNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/app/recruiter' },
  { label: 'Job Postings', icon: Briefcase, path: '/jobs' },
  { label: 'Company', icon: Building2, path: '/company/stripe' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, setUser, darkMode, toggleDarkMode, sidebarOpen, setSidebarOpen, companies, loadingData } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchFocused, setSearchFocused] = useState(false)

  const userCompany = companies.find(c =>
    c.postedBy === user?.id ||
    (user?.company && (c.id === user.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || c.name.toLowerCase() === user.company.toLowerCase()))
  )
  const companySlug = userCompany?.id ||
    (user?.company ? user.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'stripe')

  const dynamicRecruiterNav = recruiterNav.map(item => {
    if (item.label === 'Company') {
      return { ...item, path: `/company/${companySlug}` }
    }
    return item
  })

  const nav = user?.role === 'recruiter' ? dynamicRecruiterNav : applicantNav

  useEffect(() => {
    if (user && !loadingData) {
      const needsCompanySetup = user.role === 'recruiter' && !user.company && !companies.some(c => c.postedBy === user.id)
      const needsProfileSetup = !user.profileSetupCompleted

      if ((needsProfileSetup || needsCompanySetup) && location.pathname !== '/profile-setup') {
        navigate('/profile-setup')
      }
    }
  }, [user, companies, loadingData, location.pathname, navigate])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden lg:w-16'}
          bg-sidebar border-r border-sidebar-border`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 group cursor-pointer">
            <Zap size={16} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} className="text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <span className="font-bold text-sidebar-foreground whitespace-nowrap" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Jobnatics <span className="text-primary">AI</span>
              </span>
            </div>
          )}
        </div>

        {/* User role badge */}
        {sidebarOpen && user && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-primary capitalize">{user.role} Account</span>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon
              const active = (() => {
                const itemPathWithoutSearch = item.path.split('?')[0];
                const itemSearch = item.path.split('?')[1] || '';

                if (location.pathname !== itemPathWithoutSearch) return false;

                if (itemSearch) {
                  const params = new URLSearchParams(location.search);
                  const itemParams = new URLSearchParams(itemSearch);
                  for (const [key, val] of itemParams.entries()) {
                    if (params.get(key) !== val) return false;
                  }
                  return true;
                } else {
                  if (!location.search) return true;
                  const params = new URLSearchParams(location.search);
                  const hasOtherTab = params.has('tab') && params.get('tab') !== 'overview';
                  const hasOtherFilter = params.has('filter') && params.get('filter') !== 'all';
                  return !hasOtherTab && !hasOtherFilter;
                }
              })()
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative
                    ${active
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent'
                    }`}
                >
                  <Icon
                    size={18}
                    strokeWidth={active ? 2 : 1.75}
                    fill={active ? "currentColor" : "none"}
                    fillOpacity={0.15}
                    className={`flex-shrink-0 transition-all duration-200 group-hover:scale-110 group-active:scale-95 ${active ? 'text-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'}`}
                  />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-left text-sm font-medium whitespace-nowrap">{item.label}</span>
                      {item.badge && (
                        <span className="flex-shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {!sidebarOpen && item.badge && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150 group"
          >
            <Settings size={18} strokeWidth={1.75} className="flex-shrink-0 text-sidebar-foreground/60 group-hover:text-sidebar-foreground transition-transform duration-500 group-hover:rotate-90" />
            {sidebarOpen && <span className="text-sm font-medium">Settings</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-all duration-150 group"
          >
            <LogOut size={18} strokeWidth={1.75} className="flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
          {sidebarOpen && user && (
            <div className="flex items-center gap-3 px-3 py-3 mt-1 rounded-lg bg-sidebar-accent">
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/30" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center gap-4 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group"
          >
            {sidebarOpen ? (
              <X size={18} strokeWidth={1.75} className="transition-transform duration-200 group-hover:rotate-90" />
            ) : (
              <Menu size={18} strokeWidth={1.75} className="transition-transform duration-200 group-hover:scale-105" />
            )}
          </button>



          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={toggleDarkMode}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group"
            >
              {darkMode ? (
                <Sun size={18} strokeWidth={1.75} className="transition-transform duration-500 group-hover:rotate-90 group-hover:text-amber-400" />
              ) : (
                <Moon size={18} strokeWidth={1.75} className="transition-transform duration-500 group-hover:-rotate-12 group-hover:text-indigo-400" />
              )}
            </button>

            {user && (
              <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-muted transition-colors group">
                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-primary/30 group-hover:ring-primary transition-all" />
                <span className="text-sm font-medium hidden sm:block">{user.name.split(' ')[0]}</span>
                <ChevronRight size={14} strokeWidth={1.75} className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
