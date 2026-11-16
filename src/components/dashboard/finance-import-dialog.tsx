'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import type { ImportResult } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'

export interface FinanceImportDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  expectedColumns: string[]
  onImportFile: (file: File, mode: 'upsert' | 'replace') => Promise<ImportResult>
  onImported?: () => void
  downloadTemplate?: () => void
}

export function FinanceImportDialog({
  open,
  onOpenChange,
  title,
  description,
  expectedColumns,
  onImportFile,
  onImported,
  downloadTemplate,
}: FinanceImportDialogProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'upsert' | 'replace'>('upsert')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setLoading(true)
    setResult(null)
    try {
      const r = await onImportFile(file, mode)
      setResult(r)
      toast({
        title: 'Import complete',
        description: `${r.inserted} inserted, ${r.updated} updated, ${r.skipped} skipped`,
      })
      onImported?.()
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  function close() {
    if (loading) return
    setResult(null)
    setFileName(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Expected columns */}
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium mb-1.5">Expected columns in your file:</p>
            <div className="flex flex-wrap gap-1">
              {expectedColumns.map((col) => (
                <code
                  key={col}
                  className="rounded bg-background px-1.5 py-0.5 text-[11px] border"
                >
                  {col}
                </code>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Accepted formats: <code className="text-[10px]">.xlsx</code>,{' '}
              <code className="text-[10px]">.csv</code>. Month format:{' '}
              <code className="text-[10px]">YYYY-MM</code> (e.g. 2025-01).
            </p>
          </div>

          {/* Mode selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Import Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as 'upsert' | 'replace')}
              className="grid gap-2"
            >
              <label
                htmlFor={`mode-upsert-${title}`}
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem
                  value="upsert"
                  id={`mode-upsert-${title}`}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Upsert (Recommended)</p>
                  <p className="text-xs text-muted-foreground">
                    Update existing entries (matched by Location Type + Code + Month),
                    insert new ones.
                  </p>
                </div>
              </label>
              <label
                htmlFor={`mode-replace-${title}`}
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem
                  value="replace"
                  id={`mode-replace-${title}`}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-destructive">Replace All</p>
                  <p className="text-xs text-muted-foreground">
                    Delete ALL existing entries and re-import. Cannot be undone.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* File upload */}
          <div className="rounded-md border border-dashed p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Upload file</p>
                <p className="text-xs text-muted-foreground">
                  Select a .xlsx or .csv file
                </p>
              </div>
              <Button asChild variant="outline" size="sm" disabled={loading}>
                <label className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Choose file
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </label>
              </Button>
            </div>
            {fileName && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium">{fileName}</span>
              </p>
            )}
            {downloadTemplate && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={downloadTemplate}
              >
                Download CSV template
              </Button>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Import summary
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Inserted</p>
                  <p className="text-lg font-bold text-emerald-600">{result.inserted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="text-lg font-bold text-primary">{result.updated}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                  <p className="text-lg font-bold text-muted-foreground">{result.skipped}</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {result.errors.length} error(s) occurred
                </p>
              )}
              {result.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    View error details
                  </summary>
                  <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto text-destructive">
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={loading}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
