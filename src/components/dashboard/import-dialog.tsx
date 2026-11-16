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
import { importExcel, importExcelFile, type ImportResult } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported?: () => void
}) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'upsert' | 'replace'>('upsert')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleImportDefault() {
    setLoading(true)
    setResult(null)
    try {
      const r = await importExcel(mode)
      setResult(r)
      toast({
        title: 'Import complete',
        description: `SI: ${r.si.inserted + r.si.updated} | Spotlight: ${r.spotlight.inserted + r.spotlight.updated}`,
      })
      onImported?.()
    } catch (e) {
      toast({
        title: 'Import failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setLoading(true)
    setResult(null)
    try {
      const r = await importExcelFile(file)
      setResult(r)
      toast({
        title: 'Import complete',
        description: `SI: ${r.si.inserted + r.si.updated} | Spotlight: ${r.spotlight.inserted + r.spotlight.updated}`,
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
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Import Excel Data
          </DialogTitle>
          <DialogDescription>
            Import SI and Spotlight records from an Excel workbook. The file must
            have sheets named with &quot;SI&quot; and &quot;Spotlight&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Import Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as 'upsert' | 'replace')}
              className="grid gap-2"
            >
              <label
                htmlFor="mode-upsert"
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem value="upsert" id="mode-upsert" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Upsert (Recommended)</p>
                  <p className="text-xs text-muted-foreground">
                    Update existing records by unique code, insert new ones.
                  </p>
                </div>
              </label>
              <label
                htmlFor="mode-replace"
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem value="replace" id="mode-replace" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Replace All</p>
                  <p className="text-xs text-muted-foreground">
                    Delete all existing records and re-import. Cannot be undone.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="rounded-md border border-dashed p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Upload new Excel file</p>
                <p className="text-xs text-muted-foreground">
                  Select a .xlsx file from your computer
                </p>
              </div>
              <Button asChild variant="outline" size="sm" disabled={loading}>
                <label className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Choose file
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </label>
              </Button>
            </div>
            {fileName && (
              <p className="text-xs text-muted-foreground">Selected: {fileName}</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Or import from default file:</span>
            <code className="rounded bg-muted px-1.5 py-0.5">
              Toyota Location data (5).xlsx
            </code>
          </div>

          {result && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Import summary
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">SI Data</p>
                  <p className="text-xs">
                    Inserted: <b>{result.si.inserted}</b> | Updated:{' '}
                    <b>{result.si.updated}</b> | Skipped: <b>{result.si.skipped}</b>
                  </p>
                  {result.si.errors.length > 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {result.si.errors.length} errors
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Spotlight Data
                  </p>
                  <p className="text-xs">
                    Inserted: <b>{result.spotlight.inserted}</b> | Updated:{' '}
                    <b>{result.spotlight.updated}</b> | Skipped:{' '}
                    <b>{result.spotlight.skipped}</b>
                  </p>
                  {result.spotlight.errors.length > 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {result.spotlight.errors.length} errors
                    </p>
                  )}
                </div>
              </div>
              {((result.si.errors.length > 0) || (result.spotlight.errors.length > 0)) && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    View error details
                  </summary>
                  <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto text-destructive">
                    {result.si.errors.slice(0, 20).map((e, i) => (
                      <li key={`si-${i}`}>{e}</li>
                    ))}
                    {result.spotlight.errors.slice(0, 20).map((e, i) => (
                      <li key={`sp-${i}`}>{e}</li>
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
          <Button onClick={handleImportDefault} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import from Default File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
