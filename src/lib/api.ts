import type {
  SIRecord,
  SpotlightRecord,
  SIRecordInput,
  SpotlightRecordInput,
  PaginatedResponse,
  DashboardStats,
  MediaSpend,
  MediaSpendInput,
  PlatformFee,
  PlatformFeeInput,
  RemindersData,
  ImportResult,
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
  isLive?: boolean
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
  if (params.isLive !== undefined) q.set('isLive', String(params.isLive))
  return jsonFetch<PaginatedResponse<SIRecord>>(`/api/si?${q.toString()}`)
}

export function exportSI(params: Omit<SIListParams, 'page' | 'pageSize'>) {
  const q = new URLSearchParams({ export: '1' })
  if (params.search) q.set('search', params.search)
  if (params.state) q.set('state', params.state)
  if (params.circle) q.set('circle', params.circle)
  if (params.city) q.set('city', params.city)
  if (params.gmbStatus) q.set('gmbStatus', params.gmbStatus)
  if (params.isLive !== undefined) q.set('isLive', String(params.isLive))
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
  isLive?: boolean
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
  if (params.isLive !== undefined) q.set('isLive', String(params.isLive))
  return jsonFetch<PaginatedResponse<SpotlightRecord>>(`/api/spotlight?${q.toString()}`)
}

export function exportSpotlight(params: Omit<SpotlightListParams, 'page' | 'pageSize'>) {
  const q = new URLSearchParams({ export: '1' })
  if (params.search) q.set('search', params.search)
  if (params.state) q.set('state', params.state)
  if (params.region) q.set('region', params.region)
  if (params.city) q.set('city', params.city)
  if (params.country) q.set('country', params.country)
  if (params.isLive !== undefined) q.set('isLive', String(params.isLive))
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

export interface ExcelImportResult {
  si: { inserted: number; updated: number; skipped: number; errors: string[] }
  spotlight: { inserted: number; updated: number; skipped: number; errors: string[] }
}

export function importExcel(mode: 'replace' | 'upsert' = 'upsert') {
  return jsonFetch<ExcelImportResult>(`/api/import`, {
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

// --- Live status ---
export interface LiveSyncResult {
  success: boolean
  record: SIRecord | SpotlightRecord
  spotlightSync?: { code: string; ok: boolean } | null
  platformFeeCreated?: boolean
}

export function markSILive(id: string, live: boolean, liveSince?: string) {
  return jsonFetch<LiveSyncResult>(`/api/si/${id}/live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ live, liveSince }),
  })
}

export function markSpotlightLive(id: string, live: boolean, liveSince?: string) {
  return jsonFetch<LiveSyncResult>(`/api/spotlight/${id}/live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ live, liveSince }),
  })
}

// --- Media Spend ---
export interface MediaSpendListParams {
  page?: number
  pageSize?: number
  search?: string
  month?: string
  recordType?: 'SI' | 'Spotlight'
  recordCode?: string
}

export function listMediaSpend(
  params: MediaSpendListParams
): Promise<PaginatedResponse<MediaSpend>> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  if (params.search) q.set('search', params.search)
  if (params.month) q.set('month', params.month)
  if (params.recordType) q.set('recordType', params.recordType)
  if (params.recordCode) q.set('recordCode', params.recordCode)
  return jsonFetch<PaginatedResponse<MediaSpend>>(`/api/media-spend?${q.toString()}`)
}

export function exportMediaSpend(params: Omit<MediaSpendListParams, 'page' | 'pageSize'>) {
  const q = new URLSearchParams({ export: '1' })
  if (params.search) q.set('search', params.search)
  if (params.month) q.set('month', params.month)
  if (params.recordType) q.set('recordType', params.recordType)
  if (params.recordCode) q.set('recordCode', params.recordCode)
  return jsonFetch<{ data: MediaSpend[] }>(`/api/media-spend?${q.toString()}`)
}

export function createMediaSpend(data: MediaSpendInput) {
  return jsonFetch<MediaSpend>(`/api/media-spend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateMediaSpend(id: string, data: MediaSpendInput) {
  return jsonFetch<MediaSpend>(`/api/media-spend/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteMediaSpend(id: string) {
  return jsonFetch<{ success: boolean }>(`/api/media-spend/${id}`, { method: 'DELETE' })
}

// --- Platform Fees ---
export interface PlatformFeeListParams {
  page?: number
  pageSize?: number
  search?: string
  month?: string
  recordType?: 'SI' | 'Spotlight'
  recordCode?: string
  isPaid?: boolean
}

export function listPlatformFees(
  params: PlatformFeeListParams
): Promise<PaginatedResponse<PlatformFee>> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  if (params.search) q.set('search', params.search)
  if (params.month) q.set('month', params.month)
  if (params.recordType) q.set('recordType', params.recordType)
  if (params.recordCode) q.set('recordCode', params.recordCode)
  if (params.isPaid !== undefined) q.set('isPaid', String(params.isPaid))
  return jsonFetch<PaginatedResponse<PlatformFee>>(`/api/platform-fees?${q.toString()}`)
}

export function exportPlatformFees(params: Omit<PlatformFeeListParams, 'page' | 'pageSize'>) {
  const q = new URLSearchParams({ export: '1' })
  if (params.search) q.set('search', params.search)
  if (params.month) q.set('month', params.month)
  if (params.recordType) q.set('recordType', params.recordType)
  if (params.recordCode) q.set('recordCode', params.recordCode)
  if (params.isPaid !== undefined) q.set('isPaid', String(params.isPaid))
  return jsonFetch<{ data: PlatformFee[] }>(`/api/platform-fees?${q.toString()}`)
}

export function createPlatformFee(data: PlatformFeeInput) {
  return jsonFetch<PlatformFee>(`/api/platform-fees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updatePlatformFee(id: string, data: PlatformFeeInput) {
  return jsonFetch<PlatformFee>(`/api/platform-fees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deletePlatformFee(id: string) {
  return jsonFetch<{ success: boolean }>(`/api/platform-fees/${id}`, { method: 'DELETE' })
}

export interface GenerateResult {
  success: boolean
  month: string
  recordType: string
  liveCount: number
  created: number
  skipped: number
  errors: string[]
}

export function generatePlatformFees(
  month?: string,
  recordType?: 'SI' | 'Spotlight'
) {
  return jsonFetch<GenerateResult>(`/api/platform-fees/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, recordType }),
  })
}

// --- Reminders ---
export function getReminders() {
  return jsonFetch<RemindersData>(`/api/reminders`)
}

// --- Media Spend Import ---
export function importMediaSpendFile(file: File, mode: 'upsert' | 'replace' = 'upsert') {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('mode', mode)
  return jsonFetch<ImportResult>(`/api/media-spend/import`, {
    method: 'POST',
    body: fd,
  })
}

export function importMediaSpendJson(
  rows: Record<string, unknown>[],
  mode: 'upsert' | 'replace' = 'upsert'
) {
  return jsonFetch<ImportResult>(`/api/media-spend/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, mode }),
  })
}

// --- Platform Fees Import ---
export function importPlatformFeesFile(
  file: File,
  mode: 'upsert' | 'replace' = 'upsert'
) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('mode', mode)
  return jsonFetch<ImportResult>(`/api/platform-fees/import`, {
    method: 'POST',
    body: fd,
  })
}

export function importPlatformFeesJson(
  rows: Record<string, unknown>[],
  mode: 'upsert' | 'replace' = 'upsert'
) {
  return jsonFetch<ImportResult>(`/api/platform-fees/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, mode }),
  })
}
