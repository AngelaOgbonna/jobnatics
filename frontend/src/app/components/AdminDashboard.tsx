import { useState, useEffect } from 'react'
import { Layout } from './Layout'
import { useApp } from '../context/AppContext'
import { Settings, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { BACKEND_URL } from '../firebase'

export function AdminDashboard() {
  const { user } = useApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({
    DIR_threshold: 0.80,
    DPD_threshold: 0.10,
    top_n_cohort: 100,
    top_n_recommended: 10
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${BACKEND_URL}/api/config/fairness`)
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      } else {
        toast.error('Failed to load fairness configuration.')
      }
    } catch (err) {
      toast.error('Error connecting to backend.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch(`${BACKEND_URL}/api/config/fairness`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })

      if (res.ok) {
        toast.success('Fairness configuration updated successfully!')
      } else {
        toast.error('Failed to save configuration.')
      }
    } catch (err) {
      toast.error('Error connecting to backend.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 p-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">System Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Manage global AI model parameters and fairness thresholds. Changes take effect immediately without requiring a restart.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border/40 bg-muted/10 flex items-center gap-3">
              <Settings size={20} className="text-primary" />
              <h2 className="text-lg font-semibold">Fairness Model Configuration</h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* DIR Threshold */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-foreground">
                    Disparate Impact Ratio (DIR) Minimum
                  </label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The minimum acceptable ratio of favorable outcomes for unprivileged groups. (e.g. 0.80 = 80% rule)
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1.5"
                      value={config.DIR_threshold}
                      onChange={(e) => setConfig({ ...config, DIR_threshold: parseFloat(e.target.value) })}
                      className="w-32 px-3 py-2 rounded-lg bg-muted/30 border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-mono"
                    />
                  </div>
                </div>

                {/* DPD Threshold */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-foreground">
                    Demographic Parity Difference (DPD) Maximum
                  </label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The maximum acceptable difference in selection rates between demographic groups. (e.g. 0.10 = 10% difference)
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={config.DPD_threshold}
                      onChange={(e) => setConfig({ ...config, DPD_threshold: parseFloat(e.target.value) })}
                      className="w-32 px-3 py-2 rounded-lg bg-muted/30 border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Top N Cohort */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-foreground">
                    AI Matcher Cohort Size (Top N)
                  </label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The number of top scoring candidates (from the pool of 5,000) passed into the fairlearn model for auditing.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="10"
                      max="5000"
                      value={config.top_n_cohort}
                      onChange={(e) => setConfig({ ...config, top_n_cohort: parseInt(e.target.value) })}
                      className="w-32 px-3 py-2 rounded-lg bg-muted/30 border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Top N Recommended */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-foreground">
                    Recommended Candidates Count
                  </label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The final number of candidates returned to the recruiter dashboard after fairness corrections.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={config.top_n_recommended}
                      onChange={(e) => setConfig({ ...config, top_n_recommended: parseInt(e.target.value) })}
                      className="w-32 px-3 py-2 rounded-lg bg-muted/30 border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-mono"
                    />
                  </div>
                </div>

              </div>

              <div className="pt-6 mt-6 border-t border-border/40 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
