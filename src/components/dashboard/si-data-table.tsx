'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  DataTable,
  type DataTableColumn,
  type FilterDef,
  type CustomRowAction,
} from './data-table'
import {
  listSI,
  createSI,
  updateSI,
  deleteSI,
  exportSI,
  getFilters,
  markSILive,
} from '@/lib/api'
import type { SIRecord } from '@/lib/types'
import { SI_FIELDS } from '@/lib/fields'
import { countLandingNumbers } from '@/lib/validation'
import { useToast } from '@/hooks/use-toast'
import { Power, PowerOff } from 'lucide-react'
import { ImportDialog } from './import-dialog'

export function SIDataTable({ onRefresh }: { onRefresh?: () => void }) {
  const { toast } = useToast()
  const [importOpen, setImportOpen] = useState(false)
  const [filterOptions, setFilterOptions] = useState<{
    states: string[]
    circles: string[]
    gmbStatuses: string[]
  }>({ states: [], circles: [], gmbStatuses: [] })

  useEffect(() => {
    getFilters()
      .then((f) => {
        setFilterOptions({
          states: f.si.states,
          circles: f.si.circles,
          gmbStatuses: f.si.gmbStatuses,
        })
      })
      .catch(() => {
        // ignore
      })
  }, [])

  const fetcher = useCallback(
    async (params: {
      page: number
      pageSize: number
      search: string
      filters: Record<string, string>
    }) => {
      const isLiveVal = params.filters.isLive
      return listSI({
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        state: params.filters.state,
        circle: params.filters.circle,
        city: params.filters.city,
        gmbStatus: params.filters.gmbStatus,
        isLive: isLiveVal === 'live' ? true : isLiveVal === 'inactive' ? false : undefined,
      })
    },
    []
  )

  const handleCreate = useCallback(
    async (data: Record<string, string | null>) => {
      await createSI(data as never)
      onRefresh?.()
    },
    [onRefresh]
  )

  const handleUpdate = useCallback(
    async (id: string, data: Record<string, string | null>) => {
      await updateSI(id, data as never)
      onRefresh?.()
    },
    [onRefresh]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSI(id)
      onRefresh?.()
    },
    [onRefresh]
  )

  const handleExport = useCallback(
    async (filters: Record<string, string>, search: string) => {
      const isLiveVal = filters.isLive
      const res = await exportSI({
        search,
        state: filters.state,
        circle: filters.circle,
        city: filters.city,
        gmbStatus: filters.gmbStatus,
        isLive:
          isLiveVal === 'live' ? true : isLiveVal === 'inactive' ? false : undefined,
      })
      downloadCSV(res.data, 'si-records.csv')
    },
    []
  )

  const handleToggleLive = useCallback(
    async (row: SIRecord) => {
      try {
        const result = await markSILive(row.id, !row.isLive)
        const msgs: string[] = []
        if (row.isLive) {
          msgs.push('Marked as inactive')
        } else {
          msgs.push('Marked as live')
          if (result.spotlightSync) {
            if (result.spotlightSync.ok) {
              msgs.push(`Linked Spotlight "${result.spotlightSync.code}" also set live`)
            } else {
              msgs.push(
                `Linked Spotlight "${result.spotlightSync.code}" not found`
              )
            }
          }
          if (result.platformFeeCreated) {
            msgs.push('Platform fee for current month created')
          }
        }
        toast({
          title: row.isLive ? 'Deactivated' : 'Activated',
          description: msgs.join(' • '),
        })
        onRefresh?.()
      } catch (e) {
        toast({
          title: 'Failed to update live status',
          description: e instanceof Error ? e.message : 'Error',
          variant: 'destructive',
        })
      }
    },
    [onRefresh, toast]
  )

  const recordToForm = useCallback((r: SIRecord) => {
    const v: Record<string, string | null> = {}
    for (const f of SI_FIELDS)
      v[f.name] = (r as unknown as Record<string, string | null>)[f.name]
    return v
  }, [])

  const columns: DataTableColumn<SIRecord>[] = [
    {
      key: 'siCode',
      header: 'SI Code',
      cell: (r) => <span className="font-medium">{r.siCode}</span>,
      className: 'whitespace-nowrap',
    },
    {
      key: 'clientCode',
      header: 'Client',
      cell: (r) => <span className="font-mono text-xs">{r.clientCode}</span>,
      className: 'whitespace-nowrap',
    },
    {
      key: 'businessName',
      header: 'Business Name',
      cell: (r) => (
        <span className="line-clamp-2 max-w-[280px] text-sm">
          {r.businessName ?? '—'}
        </span>
      ),
    },
    {
      key: 'city',
      header: 'City',
      cell: (r) => r.city ?? '—',
      className: 'whitespace-nowrap',
    },
    {
      key: 'state',
      header: 'State',
      cell: (r) => r.state ?? '—',
      className: 'whitespace-nowrap',
    },
    {
      key: 'circle',
      header: 'Circle',
      cell: (r) =>
        r.circle ? (
          <Badge variant="outline" className="text-xs">
            {r.circle}
          </Badge>
        ) : (
          '—'
        ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'vmn',
      header: 'VMN (S/Svc)',
      cell: (r) => {
        const sales = countLandingNumbers(r.salesLandingNumbers)
        const service = countLandingNumbers(r.serviceLandingNumbers)
        if (sales === 0 && service === 0) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="text-emerald-600">Sales: {sales}</span>
            <span className="text-amber-600">Svc: {service}</span>
          </div>
        )
      },
      className: 'whitespace-nowrap',
    },
    {
      key: 'isLive',
      header: 'Status',
      cell: (r) =>
        r.isLive ? (
          <Badge className="text-xs bg-emerald-600 hover:bg-emerald-600">
            Live
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Inactive
          </Badge>
        ),
      className: 'whitespace-nowrap',
    },
  ]

  const filters: FilterDef[] = [
    { name: 'state', label: 'State', options: filterOptions.states },
    { name: 'circle', label: 'Circle', options: filterOptions.circles },
    { name: 'gmbStatus', label: 'GMB Status', options: filterOptions.gmbStatuses },
    { name: 'isLive', label: 'Status', options: ['live', 'inactive'] },
  ]

  const extraActions: CustomRowAction<SIRecord>[] = [
    {
      key: 'toggle-live',
      label: (row) => (row.isLive ? 'Mark as Inactive' : 'Mark as Live'),
      icon: (row) =>
        row.isLive ? (
          <PowerOff className="mr-2 h-4 w-4" />
        ) : (
          <Power className="mr-2 h-4 w-4" />
        ),
      onClick: (row) => handleToggleLive(row),
    },
  ]

  return (
    <>
    <DataTable<SIRecord>
      title="SI Data"
      description="Manage Store Information records with full location, VMN mapping, and live status."
      columns={columns}
      fields={SI_FIELDS}
      filters={filters}
      fetcher={fetcher}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onExport={handleExport}
      onImport={() => setImportOpen(true)}
      importLabel="Import Excel"
      recordToForm={recordToForm}
      totalLabel="records"
      addLabel="Add SI Record"
      exportLabel="Export CSV"
      extraActions={extraActions}
    />
    <ImportDialog
      open={importOpen}
      onOpenChange={setImportOpen}
      onImported={() => { onRefresh?.() }}
    />
    </>
  )
}

const SI_CSV_HEADERS = [
  'SI Code',
  'Client Code',
  'BUSINESS PROFILE ID',
  'BUSINESS / BRAND NAME',
  'ALTERNATIVE NAME',
  'CIRCLE',
  'ADDRESS 1',
  'ADDRESS 2',
  'LOCALITY',
  'LANDMARK',
  'CITY',
  'STATE',
  'POSTCODE',
  'LATITUDE',
  'LONGITUDE',
  'GOOGLE PLUS PAGE',
  'VMN SI',
  'SALES LANDING NUMBERS',
  'SERVICE LANDING NUMBERS',
  'LINKED SPOTLIGHT CODE',
  'IS LIVE',
  'LIVE SINCE',
  'WEEKLY OFF',
  'BUSINESS HOURS',
  'WEBSITE',
  'Place ID',
  'LOCATION GROUP',
  'GMB LISTING STATUS',
]

function downloadCSV(rows: SIRecord[], filename: string) {
  const headers = SI_CSV_HEADERS
  const keys: (keyof SIRecord)[] = [
    'siCode',
    'clientCode',
    'businessProfileId',
    'businessName',
    'alternativeName',
    'circle',
    'address1',
    'address2',
    'locality',
    'landmark',
    'city',
    'state',
    'postcode',
    'latitude',
    'longitude',
    'googlePlusPage',
    'vmnSi',
    'salesLandingNumbers',
    'serviceLandingNumbers',
    'linkedSpotlightCode',
    'isLive',
    'liveSince',
    'weeklyOff',
    'businessHours',
    'website',
    'placeId',
    'locationGroup',
    'gmbListingStatus',
  ]
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const csv = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
