'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn, type FilterDef } from './data-table'
import {
  listSpotlight,
  createSpotlight,
  updateSpotlight,
  deleteSpotlight,
  exportSpotlight,
  getFilters,
} from '@/lib/api'
import type { SpotlightRecord } from '@/lib/types'
import { SPOTLIGHT_FIELDS } from '@/lib/fields'

export function SpotlightDataTable({ onRefresh }: { onRefresh?: () => void }) {
  const [filterOptions, setFilterOptions] = useState<{
    states: string[]
    regions: string[]
    countries: string[]
  }>({ states: [], regions: [], countries: [] })

  useEffect(() => {
    getFilters()
      .then((f) => {
        setFilterOptions({
          states: f.spotlight.states,
          regions: f.spotlight.regions,
          countries: f.spotlight.countries,
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
      return listSpotlight({
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        state: params.filters.state,
        region: params.filters.region,
        city: params.filters.city,
        country: params.filters.country,
      })
    },
    []
  )

  const handleCreate = useCallback(
    async (data: Record<string, string | null>) => {
      await createSpotlight(data as never)
      onRefresh?.()
    },
    [onRefresh]
  )

  const handleUpdate = useCallback(
    async (id: string, data: Record<string, string | null>) => {
      await updateSpotlight(id, data as never)
      onRefresh?.()
    },
    [onRefresh]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSpotlight(id)
      onRefresh?.()
    },
    [onRefresh]
  )

  const handleExport = useCallback(
    async (filters: Record<string, string>, search: string) => {
      const res = await exportSpotlight({
        search,
        state: filters.state,
        region: filters.region,
        city: filters.city,
        country: filters.country,
      })
      downloadCSV(res.data, 'spotlight-records.csv')
    },
    []
  )

  const recordToForm = useCallback((r: SpotlightRecord) => {
    const v: Record<string, string | null> = {}
    for (const f of SPOTLIGHT_FIELDS)
      v[f.name] = (r as unknown as Record<string, string | null>)[f.name]
    return v
  }, [])

  const columns: DataTableColumn<SpotlightRecord>[] = [
    {
      key: 'clientCode',
      header: 'Client Code',
      cell: (r) => <span className="font-mono text-xs font-medium">{r.clientCode}</span>,
      className: 'whitespace-nowrap',
    },
    {
      key: 'name',
      header: 'Name',
      cell: (r) => (
        <span className="line-clamp-2 max-w-[320px] text-sm">
          {r.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'alternateName',
      header: 'Alt. Name',
      cell: (r) => <span className="text-sm text-muted-foreground">{r.alternateName ?? '—'}</span>,
      className: 'whitespace-nowrap',
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
      key: 'region',
      header: 'Region',
      cell: (r) =>
        r.region ? (
          <Badge variant="outline" className="text-xs">
            {r.region}
          </Badge>
        ) : (
          '—'
        ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'domain',
      header: 'Domain',
      cell: (r) =>
        r.domain ? (
          <a
            href={r.domain.startsWith('http') ? r.domain : `https://${r.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-xs break-all line-clamp-1 max-w-[180px] inline-block align-bottom"
          >
            {r.domain}
          </a>
        ) : (
          '—'
        ),
    },
  ]

  const filters: FilterDef[] = [
    { name: 'state', label: 'State', options: filterOptions.states },
    { name: 'region', label: 'Region', options: filterOptions.regions },
    { name: 'country', label: 'Country', options: filterOptions.countries },
  ]

  return (
    <DataTable<SpotlightRecord>
      title="Spotlight Data"
      description="Manage Spotlight location records with contact and domain details."
      columns={columns}
      fields={SPOTLIGHT_FIELDS}
      filters={filters}
      fetcher={fetcher}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onExport={handleExport}
      recordToForm={recordToForm}
      totalLabel="records"
      addLabel="Add Spotlight Record"
      exportLabel="Export CSV"
    />
  )
}

function downloadCSV(rows: SpotlightRecord[], filename: string) {
  const headers = [
    'Client Code',
    'Name',
    'Alternate Name',
    'Internal Code',
    'Region',
    'State',
    'City',
    'Country',
    'Pincode',
    'Locality',
    'Address Line 1',
    'Latitude',
    'Longitude',
    'VMN',
    'Domain',
    'AdAccount (CID)',
    'Facebook Page ID/url',
  ]
  const keys: (keyof SpotlightRecord)[] = [
    'clientCode',
    'name',
    'alternateName',
    'internalCode',
    'region',
    'state',
    'city',
    'country',
    'pincode',
    'locality',
    'addressLine1',
    'latitude',
    'longitude',
    'vmn',
    'domain',
    'adAccountCid',
    'facebookPageId',
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
