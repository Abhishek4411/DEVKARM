import { useEffect, useRef, useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import './MigrationModal.css'

interface Props {
  sql: string
  onClose: () => void
}

export default function MigrationModal({ sql, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleCopy() {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="migration-overlay" onClick={onClose}>
      <div
        className="migration-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Generated SQL Migration"
      >
        {/* Header */}
        <div className="migration-modal__header">
          <span className="migration-modal__title">Generated SQL Migration</span>
          <div className="migration-modal__actions">
            <button
              className={`migration-modal__copy${copied ? ' migration-modal__copy--done' : ''}`}
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="migration-modal__close" onClick={onClose} title="Close (Esc)">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* SQL output */}
        <div className="migration-modal__body">
          <pre ref={preRef} className="migration-modal__sql">{sql}</pre>
        </div>

        <div className="migration-modal__footer">
          Press <kbd>Esc</kbd> to close · Copy and run against your dev database
        </div>
      </div>
    </div>
  )
}
