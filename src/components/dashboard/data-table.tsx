'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Download,
  MoreHorizontal,
  Eye,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { RecordFormModal } from './record-form-modal'
import type { FieldDef } from '@/lib/fields'
import type { PaginatedResponse } from '@/lib/types'

export interface FilterDef {
  name: string
  label: string
  options: string[]
}

export interface DataTableColumn<T> {
  key: string
  header: string
  cell?: (row: T) => React.ReactNode
  className?: string
}

export interface CustomRowAction<T> {
  key: string
  label: string | ((row: T) => string)
  icon?: React.ReactNode | ((row: T) => React.ReactNode)
  onClick: (row: T) => void
  variant?: 'default' | 'destructive'
  show?: (row: T) => boolean
}

export interface DataTableProps<T extends { id: string }> {
  title: string
  description?: string
  columns: DataTableColumn<T>[]
  fields: FieldDef[]
  filters?: FilterDef[]
  fetcher: (params: {
    page: number
    pageSize: number
    search: string
    filters: Record<string, string>
  }) => Promise<PaginatedResponse<T>>
  onCreate: (data: Record<string, string | null>) => Promise<void>
  onUpdate: (id: string, data: Record<string, string | null>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onExport: (filters: Record<string, string>, search: string) => Promise<void>
  recordToForm: (r: T) => Record<string, string | null>
  totalLabel: string
  addLabel: string
  exportLabel: string
  extraActions?: CustomRowAction<T>[]
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function DataTable<T extends { id: string }>({
  title,
  description,
  columns,
  fields,
  filters = [],
  fetcher,
  onCreate,
  onUpdate,
  onDelete,
  onExport,
  recordToForm,
  totalLabel,
  addLabel,
  exportLabel,
  extraActions = [],
}: DataTableProps<T>) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PaginatedResponse<T> | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [viewing, setViewing] = useState<T | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetcher({
        page,
        pageSize,
        search: debouncedSearch,
        filters: filterValues,
      })
      setData(res)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load data',
        variant: 'destructive',
      })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [fetcher, page, pageSize, debouncedSearch, filterValues, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleFilterChange(name: string, value: string) {
    setFilterValues((prev) => {
      const next = { ...prev }
      if (value === '__none__' || value === '') {
        delete next[name]
      } else {
        next[name] = value
      }
      return next
    })
    setPage(1)
  }

  function clearFilters() {
    setFilterValues({})
    setSearch('')
    setDebouncedSearch('')
    setPage(1)
  }

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(row: T) {
    setEditing(row)
    setFormOpen(true)
  }

  async function handleSubmit(values: Record<string, string | null>) {
    if (editing) {
      await onUpdate(editing.id, values)
      toast({ title: 'Updated', description: 'Record updated successfully' })
    } else {
      await onCreate(values)
      toast({ title: 'Created', description: 'Record created successfully' })
    }
    await fetchData()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await onDelete(deleteTarget.id)
      toast({ title: 'Deleted', description: 'Record deleted successfully' })
      setDeleteTarget(null)
      await fetchData()
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Failed',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await onExport(filterValues, debouncedSearch)
      toast({ title: 'Exported', description: 'CSV file downloaded' })
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Failed',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || loading}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exportLabel}
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {filters.map((f) => (
          <Select
            key={f.name}
            value={filterValues[f.name] ?? '__none__'}
            onValueChange={(v) => handleFilterChange(f.name, v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{f.label}: All</SelectItem>
              {f.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {(Object.keys(filterValues).length > 0 || search) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} className={c.className}>
                    {c.header}
                  </TableHead>
                ))}
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        <Skeleton className="h-5 w-full max-w-[160px]" />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data && data.data.length > 0 ? (
                data.data.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.className}>
                        {c.cell ? c.cell(row) : null}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(row)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(row)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {extraActions
                            .filter((a) => !a.show || a.show(row))
                            .map((a) => {
                              const label =
                                typeof a.label === 'function' ? a.label(row) : a.label
                              const icon =
                                typeof a.icon === 'function' ? a.icon(row) : a.icon
                              return (
                                <DropdownMenuItem
                                  key={a.key}
                                  onClick={() => a.onClick(row)}
                                  className={
                                    a.variant === 'destructive'
                                      ? 'text-destructive focus:text-destructive'
                                      : ''
                                  }
                                >
                                  {icon}
                                  {label}
                                </DropdownMenuItem>
                              )
                            })}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(row)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No records found. Try adjusting filters or add a new record.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {data && data.data.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {startIdx}-{endIdx} of {total} {totalLabel}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {totalPages > 1 && (
            <Pagination className="sm:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-disabled={page === 1}
                    className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                <PaginationItem className="px-3 text-sm">
                  Page {page} of {totalPages}
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      <RecordFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Edit Record' : 'Add New Record'}
        description={
          editing ? 'Update the record details below.' : 'Fill in the record details below.'
        }
        fields={fields}
        initial={editing ? recordToForm(editing) : undefined}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Update Record' : 'Create Record'}
      />

      <ViewRecordModal
        open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        record={viewing}
        fields={fields}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the record
              {deleteTarget ? ` (ID: ${deleteTarget.id})` : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ViewRecordModal({
  open,
  onOpenChange,
  record,
  fields,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  record: { id: string } | null
  fields: FieldDef[]
}) {
  if (!record) return null
  const r = record as unknown as Record<string, string | null>
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Record Details</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {fields.map((f) => {
              const val = r[f.name]
              const displayVal = val ?? '—'
              const isLong = val && val.length > 60
              return (
                <div key={f.name} className={isLong ? 'sm:col-span-2' : ''}>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {f.label}
                  </dt>
                  <dd className="mt-0.5 text-sm break-words">
                    {val ? (
                      f.type === 'url' ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {val}
                        </a>
                      ) : (
                        <span className="break-words">{displayVal}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">{displayVal}</span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
