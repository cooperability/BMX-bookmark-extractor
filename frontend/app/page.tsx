'use client'

import { useState } from 'react'
import { FileUploader } from '../components/FileUploader'
import { ExportOptions } from '../components/ExportOptions'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [exportFormat, setExportFormat] = useState<'anki' | 'csv' | 'text'>('anki')

  const handleExport = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('format', exportFormat)

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge_export.${exportFormat === 'anki' ? 'txt' : exportFormat}`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">BMX Knowledge Export</h1>
        
        <FileUploader 
          file={file} 
          onFileSelect={setFile} 
        />

        <ExportOptions 
          format={exportFormat}
          onFormatChange={setExportFormat}
        />

        <button
          onClick={handleExport}
          disabled={!file}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Export
        </button>
      </div>
    </main>
  )
}