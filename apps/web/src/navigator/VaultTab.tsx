import { useState, useEffect } from 'react'
import { Lock, Plus, Trash2 } from 'lucide-react'
import './VaultTab.css'

interface SecretSafe {
  id: string;
  project_id: string;
  key_name: string;
  environment: string;
  created_by: string;
  created_at: string;
}

interface Props {
  projectId: string;
}

export default function VaultTab({ projectId }: Props) {
  const [secrets, setSecrets] = useState<SecretSafe[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newEnv, setNewEnv] = useState('development')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectId) return;
    fetchSecrets();
  }, [projectId]);

  async function fetchSecrets() {
    try {
      const res = await fetch(`http://localhost:3000/api/projects/${projectId}/secrets`, {
        // Add Bearer token here if global auth context gives token, but currently local
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        const data = await res.json()
        setSecrets(data)
      }
    } catch (e) {
      console.error('Failed to fetch secrets')
    }
  }

  async function handleAddSecret() {
    if (!newKey.trim() || !newValue.trim() || !projectId) return
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3000/api/projects/${projectId}/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_name: newKey, value: newValue, environment: newEnv })
      })
      if (res.ok) {
        const newSecret = await res.json()
        setSecrets(prev => [newSecret, ...prev])
        setNewKey('')
        setNewValue('')
        setShowForm(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteSecret(id: string) {
    try {
      const res = await fetch(`http://localhost:3000/api/secrets/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSecrets(prev => prev.filter(s => s.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (!projectId) {
    return <div className="vault-tab"><div className="vault-empty">Please open a project first.</div></div>;
  }

  return (
    <div className="vault-tab">
      <div className="vault-tab__header">
        <div className="vault-tab__title-row">
          <Lock size={13} color="#66fcf1" />
          <span>Secret Vault</span>
        </div>
        <button className="vault-add-btn" onClick={() => setShowForm(v => !v)} title="Add Secret">
          <Plus size={14} />
        </button>
      </div>

      {showForm && (
        <div className="vault-form">
          <input
            className="vault-input"
            placeholder="Key Name (e.g., OPENAI_API_KEY)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
          />
          <input
            type="password"
            className="vault-input"
            placeholder="Secret Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <select
            className="vault-select"
            value={newEnv}
            onChange={(e) => setNewEnv(e.target.value)}
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
          <div className="vault-form-actions">
            <button className="vault-btn vault-btn--primary" onClick={handleAddSecret} disabled={loading}>
              Save
            </button>
            <button className="vault-btn vault-btn--ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="vault-list">
        {secrets.length === 0 && !showForm && (
          <div className="vault-empty">No secrets configured for this project.</div>
        )}
        {secrets.map(s => (
          <div key={s.id} className="vault-card">
            <div className="vault-card__top">
              <span className="vault-card__key">{s.key_name}</span>
              <button 
                className="vault-action-btn" 
                onClick={() => handleDeleteSecret(s.id)}
                title="Delete Secret"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div>
              <span className="vault-card__env">{s.environment}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
