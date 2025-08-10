
import React, { useEffect, useRef, useState } from 'react'

type FileMeta = {
  id: string
  originalName: string
  storedName: string
  extension: string
  size: number
  mime: string
  uploadedAt: string
}

type Uploading = {
  file: File
  progress: number
  status: 'queued'|'uploading'|'done'|'error'
  error?: string
}

function formatBytes(bytes: number) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
}

export default function App() {
  const [files, setFiles] = useState<FileMeta[]>([])
  const [uploading, setUploading] = useState<Uploading[]>([])
  const dropRef = useRef<HTMLDivElement>(null)

  async function loadList() {
    const res = await fetch('/api/files')
    const data = await res.json()
    setFiles(data.files || [])
  }

  useEffect(() => {
    loadList()
  }, [])

  function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    startUploads(Array.from(e.target.files))
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const dt = e.dataTransfer
    const dropped = dt.files ? Array.from(dt.files) : []
    if (dropped.length) startUploads(dropped)
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (dropRef.current) dropRef.current.classList.add('ring-blue-400')
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (dropRef.current) dropRef.current.classList.remove('ring-blue-400')
  }

  function startUploads(list: File[]) {
    const items: Uploading[] = list.map(f => ({
      file: f, progress: 0, status: 'queued'
    }))
    setUploading(prev => [...items, ...prev])
    items.forEach(uploadOne)
  }

  async function uploadOne(item: Uploading) {
    item.status = 'uploading'
    setUploading(prev => [...prev])

    const form = new FormData()
    form.append('files', item.file)

    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/upload', true)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          item.progress = Math.round((e.loaded / e.total) * 100)
          setUploading(prev => [...prev])
        }
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          item.status = 'done'
          item.progress = 100
          setUploading(prev => [...prev])
          await loadList()
        } else {
          item.status = 'error'
          try {
            const err = JSON.parse(xhr.responseText)
            item.error = err?.error || 'Upload failed.'
          } catch {
            item.error = 'Upload failed.'
          }
          setUploading(prev => [...prev])
        }
      }

      xhr.onerror = () => {
        item.status = 'error'
        item.error = 'Network error.'
        setUploading(prev => [...prev])
      }

      xhr.send(form)
    } catch (e: any) {
      item.status = 'error'
      item.error = e?.message || 'Upload failed.'
      setUploading(prev => [...prev])
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this file?')) return
    const res = await fetch('/api/files/' + id, { method: 'DELETE' })
    if (res.ok) {
      await loadList()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Delete failed')
    }
  }

  return (
    <div className="min-h-screen text-gray-900">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">File Upload</h1>
          <a href="https://example.com" target="_blank" className="text-sm text-gray-500 hover:text-gray-700">v1.0</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="mb-8">
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className="bg-white border-2 border-dashed rounded-2xl p-8 text-center ring-0 transition-all"
          >
            <div className="mx-auto max-w-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 15a4 4 0 004 4h10a4 4 0 100-8h-1.26A8 8 0 103 15z" />
              </svg>
              <h2 className="mt-4 text-lg font-medium">Drag & Drop files here</h2>
              <p className="text-sm text-gray-500">or click to browse</p>
              <div className="mt-4">
                <label className="inline-flex items-center px-4 py-2 rounded-xl bg-black text-white text-sm cursor-pointer hover:opacity-90">
                  <input type="file" className="hidden" multiple onChange={onChoose} />
                  Choose files
                </label>
              </div>
            </div>
          </div>
        </section>

        {uploading.length > 0 && (
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Uploads</h3>
            <div className="space-y-3">
              {uploading.map((u, idx) => (
                <div key={idx} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{u.file.name}</div>
                      <div className="text-xs text-gray-500">{formatBytes(u.file.size)}</div>
                    </div>
                    <div className="text-sm">
                      {u.status === 'uploading' && <span className="text-blue-600">{u.progress}%</span>}
                      {u.status === 'done' && <span className="text-green-700">Done</span>}
                      {u.status === 'error' && <span className="text-red-600">Error</span>}
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black transition-all"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                  {u.error && <div className="mt-2 text-xs text-red-600">{u.error}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Files</h3>
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Size</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Uploaded</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No files yet.</td>
                  </tr>
                ) : (
                  files.map(f => (
                    <tr key={f.id} className="border-t">
                      <td className="px-4 py-3">{f.originalName}</td>
                      <td className="px-4 py-3">{formatBytes(f.size)}</td>
                      <td className="px-4 py-3">{f.mime}</td>
                      <td className="px-4 py-3">{new Date(f.uploadedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <a
                          className="inline-flex items-center px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                          href={`/api/files/${f.id}/download`}
                        >
                          Download
                        </a>
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="text-center text-xs text-gray-500 py-8">
        Built with Express + React + Tailwind
      </footer>
    </div>
  )
}
