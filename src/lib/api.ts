import type {
  SIRecord,
  SpotlightRecord,
  SIRecordInput,
  SpotlightRecordInput,
  PaginatedResponse,
  DashboardStats,
} from './types'

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export interface SIListParams {
  page?: number
  pageSize?: number
  search?: string
  state?: string
  circle?: string
  city?: string
  gmbStatus?: string
}

export function listSI(params: SIListParams): Promise<PaginatedResponse<SIRecord>> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  if (params.search) q.set('search', params.search)
  if (params.state) q.set('state', params.state)
  if (params.circle) q.set('circle', params.circle)
  if (params.city) q.set('city', params.city)
  if (params.gmbStatus) q.set('gmbStatus', params.gmbStatus)
  return jsonFetch<PaginatedResponse<SIRecord>>(`/api/si?${q.toString()}`)
}

export function exportSI(params: Omit<SIListParams, 'page' | 'pageSize'>) {
  const q = new URLSearchParams({ export: '1' })
  if (params.search) q.set('search', params.search)
  if (params.state) q.set('state', params.state)
  if (params.circle) q.set('circle', params.circle)
  if (params.city) q.set('city', params.city)
  if (params.gmbStatus) q.set('gmbStatus', params.gmbStatus)
  return jsonFetch<{ data: SIRecord[] }>(`/api/si?${q.toString()}`)
}

export function createSI(data: SIRecordInput) {
  return jsonFetch<SIRecord>(`/api/si`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateSI(id: string, data: SIRecordInput) {
  return jsonFetch<SIRecord>(`/api/si/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteSI(id: string) {
  return jsonFetch<{ success: boolean }>(`/api/si/${id}`, { method: 'DELETE' })
}

export interface SpotlightListParams {
  page?: number
  pageSize?: number
  search?: string
  state?: string
  region?: string
  city?: string
  country?: string
}

export function listSpotlight(
  params: SpotlightListParams
): Promise<PaginatedResponse<SpotlightRecord>> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  if (params.search) q.set('search', params.search)
  if (params.state) q.set('state', params.state)
  if (params.region) q.set('region', params.region)
  if (params.city) q.set('city', params.city)
  if (params.country) q.set('country', params.country)
  return jsonFetch<PaginatedResponse<SpotlightRecord>>(`/api/spotlight?${q.toString()}`)
}

export function exportSpotlight(params: Omit<SpotlightListParams, 'page' | 'pageSize'>) {
  const q = new URLSearchParams({ export: '1' })
  if (params.search) q.set('search', params.search)
  if (params.state) q.set('state', params.state)
  if (params.region) q.set('region', params.region)
  if (params.city) q.set('city', params.city)
  if (params.country) q.set('country', params.country)
  return jsonFetch<{ data: SpotlightRecord[] }>(`/api/spotlight?${q.toString()}`)
}

export function createSpotlight(data: SpotlightRecordInput) {
  return jsonFetch<SpotlightRecord>(`/api/spotlight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateSpotlight(id: string, data: SpotlightRecordInput) {
  return jsonFetch<SpotlightRecord>(`/api/spotlight/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteSpotlight(id: string) {
  return jsonFetch<{ success: boolean }>(`/api/spotlight/${id}`, { method: 'DELETE' })
}

export interface ImportResult {
  si: { inserted: number; updated: number; skipped: number; errors: string[] }
  spotlight: { inserted: number; updated: number; skipped: number; errors: string[] }
}

export function importExcel(mode: 'replace' | 'upsert' = 'upsert') {
  return jsonFetch<ImportResult>(`/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
}

export function importExcelFile(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return jsonFetch<ImportResult>(`/api/import`, { method: 'POST', body: fd })
}

export function getStats() {
  return jsonFetch<DashboardStats>(`/api/stats`)
}

export interface FilterOptions {
  si: {
    states: string[]
    circles: string[]
    cities: string[]
    gmbStatuses: string[]
  }
  spotlight: {
    states: string[]
    regions: string[]
    cities: string[]
    countries: string[]
  }
}

export function getFilters() {
  return jsonFetch<FilterOptions>(`/api/filters`)
}
