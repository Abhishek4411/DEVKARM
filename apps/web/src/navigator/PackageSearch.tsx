import { useState, useEffect, useRef } from 'react'
import { Search, Package, X } from 'lucide-react'
import { useCanvasStore } from '../stores/canvas-store'
import { useFileStore } from '../stores/file-store'
import './PackageSearch.css'

const MEILI_URL = import.meta.env.VITE_MEILI_URL || 'http://localhost:7700'
const MEILI_KEY = import.meta.env.VITE_MEILI_KEY || 'devkarm_search_key'
const DEBOUNCE_MS = 300

interface NpmPackage {
  name: string
  version: string
  description: string
  keywords: string[]
}

async function searchPackages(query: string): Promise<NpmPackage[]> {
  if (!query.trim()) return []
  const res = await fetch(`${MEILI_URL}/indexes/packages/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MEILI_KEY}`,
    },
    body: JSON.stringify({ q: query, limit: 20 }),
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.hits as NpmPackage[]) ?? []
}

export default function PackageSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NpmPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addNode = useCanvasStore((s) => s.addNode)
  const activeFileId = useFileStore((s) => s.activeFileId)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const hits = await searchPackages(query)
        setResults(hits)
        if (hits.length === 0) setError('No packages found')
      } catch {
        setError('MeiliSearch unavailable — run docker compose up')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleDragStart(e: React.DragEvent, pkg: NpmPackage) {
    e.dataTransfer.setData('application/devkarm-node-type', 'packageNode')
    e.dataTransfer.setData('application/devkarm-package', JSON.stringify(pkg))
    e.dataTransfer.effectAllowed = 'copy'

    const ghost = document.createElement('div')
    ghost.className = 'pkg-drag-ghost'
    ghost.textContent = pkg.name
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 60, 18)
    requestAnimationFrame(() => document.body.removeChild(ghost))
  }

  function handleAddClick(pkg: NpmPackage) {
    if (!activeFileId) return
    const id = `package-${Date.now()}`
    addNode({
      id,
      type: 'packageNode',
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: { name: pkg.name, version: pkg.version, description: pkg.description },
    })
  }

  return (
    <div className="pkg-search">
      <div className="pkg-search__header">
        <Package size={14} className="pkg-search__header-icon" />
        <span>Package Search</span>
      </div>

      <div className="pkg-search__input-wrap">
        <Search size={13} className="pkg-search__input-icon" />
        <input
          className="pkg-search__input"
          type="text"
          placeholder="Search npm packages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        {query && (
          <button className="pkg-search__clear" onClick={() => setQuery('')} title="Clear">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="pkg-search__results">
        {loading && <p className="pkg-search__status">Searching…</p>}
        {!loading && error && <p className="pkg-search__status pkg-search__status--error">{error}</p>}
        {!loading && !error && results.map((pkg) => (
          <div
            key={pkg.name}
            className="pkg-result"
            draggable
            onDragStart={(e) => handleDragStart(e, pkg)}
            title="Drag to canvas or click +"
          >
            <div className="pkg-result__row">
              <span className="pkg-result__name">{pkg.name}</span>
              <span className="pkg-result__version">{pkg.version}</span>
              <button
                className="pkg-result__add"
                onClick={() => handleAddClick(pkg)}
                title="Add to canvas"
              >
                +
              </button>
            </div>
            {pkg.description && (
              <p className="pkg-result__desc">{pkg.description}</p>
            )}
          </div>
        ))}
        {!loading && !error && results.length === 0 && query && (
          <p className="pkg-search__status">Type to search packages…</p>
        )}
        {!query && (
          <p className="pkg-search__hint">Search indexed npm packages. Drag results onto the canvas.</p>
        )}
      </div>
    </div>
  )
}
