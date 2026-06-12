import React, { useState } from 'react'
import { X, FolderInput, GitBranch } from 'lucide-react'
import './ImportModal.css'

interface ImportModalProps {
  onClose: () => void
  onImport: (type: 'local' | 'github', payload: string) => void
}

export default function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<'local' | 'github'>('local')
  const [payload, setPayload] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payload.trim()) return
    onImport(activeTab, payload.trim())
  }

  return (
    <div className="import-modal-overlay">
      <div className="import-modal-content">
        <button className="import-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <h2 className="import-modal-title">Import Project Structure</h2>
        <p className="import-modal-desc">
          Point DEVKARM at an existing codebase to instantly generate a unified architectural graph.
        </p>

        <div className="import-tabs">
          <button
            className={`import-tab ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => { setActiveTab('local'); setPayload('') }}
          >
            <FolderInput size={16} /> Local Folder
          </button>
          <button
            className={`import-tab ${activeTab === 'github' ? 'active' : ''}`}
            onClick={() => { setActiveTab('github'); setPayload('') }}
          >
            <GitBranch size={16} /> Git Repo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="import-form">
          <div className="import-input-group">
            <label>
              {activeTab === 'local' ? 'Absolute Folder Path' : 'GitHub Repository URL'}
            </label>
            <input
              type="text"
              autoFocus
              placeholder={
                activeTab === 'local'
                  ? 'e.g. C:\\Projects\\my-app or /Users/name/my-app'
                  : 'e.g. https://github.com/Abhishek4411/DEVKARM'
              }
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </div>

          <div className="import-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={!payload.trim()}>
              Import Codebase
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
