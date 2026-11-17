'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Phone,
  PhoneCall,
  RefreshCw,
  Search,
  Upload,
  Trash2,
  Plus,
  Radio,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ---- Types ----

type VmnStatus = 'live' | 'si_only' | 'spotlight_only'

interface VmnAssignment {
  vmn: string
  status: VmnStatus
  si?: {
    siCode: string
    clientCode: string
    businessName: string | null
    city: string | null
    state: string | null
    isLive: boolean
  } | null
  spotlight?: {
    clientCode: string
    name: string | null
    city: string | null
    state: string | null
    isLive: boolean
  } | null
}

interface VmnDataResponse {
  assignments: VmnAssignment[]
  summary: {
    totalVmns: number
    live: number
    siOnly: number
    spotlightOnly: number
    siWithoutVmn: number
    spotlightWithoutVmn: number
  }
}

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

function StatusBadge({ status }: { status: VmnStatus }) {
  if (status === 'live')
    return (
      <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15">
        <Radio className="h-3 w-3" /> Live
      </Badge>
    )
  if (status === 'si_only')
    return (
      <Badge variant="outline" className="gap-1 text-blue-600 border-blue-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> SI only
      </Badge>
    )
  return (
    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Spotlight only
    </Badge>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  hint?: string
  accent: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            {label}
          </p>
          <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center', accent)}>
            {icon}
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function VmnDataTab() {
  const { toast } = useToast()
  const [data, setData] = useState<VmnDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | VmnStatus>('all')

  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VmnAssignment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vmn-data')
      if (!res.ok) throw new Error('Failed to load VMN data')
      const json = await res.json()
      setData(json)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load VMN data',
        variant: 'destructive',
      })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleImport = async (file: File) => {
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/vmn-data/import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error ?? 'Import failed')
      }
      setImportResult(json as ImportResult)
      await fetchData()
      toast({
        title: 'Import complete',
        description: `${json.updated} updated, ${json.skipped} skipped, ${json.errors.length} warnings`,
      })
    } catch (e) {
      toast({
        title: 'Import failed',
        description: e instanceof Error ? e.message : 'Failed to import',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const storeCode =
        deleteTarget.si?.clientCode ||
        deleteTarget.si?.siCode ||
        deleteTarget.spotlight?.clientCode ||
        ''
      const side = deleteTarget.status === 'si_only' ? 'SI' : deleteTarget.status === 'spotlight_only' ? 'Spotlight' : 'both'
      const res = await fetch(
        `/api/vmn-data?storeCode=${encodeURIComponent(storeCode)}&side=${side}`,
        { method: 'DELETE' }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Delete failed')
      toast({
        title: 'VMN deleted',
        description: json.message ?? 'VMN data cleared',
      })
      setDeleteTarget(null)
      await fetchData()
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Failed to delete',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const headers = [
      'Store Code',
      'SI VMN',
      'Spotlight VMN',
      'SI Sales Landing',
      'SI Service Landing',
      'Spotlight Landing',
    ]
    const sample = [
      ['BL001', '+918291021445', '8879978971', '9999999999,8888888888', '7777777777', '6666666666'],
      ['BL002', '+919619985601', '8879978965', '', '', ''],
    ]
    const csv = [headers, ...sample]
      .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vmn-data-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Client-side filtering
  const filtered = (data?.assignments ?? []).filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      return (
        a.vmn.toLowerCase().includes(q) ||
        a.si?.siCode.toLowerCase().includes(q) ||
        a.si?.clientCode.toLowerCase().includes(q) ||
        a.si?.businessName?.toLowerCase().includes(q) ||
        a.spotlight?.clientCode.toLowerCase().includes(q) ||
        a.spotlight?.name?.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-2 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by VMN, store code, name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | VmnStatus)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="live">Live only</SelectItem>
              <SelectItem value="si_only">SI only</SelectItem>
              <SelectItem value="spotlight_only">Spotlight only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add VMN
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={<PhoneCall className="h-4 w-4 text-primary" />}
            label="Total VMNs"
            value={data.summary.totalVmns}
            accent="bg-primary/10"
          />
          <StatCard
            icon={<Radio className="h-4 w-4 text-emerald-600" />}
            label="Live"
            value={data.summary.live}
            hint="mapped on both sides"
            accent="bg-emerald-500/10"
          />
          <StatCard
            icon={<Phone className="h-4 w-4 text-blue-600" />}
            label="SI only"
            value={data.summary.siOnly}
            accent="bg-blue-500/10"
          />
          <StatCard
            icon={<Phone className="h-4 w-4 text-amber-600" />}
            label="Spotlight only"
            value={data.summary.spotlightOnly}
            accent="bg-amber-500/10"
          />
          <StatCard
            icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
            label="SI w/o VMN"
            value={data.summary.siWithoutVmn}
            hint="missing VMN"
            accent="bg-muted"
          />
          <StatCard
            icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
            label="Spot w/o VMN"
            value={data.summary.spotlightWithoutVmn}
            hint="missing VMN"
            accent="bg-muted"
          />
        </div>
      )}

      {/* Table */}
      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        data && (
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="min-w-[160px]">VMN Number</TableHead>
                      <TableHead className="min-w-[90px]">Status</TableHead>
                      <TableHead className="min-w-[220px]">SI Location</TableHead>
                      <TableHead className="min-w-[220px]">Spotlight Location</TableHead>
                      <TableHead className="min-w-[120px]">SI IVR</TableHead>
                      <TableHead className="min-w-[120px]">Spot IVR</TableHead>
                      <TableHead className="min-w-[80px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                          No VMNs match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((a) => (
                      <TableRow key={a.vmn}>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/5 px-2 py-1 text-xs font-mono font-medium text-primary">
                            <Phone className="h-3 w-3" />
                            {a.vmn}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                        <TableCell>
                          {a.si ? (
                            <div className="flex items-start gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium leading-tight break-words">
                                  {a.si.businessName ?? 'Unnamed'}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Code: <span className="font-mono">{a.si.siCode}</span>
                                  {a.si.clientCode && a.si.clientCode !== a.si.siCode && (
                                    <> · Client: <span className="font-mono">{a.si.clientCode}</span></>
                                  )}
                                </p>
                                <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[a.si.city, a.si.state].filter(Boolean).join(', ') || '—'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50">
                              <XCircle className="h-3 w-3" /> Not mapped in SI
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.spotlight ? (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium leading-tight break-words">
                                  {a.spotlight.name ?? 'Unnamed'}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Code: <span className="font-mono">{a.spotlight.clientCode}</span>
                                </p>
                                <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[a.spotlight.city, a.spotlight.state].filter(Boolean).join(', ') || '—'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50">
                              <XCircle className="h-3 w-3" /> Not mapped in Spotlight
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.si ? (
                            a.si.isLive ? (
                              <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15">
                                <Radio className="h-3 w-3" /> Live
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">Off</Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.spotlight ? (
                            a.spotlight.isLive ? (
                              <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15">
                                <Radio className="h-3 w-3" /> Live
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">Off</Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(a)}
                            title="Delete VMN data"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import VMN Data from Excel
            </DialogTitle>
            <DialogDescription>
              Upload an Excel/CSV file with VMN numbers for each location. The store
              code links the VMN to both SI and Spotlight records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Expected columns:
              </p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li><span className="font-mono font-medium text-foreground">Store Code</span> — SI code, client code, or Spotlight code (required)</li>
                <li><span className="font-mono font-medium text-foreground">SI VMN</span> — VMN for the SingleInterface side</li>
                <li><span className="font-mono font-medium text-foreground">Spotlight VMN</span> — VMN for the Spotlight side</li>
                <li><span className="font-mono font-medium text-foreground">SI Sales Landing</span> — comma-separated 10-digit numbers</li>
                <li><span className="font-mono font-medium text-foreground">SI Service Landing</span> — comma-separated 10-digit numbers</li>
                <li><span className="font-mono font-medium text-foreground">Spotlight Landing</span> — comma-separated 10-digit numbers</li>
              </ul>
              <p className="text-[11px] text-muted-foreground mt-2">
                A VMN is marked <span className="font-medium text-emerald-600">Live</span> when the same number is mapped on both SI and Spotlight sides.
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download CSV template
            </Button>

            <div
              className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-6 text-center hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) handleImport(f)
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImport(f)
                  e.target.value = ''
                }}
              />
              {importing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Importing…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload or drag &amp; drop</p>
                  <p className="text-[11px] text-muted-foreground">.xlsx, .xls, .csv</p>
                </div>
              )}
            </div>

            {importResult && (
              <div className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-medium">Import complete</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-emerald-500/10 py-1.5">
                    <p className="text-lg font-bold text-emerald-600">{importResult.updated}</p>
                    <p className="text-[10px] text-muted-foreground">updated</p>
                  </div>
                  <div className="rounded bg-muted py-1.5">
                    <p className="text-lg font-bold">{importResult.skipped}</p>
                    <p className="text-[10px] text-muted-foreground">skipped</p>
                  </div>
                  <div className="rounded bg-amber-500/10 py-1.5">
                    <p className="text-lg font-bold text-amber-600">{importResult.errors.length}</p>
                    <p className="text-[10px] text-muted-foreground">warnings</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded bg-muted/30 p-2 text-[11px] text-muted-foreground space-y-0.5">
                    {importResult.errors.slice(0, 20).map((e, i) => (
                      <p key={i} className="flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                        {e}
                      </p>
                    ))}
                    {importResult.errors.length > 20 && (
                      <p className="text-muted-foreground/60">…and {importResult.errors.length - 20} more</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add VMN dialog */}
      <AddVmnDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={fetchData}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete VMN data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the VMN assignment for{' '}
              <span className="font-mono font-medium text-foreground">
                {deleteTarget?.vmn}
              </span>
              {deleteTarget?.si && (
                <> on the SI side (<span className="font-mono">{deleteTarget.si.siCode}</span>)</>
              )}
              {deleteTarget?.spotlight && (
                <> and Spotlight side (<span className="font-mono">{deleteTarget.spotlight.clientCode}</span>)</>
              )}
              . The location records themselves are not deleted — only their VMN field is cleared.
              This action is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…
                </>
              ) : (
                'Delete VMN'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---- Add / edit VMN dialog (manual single assignment) ----

function AddVmnDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [storeCode, setStoreCode] = useState('')
  const [siVmn, setSiVmn] = useState('')
  const [spotlightVmn, setSpotlightVmn] = useState('')
  const [siSalesLanding, setSiSalesLanding] = useState('')
  const [siServiceLanding, setSiServiceLanding] = useState('')
  const [spotlightLanding, setSpotlightLanding] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setStoreCode('')
    setSiVmn('')
    setSpotlightVmn('')
    setSiSalesLanding('')
    setSiServiceLanding('')
    setSpotlightLanding('')
  }

  const handleSave = async () => {
    if (!storeCode.trim()) {
      toast({ title: 'Store code required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/vmn-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCode: storeCode.trim(),
          side: 'both',
          siVmn: siVmn.trim() || null,
          spotlightVmn: spotlightVmn.trim() || null,
          siSalesLandingNumbers: siSalesLanding.trim() || null,
          siServiceLandingNumbers: siServiceLanding.trim() || null,
          spotlightLandingNumbers: spotlightLanding.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to save')
      toast({
        title: 'VMN saved',
        description: json.message ?? 'VMN data updated',
      })
      reset()
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Failed to save',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add / Update VMN Data
          </DialogTitle>
          <DialogDescription>
            Assign VMN and landing numbers to a location by its store code. Updates
            both SI and Spotlight sides when records exist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="storeCode" className="text-xs">Store Code *</Label>
            <Input
              id="storeCode"
              placeholder="e.g. BL001 or 10001"
              value={storeCode}
              onChange={(e) => setStoreCode(e.target.value)}
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Matches SI code, SI client code, or Spotlight client code.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="siVmn" className="text-xs">SI VMN</Label>
              <Input
                id="siVmn"
                placeholder="+918291021445"
                value={siVmn}
                onChange={(e) => setSiVmn(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="spotlightVmn" className="text-xs">Spotlight VMN</Label>
              <Input
                id="spotlightVmn"
                placeholder="8879978971"
                value={spotlightVmn}
                onChange={(e) => setSpotlightVmn(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="siSales" className="text-xs">SI Sales Landing</Label>
              <Input
                id="siSales"
                placeholder="9999999999, 8888888888"
                value={siSalesLanding}
                onChange={(e) => setSiSalesLanding(e.target.value)}
                className="mt-1 font-mono text-[11px]"
              />
            </div>
            <div>
              <Label htmlFor="siService" className="text-xs">SI Service Landing</Label>
              <Input
                id="siService"
                placeholder="7777777777"
                value={siServiceLanding}
                onChange={(e) => setSiServiceLanding(e.target.value)}
                className="mt-1 font-mono text-[11px]"
              />
            </div>
            <div>
              <Label htmlFor="spotLanding" className="text-xs">Spotlight Landing</Label>
              <Input
                id="spotLanding"
                placeholder="6666666666"
                value={spotlightLanding}
                onChange={(e) => setSpotlightLanding(e.target.value)}
                className="mt-1 font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="rounded-md bg-muted/30 p-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Radio className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
            <span>
              A VMN is <span className="font-medium text-emerald-600">Live</span> when the same
              number is mapped on both the SI and Spotlight sides.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
              </>
            ) : (
              'Save VMN Data'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
