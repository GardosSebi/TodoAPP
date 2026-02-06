'use client'

import { useState, useRef } from 'react'
import { Dialog } from '@headlessui/react'
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ImportTask {
  titlu: string
  termen: string
  prioritate: string | number
  descriere: string
}

interface ImportTasksModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (tasks: ImportTask[]) => Promise<void>
  projectId: string
}

export default function ImportTasksModal({
  isOpen,
  onClose,
  onImport,
  projectId,
}: ImportTasksModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewTasks, setPreviewTasks] = useState<ImportTask[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase()
    if (fileExtension !== 'xlsx' && fileExtension !== 'xls' && fileExtension !== 'csv') {
      setErrors(['Formatul fișierului nu este suportat. Te rugăm să folosești Excel (.xlsx, .xls) sau CSV (.csv)'])
      return
    }

    setFile(selectedFile)
    setErrors([])
    setPreviewTasks([])
    setImportResult(null)

    // Parse file
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) return

        let workbook: XLSX.WorkBook
        if (fileExtension === 'csv') {
          const text = data as string
          workbook = XLSX.read(text, { type: 'string' })
        } else {
          workbook = XLSX.read(data, { type: 'binary' })
        }

        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

        if (jsonData.length === 0) {
          setErrors(['Fișierul este gol'])
          return
        }

        // First row should be headers
        const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim())
        
        // Find column indices
        const titluIndex = headers.findIndex((h: string) => 
          h.includes('titlu') || h.includes('title') || h.includes('nume')
        )
        const termenIndex = headers.findIndex((h: string) => 
          h.includes('termen') || h.includes('deadline') || h.includes('due') || h.includes('data')
        )
        const prioritateIndex = headers.findIndex((h: string) => 
          h.includes('prioritate') || h.includes('priority') || h.includes('prior')
        )
        const descriereIndex = headers.findIndex((h: string) => 
          h.includes('descriere') || h.includes('description') || h.includes('notes') || h.includes('nota')
        )

        if (titluIndex === -1) {
          setErrors(['Nu s-a găsit coloana "titlu" în fișier. Te rugăm să verifici că prima linie conține header-ele.'])
          return
        }

        // Parse rows
        const parsedTasks: ImportTask[] = []
        const parseErrors: string[] = []

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          const titlu = String(row[titluIndex] || '').trim()
          
          if (!titlu) {
            // Skip empty rows
            continue
          }

          const termen = termenIndex !== -1 ? String(row[termenIndex] || '').trim() : ''
          const prioritate = prioritateIndex !== -1 ? (row[prioritateIndex] || '') : ''
          const descriere = descriereIndex !== -1 ? String(row[descriereIndex] || '').trim() : ''

          // Validate and parse priority
          let priorityValue: string | number = ''
          if (prioritate) {
            const priorityStr = String(prioritate).toLowerCase().trim()
            if (priorityStr === 'ridicată' || priorityStr === 'high' || priorityStr === '3' || priorityStr === 'ridicata') {
              priorityValue = 3
            } else if (priorityStr === 'medie' || priorityStr === 'medium' || priorityStr === '2') {
              priorityValue = 2
            } else if (priorityStr === 'scăzută' || priorityStr === 'low' || priorityStr === '1' || priorityStr === 'scazuta') {
              priorityValue = 1
            } else if (priorityStr === 'fără' || priorityStr === 'none' || priorityStr === '0' || priorityStr === 'fara') {
              priorityValue = 0
            } else {
              // Try to parse as number
              const num = parseInt(priorityStr)
              if (!isNaN(num) && num >= 0 && num <= 3) {
                priorityValue = num
              } else {
                priorityValue = 0
              }
            }
          } else {
            priorityValue = 0
          }

          // Validate date
          let dateValue = ''
          if (termen) {
            try {
              let dateStr = String(termen).trim()
              let parsed = false
              
              // First, check if it's a text format with dots or slashes (dd.mm.yyyy, dd/mm/yyyy, etc.)
              const dotDatePattern = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/
              const slashDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
              const dashDatePattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
              
              const dotMatch = dateStr.match(dotDatePattern)
              const slashMatch = dateStr.match(slashDatePattern)
              const dashMatch = dateStr.match(dashDatePattern)
              
              if (dotMatch) {
                // Format: dd.mm.yyyy or dd.mm.yy
                let day = parseInt(dotMatch[1], 10)
                let month = parseInt(dotMatch[2], 10)
                let year = parseInt(dotMatch[3], 10)
                
                // Convert 2-digit year to 4-digit (assuming 2000-2099)
                if (year < 100) {
                  year = year < 50 ? 2000 + year : 1900 + year
                }
                
                // Validate day and month
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                  // Create date in ISO format (yyyy-mm-dd)
                  const isoDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const date = new Date(isoDateStr)
                  if (!isNaN(date.getTime())) {
                    dateValue = date.toISOString().split('T')[0]
                    parsed = true
                  }
                }
              } else if (slashMatch) {
                // Format: dd/mm/yyyy or dd/mm/yy
                let day = parseInt(slashMatch[1], 10)
                let month = parseInt(slashMatch[2], 10)
                let year = parseInt(slashMatch[3], 10)
                
                // Convert 2-digit year to 4-digit
                if (year < 100) {
                  year = year < 50 ? 2000 + year : 1900 + year
                }
                
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                  const isoDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const date = new Date(isoDateStr)
                  if (!isNaN(date.getTime())) {
                    dateValue = date.toISOString().split('T')[0]
                    parsed = true
                  }
                }
              } else if (dashMatch) {
                // Format: yyyy-mm-dd (ISO)
                const date = new Date(dateStr)
                if (!isNaN(date.getTime())) {
                  dateValue = date.toISOString().split('T')[0]
                  parsed = true
                }
              } else {
                // Try standard Date parsing
                const date = new Date(dateStr)
                if (!isNaN(date.getTime())) {
                  dateValue = date.toISOString().split('T')[0]
                  parsed = true
                } else {
                  // Last resort: Check if it's an Excel serial date (numeric value without dots/slashes)
                  // Only if the original value doesn't contain dots, slashes, or dashes
                  if (!dateStr.includes('.') && !dateStr.includes('/') && !dateStr.includes('-')) {
                    const numericValue = parseFloat(dateStr)
                    if (!isNaN(numericValue) && numericValue > 0 && numericValue < 1000000 && numericValue === Math.floor(numericValue)) {
                      // Excel serial date: 1 = January 1, 1900
                      // Excel epoch is 1899-12-30 (Excel incorrectly treats 1900 as a leap year)
                      const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
                      const jsDate = new Date(excelEpoch.getTime() + numericValue * 24 * 60 * 60 * 1000)
                      
                      if (!isNaN(jsDate.getTime())) {
                        dateValue = jsDate.toISOString().split('T')[0]
                        parsed = true
                      }
                    }
                  }
                }
              }
              
              if (!parsed) {
                parseErrors.push(`Linia ${i + 1}: Formatul datei "${termen}" nu este valid`)
              }
            } catch (e) {
              parseErrors.push(`Linia ${i + 1}: Formatul datei "${termen}" nu este valid`)
            }
          }

          parsedTasks.push({
            titlu,
            termen: dateValue,
            prioritate: priorityValue,
            descriere,
          })
        }

        if (parsedTasks.length === 0) {
          setErrors(['Nu s-au găsit sarcini valide în fișier'])
          return
        }

        setPreviewTasks(parsedTasks)
        if (parseErrors.length > 0) {
          setErrors(parseErrors.slice(0, 10)) // Show first 10 errors
        }
      } catch (error: any) {
        setErrors([`Eroare la parsarea fișierului: ${error.message}`])
      }
    }

    if (fileExtension === 'csv') {
      reader.readAsText(selectedFile)
    } else {
      reader.readAsBinaryString(selectedFile)
    }
  }

  const handleImport = async () => {
    if (previewTasks.length === 0) return

    setIsImporting(true)
    setImportResult(null)

    try {
      await onImport(previewTasks)
      setImportResult({ success: previewTasks.length, failed: 0 })
      
      // Reset after 2 seconds
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (error: any) {
      setImportResult({ success: 0, failed: previewTasks.length })
      setErrors([`Eroare la import: ${error.message}`])
    } finally {
      setIsImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreviewTasks([])
    setErrors([])
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
              Import Sarcini
            </Dialog.Title>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Selectează fișierul (Excel sau CSV)
              </label>
              <label
                htmlFor="file-upload"
                className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
              >
                <div className="space-y-1 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Selectează un fișier</span>
                    <span className="pl-1">sau trage-l aici</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Excel (.xlsx, .xls) sau CSV (.csv)
                  </p>
                  {file && (
                    <p className="text-sm text-gray-900 dark:text-white mt-2">
                      {file.name}
                    </p>
                  )}
                </div>
                <input
                  id="file-upload"
                  ref={fileInputRef}
                  name="file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            {/* Format Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                Format așteptat:
              </h3>
              <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
                Prima linie trebuie să conțină header-ele: <strong>titlu</strong>, <strong>termen</strong>, <strong>prioritate</strong>, <strong>descriere</strong>
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
                <strong>Termen</strong> poate fi în format: <strong>dd.mm.yyyy</strong> (ex: 20.02.2026), <strong>dd/mm/yyyy</strong> 
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Prioritatea poate fi: 0 (fără), 1 (scăzută), 2 (medie), 3 (ridicată) sau text (fără/scăzută/medie/ridicată)
              </p>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
                      Erori:
                    </h3>
                    <ul className="text-xs text-red-800 dark:text-red-300 space-y-1">
                      {errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Success Result */}
            {importResult && importResult.success > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                  <p className="text-sm text-green-900 dark:text-green-200">
                    {importResult.success} {importResult.success === 1 ? 'sarcină importată' : 'sarcini importate'} cu succes!
                  </p>
                </div>
              </div>
            )}

            {/* Preview */}
            {previewTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Preview ({previewTasks.length} {previewTasks.length === 1 ? 'sarcină' : 'sarcini'}):
                </h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Titlu
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Termen
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Prioritate
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Descriere
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {previewTasks.slice(0, 10).map((task, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                              {task.titlu}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                              {task.termen || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                              {task.prioritate}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                              {task.descriere || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewTasks.length > 10 && (
                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 text-center">
                      ... și încă {previewTasks.length - 10} sarcini
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Anulează
            </button>
            <button
              onClick={handleImport}
              disabled={previewTasks.length === 0 || isImporting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Se importă...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importă {previewTasks.length > 0 && `(${previewTasks.length})`}
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

