import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Loader2, AlertCircle, Globe, FunctionSquare, Variable } from 'lucide-react'
import { fetchProjects, createProject, type Project } from '../lib/api'
import './ProjectSelector.css'

interface Props {
  onSelect: (project: Project) => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  'web-app':  <Globe size={14} />,
  'function': <FunctionSquare size={14} />,
  'lib':      <Variable size={14} />,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProjectSelector({ onSelect }: Props) {
  const [projects, setProjects]   = useState<Project[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [creating, setCreating]   = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newDesc, setNewDesc]     = useState('')

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const project = await createProject({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        project_type: 'web-app',
      })
      onSelect(project)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="ps-backdrop">
      <div className="ps-card">
        {/* Logo */}
        <div className="ps-logo">DEVKARM</div>
        <div className="ps-tagline">Code is Karma. Build is Dharma.</div>

        <h2 className="ps-heading">Your Projects</h2>

        {/* Loading */}
        {loading && (
          <div className="ps-status">
            <Loader2 size={18} className="ps-spinner" />
            <span>Loading projects…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="ps-error">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Project list */}
        {!loading && projects.length === 0 && !showForm && (
          <p className="ps-empty">No projects yet. Create one below.</p>
        )}

        {!loading && projects.length > 0 && (
          <ul className="ps-list">
            {projects.map((p) => (
              <li key={p.id} className="ps-item" onClick={() => onSelect(p)}>
                <span className="ps-item-icon">
                  {TYPE_ICONS[p.project_type] ?? <FolderOpen size={14} />}
                </span>
                <span className="ps-item-name">{p.name}</span>
                <span className="ps-item-type">{p.project_type}</span>
                <span className="ps-item-date">{formatDate(p.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Create form */}
        {showForm ? (
          <form className="ps-form" onSubmit={handleCreate}>
            <input
              className="ps-input"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              required
            />
            <input
              className="ps-input"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="ps-form-actions">
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={() => { setShowForm(false); setNewName(''); setNewDesc('') }}
              >
                Cancel
              </button>
              <button type="submit" className="ps-btn ps-btn--primary" disabled={creating}>
                {creating ? <Loader2 size={14} className="ps-spinner" /> : <Plus size={14} />}
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        ) : (
          <button className="ps-btn ps-btn--primary ps-btn--new" onClick={() => setShowForm(true)}>
            <Plus size={14} />
            New Project
          </button>
        )}
      </div>
    </div>
  )
}
