'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn, type FilterDef } from './data-table'
import {
  listSI,
  createSI,
  updateSI,
  deleteSI,
  exportSI,
  getFilters,
} from '@/lib/api'
import type { SIRecord } from '@/lib/types'
import { SI_FIELDS } from '@/lib/fields'

export function SIDataTable({ onRefresh }: { onRefresh?: () => void }) {
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
      return listSI({
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        state: params.filters.state,
        circle: params.filters.circle,
        city: params.filters.city,
        gmbStatus: params.filters.gmbStatus,
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
      const res = await exportSI({
        search,
        state: filters.state,
        circle: filters.circle,
        city: filters.city,
        gmbStatus: filters.gmbStatus,
      })
      downloadCSV(res.data, 'si-records.csv', SI_CSV_HEADERS)
    },
    []
  )

  const recordToForm = useCallback((r: SIRecord) => {
    const v: Record<string, string | null> = {}
    for (const f of SI_FIELDS) v[f.name] = (r as unknown as Record<string, string | null>)[f.name]
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
        <span className="line-clamp-2 max-w-[320px] text-sm">
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
      key: 'gmbListingStatus',
      header: 'GMB Status',
      cell: (r) =>
        r.gmbListingStatus ? (
          <Badge
            variant={r.gmbListingStatus === 'verified' ? 'default' : 'secondary'}
            className="text-xs capitalize"
          >
            {r.gmbListingStatus}
          </Badge>
        ) : (
          '—'
        ),
      className: 'whitespace-nowrap',
    },
  ]

  const filters: FilterDef[] = [
    { name: 'state', label: 'State', options: filterOptions.states },
    { name: 'circle', label: 'Circle', options: filterOptions.circles },
    { name: 'gmbStatus', label: 'GMB Status', options: filterOptions.gmbStatuses },
  ]

  return (
    <DataTable<SIRecord>
      title="SI Data"
      description="Manage Store Information records with full location and business details."
      columns={columns}
      fields={SI_FIELDS}
      filters={filters}
      fetcher={fetcher}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onExport={handleExport}
      recordToForm={recordToForm}
      totalLabel="records"
      addLabel="Add SI Record"
      exportLabel="Export CSV"
    />
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
  'WEEKLY OFF',
  'BUSINESS HOURS',
  'WEBSITE',
  'Place ID',
  'LOCATION GROUP',
  'GMB LISTING STATUS',
]

function downloadCSV<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  headers: string[]
) {
  const keys: (keyof T)[] = [
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
    'weeklyOff',
    'businessHours',
    'website',
    'placeId',
    'locationGroup',
    'gmbListingStatus',
  ]
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
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
