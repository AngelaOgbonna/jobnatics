import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Layout } from './Layout'
import {
  Bell, Sparkles, MessageSquare, Briefcase, Calendar, Gift, Settings,
  CheckCheck, Trash2, Filter, X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

const typeIcons: Record<string, React.FC<any>> = {
  match: Sparkles,
  application: Briefcase,
  message: MessageSquare,
  interview: Calendar,
  offer: Gift,
  system: Settings,
}

const typeColors: Record<string, string> = {
  match: 'bg-primary/15 text-primary border-primary/30',
  application: 'bg-accent/15 text-accent border-accent/30',
  message: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  interview: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  offer: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  system: 'bg-muted text-muted-foreground border-border',
}

export function Notifications() {
  const { user, notifications } = useApp()
  const [activeFilter, setActiveFilter] = useState<string>('All')

  const filters = ['All', 'Unread', 'Matches', 'Applications', 'Messages', 'Interviews']
  const unreadCount = notifications.filter(n => !n.read).length

  const filtered = notifications.filter(n => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Unread') return !n.read
    if (activeFilter === 'Matches') return n.type === 'match'
    if (activeFilter === 'Applications') return n.type === 'application'
    if (activeFilter === 'Messages') return n.type === 'message'
    if (activeFilter === 'Interviews') return n.type === 'interview'
    return true
  })

  const markAllRead = async () => {
    const promises = notifications.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }))
    await Promise.all(promises)
  }

  const dismiss = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id))
  }

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true })
  }

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700 }}>Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'You\'re all caught up!'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-border hover:bg-muted transition-colors group"
            >
              <CheckCheck size={16} strokeWidth={1.75} className="transition-transform group-hover:scale-105 text-muted-foreground group-hover:text-foreground" /> Mark all read
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeFilter === f
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}
            >
              {f}
              {f === 'Unread' && unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(notif => {
              const Icon = typeIcons[notif.type] || Bell
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  onClick={() => markRead(notif.id)}
                  className={`relative flex gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${
                    !notif.read
                      ? 'bg-card border-primary/20 shadow-sm shadow-primary/5'
                      : 'bg-card border-border hover:border-primary/20'
                  }`}
                >
                  {!notif.read && (
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
                  )}

                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${typeColors[notif.type]}`}>
                    <Icon size={18} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} />
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`text-sm font-semibold leading-tight ${notif.read ? 'text-foreground' : 'text-foreground'}`}>
                        {notif.title}
                      </h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{notif.description}</p>
                    {notif.actionLabel && (
                      <button className="mt-2 text-xs text-primary font-medium hover:underline">
                        {notif.actionLabel} →
                      </button>
                    )}
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); dismiss(notif.id) }}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted/0 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all group/del"
                  >
                    <X size={12} strokeWidth={1.75} className="transition-transform group-hover/del:rotate-90" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-16 group">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <Bell size={24} strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} className="text-muted-foreground transition-transform duration-500 group-hover:rotate-12" />
              </div>
              <h3 className="font-semibold mb-2">No notifications</h3>
              <p className="text-sm text-muted-foreground">
                {activeFilter === 'Unread' ? "You're all caught up! No unread notifications." : "No notifications in this category."}
              </p>
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="mt-6 text-center">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Load more notifications
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
