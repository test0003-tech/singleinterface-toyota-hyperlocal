'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Link2,
  Unlink,
  Building2,
  MapPin,
  Clock,
  Radio,
  AlertTriangle,
  Store,
  Hash,
  ChevronDown,
  ChevronRight,
  Smartphone,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { VmnDataTab } from '@/components/dashboard/vmn-data-tab'

// ---- Types (mirror the API response) ----

interface ParsedBusinessHours {
  day: number
  dayName: string
  dayFull: string
  open: string
  close: string
  raw: string
}

interface MappingRow {
  siId: string
  siCode: string
  clientCode: string
  locationName: string | null
  city: string | null
  state: string | null
  circle: string | null
  siVmn: string | null
  spotlightVmn: string | null
  siSalesLandingNumbers: string | null
  siServiceLandingNumbers: string | null
  spotlightLandingNumbers: string | null
  businessHours: string | null
  businessHoursParsed: ParsedBusinessHours[] | null
  weeklyOff: string | null
  siIvrLive: boolean
  spotlightIvrLive: boolean | null
  spotlightId: string | null
  spotlightCode: string | null
  spotlightDomain: string | null
  matchType: 'manual' | 'auto' | 'none'
}

interface ExtraSpotlightStore {
  id: string
  spotlightCode: string
  storeCodeMissing: boolean
  locationName: string | null
  city: string | null
  state: string | null
  region: string | null
  spotlightVmn: string | null
  spotlightLandingNumbers: string | null
  spotlightIvrLive: boolean
  spotlightDomain: string | null
}

interface ExtraVmn {
  vmn: string
  source: 'SI' | 'Spotlight'
  storeCode: string
  locationName: string | null
  city: string | null
  state: string | null
  ivrLive: boolean
}

interface VmnMappingData {
  mappings: MappingRow[]
  extraSpotlightStores: ExtraSpotlightStore[]
  extraVmns: ExtraVmn[]
  summary: {
    totalSI: number
    totalSpotlight: number
    matchedPairs: number
    manuallyLinked: number
    autoMatched: number
    unmatchedSI: number
    extraSpotlightStores: number
    extraVmns: number
    siWithVmn: number
    spotlightWithVmn: number
    siIvrLive: number
    spotlightIvrLive: number
  }
}

// Split a comma-separated list of landing numbers into individual chips.
function splitNumbers(v: string | null): string[] {
  if (!v) return []
  return v
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function IvrLiveBadge({ live, label }: { live: boolean | null; label: string }) {
  if (live === null) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground font-normal">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        {label}: N/A
      </Badge>
    )
  }
  return live ? (
    <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15">
      <Radio className="h-3 w-3" />
      {label}: Live
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      {label}: Off
    </Badge>
  )
}

function MatchBadge({ matchType }: { matchType: MappingRow['matchType'] }) {
  if (matchType === 'manual')
    return (
      <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15">
        <Link2 className="h-3 w-3" /> Linked
      </Badge>
    )
  if (matchType === 'auto')
    return (
      <Badge className="gap-1 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15">
        <Link2 className="h-3 w-3" /> Auto
      </Badge>
    )
  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      <Unlink className="h-3 w-3" /> Unmapped
    </Badge>
  )
}

function NumberChips({
  numbers,
  emptyLabel = '—',
  variant = 'default',
}: {
  numbers: string[]
  emptyLabel?: string
  variant?: 'default' | 'sales' | 'service' | 'spotlight'
}) {
  if (numbers.length === 0) {
    return <span className="text-xs text-muted-foreground/60">{emptyLabel}</span>
  }
  const variantClass =
    variant === 'sales'
      ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      : variant === 'service'
        ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
        : variant === 'spotlight'
          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
          : 'bg-muted text-foreground border-border'
  return (
    <div className="flex flex-wrap gap-1">
      {numbers.map((n, i) => (
        <span
          key={`${n}-${i}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-mono',
            variantClass
          )}
        >
          <Smartphone className="h-2.5 w-2.5" />
          {n}
        </span>
      ))}
    </div>
  )
}

function BusinessHoursCell({ row }: { row: MappingRow }) {
  const [expanded, setExpanded] = useState(false)
  const parsed = row.businessHoursParsed

  if (!parsed || parsed.length === 0) {
    return (
      <span className="text-xs text-muted-foreground/60 inline-flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {row.businessHours ? row.businessHours : 'Not set'}
      </span>
    )
  }

  // Compact summary: Mon-Sun ranges grouped
  const grouped = new Map<string, { days: string[]; open: string; close: string }>()
  for (const b of parsed) {
    const key = `${b.open}-${b.close}`
    if (!grouped.has(key)) grouped.set(key, { days: [], open: b.open, close: b.close })
    grouped.get(key)!.days.push(b.dayName)
  }
  const compact = Array.from(grouped.values())
    .map((g) => `${g.days.join(', ')} ${g.open}-${g.close}`)
    .join(' | ')

  return (
    <div className="min-w-[180px]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-start gap-1.5 text-left text-xs hover:text-primary transition-colors w-full"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">
          {expanded ? (
            <span className="font-medium text-foreground">Business hours (per day)</span>
          ) : (
            compact
          )}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1 pl-5">
          {parsed.map((b) => (
            <div
              key={b.day}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1 text-[11px]"
            >
              <span className="font-medium text-foreground">{b.dayName}</span>
              <span className="font-mono text-muted-foreground">
                {b.open}–{b.close}
              </span>
            </div>
          ))}
          {row.weeklyOff && (
            <div className="col-span-full mt-1 flex items-center gap-1.5 text-[11px] text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              Weekly off: <span className="font-medium">{row.weeklyOff}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VmnCell({ vmn, label }: { vmn: string | null; label: string }) {
  if (!vmn) {
    return <span className="text-xs text-muted-foreground/60">—</span>
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/5 px-2 py-1 text-xs font-mono font-medium text-primary cursor-help">
            <Phone className="h-3 w-3" />
            {vmn}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{label}: {vmn}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---- Stat card ----
function StatCard({
  icon,
  label,
  value,
  hint,
  accent = 'text-foreground',
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  hint?: string
  accent?: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            {label}
          </p>
          <span className={cn('h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center', accent)}>
            {icon}
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function VmnMappingPage() {
  const [data, setData] = useState<VmnMappingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [onlyLive, setOnlyLive] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (onlyLive) params.set('live', 'true')
      const res = await fetch(`/api/vmn-mapping?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load VMN mapping')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load VMN mapping')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, onlyLive])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">VMN &amp; Mapping</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Virtual Mobile Numbers, landing numbers, business hours &amp; IVR live status for every
            SI ↔ Spotlight location. Nomenclature follows SingleInterface.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={<Link2 className="h-4 w-4 text-emerald-600" />}
            label="Matched Pairs"
            value={data.summary.matchedPairs}
            hint={`${data.summary.manuallyLinked} linked`}
          />
          <StatCard
            icon={<Unlink className="h-4 w-4 text-amber-600" />}
            label="Unmatched SI"
            value={data.summary.unmatchedSI}
          />
          <StatCard
            icon={<Store className="h-4 w-4 text-rose-600" />}
            label="Extra Spotlight"
            value={data.summary.extraSpotlightStores}
            hint="store code missing"
          />
          <StatCard
            icon={<PhoneCall className="h-4 w-4 text-primary" />}
            label="Extra VMNs"
            value={data.summary.extraVmns}
            hint="available to map"
          />
          <StatCard
            icon={<Radio className="h-4 w-4 text-emerald-600" />}
            label="SI IVR Live"
            value={`${data.summary.siIvrLive}/${data.summary.totalSI}`}
          />
          <StatCard
            icon={<Radio className="h-4 w-4 text-emerald-600" />}
            label="Spotlight Live"
            value={`${data.summary.spotlightIvrLive}/${data.summary.totalSpotlight}`}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, city, VMN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background">
          <Switch id="live-only" checked={onlyLive} onCheckedChange={setOnlyLive} />
          <Label htmlFor="live-only" className="text-xs cursor-pointer">
            Live IVR only
          </Label>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </CardContent>
        </Card>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        data && (
          <Tabs defaultValue="mappings" className="w-full">
            <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex">
              <TabsTrigger value="mappings" className="gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">VMN Mapping</span>
                <span className="sm:hidden">Mapping</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {data.summary.matchedPairs + data.summary.unmatchedSI}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="vmn-data" className="gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">VMN Data</span>
                <span className="sm:hidden">VMNs</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  <Radio className="h-2.5 w-2.5 mr-0.5 text-emerald-600" />
                  Live
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="extra-spotlight" className="gap-1.5">
                <Store className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Extra Spotlight</span>
                <span className="sm:hidden">Spotlight</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {data.summary.extraSpotlightStores}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="extra-vmns" className="gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Extra VMNs</span>
                <span className="sm:hidden">VMNs</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {data.summary.extraVmns}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* ---- Tab 1: VMN Mapping ---- */}
            <TabsContent value="mappings" className="mt-4">
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="min-w-[200px] sticky left-0 bg-muted/40 z-10">
                            Location
                          </TableHead>
                          <TableHead className="min-w-[110px]">Store Code</TableHead>
                          <TableHead className="min-w-[150px]">SI VMN</TableHead>
                          <TableHead className="min-w-[150px]">Spotlight VMN</TableHead>
                          <TableHead className="min-w-[140px]">SI Sales Landing</TableHead>
                          <TableHead className="min-w-[140px]">SI Service Landing</TableHead>
                          <TableHead className="min-w-[140px]">Spotlight Landing</TableHead>
                          <TableHead className="min-w-[220px]">Business Hours</TableHead>
                          <TableHead className="min-w-[150px]">IVR Live</TableHead>
                          <TableHead className="min-w-[90px]">Match</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.mappings.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                              No locations match your filters.
                            </TableCell>
                          </TableRow>
                        )}
                        {data.mappings.map((m) => (
                          <TableRow key={m.siId} className="align-top">
                            <TableCell className="sticky left-0 bg-background z-10">
                              <div className="flex items-start gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium leading-tight break-words">
                                    {m.locationName ?? 'Unnamed'}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {[m.city, m.state].filter(Boolean).join(', ') || '—'}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                                    SI Code: <span className="font-mono">{m.siCode}</span>
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-mono font-medium">
                                <Hash className="h-3 w-3 text-muted-foreground" />
                                {m.clientCode || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <VmnCell vmn={m.siVmn} label="SI VMN" />
                            </TableCell>
                            <TableCell>
                              <VmnCell vmn={m.spotlightVmn} label="Spotlight VMN" />
                            </TableCell>
                            <TableCell>
                              <NumberChips
                                numbers={splitNumbers(m.siSalesLandingNumbers)}
                                emptyLabel="Not set"
                                variant="sales"
                              />
                            </TableCell>
                            <TableCell>
                              <NumberChips
                                numbers={splitNumbers(m.siServiceLandingNumbers)}
                                emptyLabel="Not set"
                                variant="service"
                              />
                            </TableCell>
                            <TableCell>
                              <NumberChips
                                numbers={splitNumbers(m.spotlightLandingNumbers)}
                                emptyLabel="Not set"
                                variant="spotlight"
                              />
                            </TableCell>
                            <TableCell>
                              <BusinessHoursCell row={m} />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <IvrLiveBadge live={m.siIvrLive} label="SI" />
                                <IvrLiveBadge live={m.spotlightIvrLive} label="Spot" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <MatchBadge matchType={m.matchType} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- Tab 2: VMN Data (import / delete / live status) ---- */}
            <TabsContent value="vmn-data" className="mt-4">
              <VmnDataTab />
            </TabsContent>

            {/* ---- Tab 3: Extra Spotlight stores (store code missing) ---- */}
            <TabsContent value="extra-spotlight" className="mt-4">
              <Card className="shadow-sm border-rose-500/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                      <Store className="h-4 w-4 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        Extra stores in Spotlight — no matching SI store code
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        These Spotlight locations have no SingleInterface counterpart. The SI store
                        code is <span className="font-medium text-rose-600">missing</span> and needs
                        to be created or mapped.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="min-w-[120px]">SI Store Code</TableHead>
                          <TableHead className="min-w-[130px]">Spotlight Code</TableHead>
                          <TableHead className="min-w-[220px]">Location Name</TableHead>
                          <TableHead className="min-w-[150px]">Spotlight VMN</TableHead>
                          <TableHead className="min-w-[150px]">Spotlight Landing</TableHead>
                          <TableHead className="min-w-[120px]">City / Region</TableHead>
                          <TableHead className="min-w-[120px]">IVR Live</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.extraSpotlightStores.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                              All Spotlight stores have a matching SI store code.
                            </TableCell>
                          </TableRow>
                        )}
                        {data.extraSpotlightStores.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-rose-500/40 bg-rose-500/5 px-2 py-1 text-xs text-rose-600 font-medium">
                                <XCircle className="h-3 w-3" />
                                Missing
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-mono font-medium">
                                <Hash className="h-3 w-3 text-muted-foreground" />
                                {s.spotlightCode}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-start gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium leading-tight break-words">
                                    {s.locationName ?? 'Unnamed'}
                                  </p>
                                  {s.spotlightDomain && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
                                      {s.spotlightDomain}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <VmnCell vmn={s.spotlightVmn} label="Spotlight VMN" />
                            </TableCell>
                            <TableCell>
                              <NumberChips
                                numbers={splitNumbers(s.spotlightLandingNumbers)}
                                emptyLabel="Not set"
                                variant="spotlight"
                              />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {[s.city, s.state || s.region].filter(Boolean).join(', ') || '—'}
                            </TableCell>
                            <TableCell>
                              <IvrLiveBadge live={s.spotlightIvrLive} label="Spot" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- Tab 4: Extra VMNs available to map ---- */}
            <TabsContent value="extra-vmns" className="mt-4">
              <Card className="shadow-sm border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <PhoneCall className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        Extra VMNs available to map — rest of the data not mapped
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        These Virtual Mobile Numbers exist in the data but their owning record is not
                        part of a matched SI ↔ Spotlight pair. Map the counterpart location to
                        complete the data.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="min-w-[170px]">VMN</TableHead>
                          <TableHead className="min-w-[110px]">Source</TableHead>
                          <TableHead className="min-w-[120px]">Store Code</TableHead>
                          <TableHead className="min-w-[220px]">Location Name</TableHead>
                          <TableHead className="min-w-[140px]">City / State</TableHead>
                          <TableHead className="min-w-[110px]">IVR Live</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.extraVmns.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                              No unmapped VMNs — all VMNs belong to matched location pairs.
                            </TableCell>
                          </TableRow>
                        )}
                        {data.extraVmns.map((v, i) => (
                          <TableRow key={`${v.vmn}-${v.source}-${i}`}>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/5 px-2 py-1 text-xs font-mono font-medium text-primary">
                                <Phone className="h-3 w-3" />
                                {v.vmn}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'gap-1',
                                  v.source === 'SI'
                                    ? 'text-blue-600 border-blue-500/30'
                                    : 'text-amber-600 border-amber-500/30'
                                )}
                              >
                                {v.source === 'SI' ? (
                                  <PhoneIncoming className="h-3 w-3" />
                                ) : (
                                  <PhoneOutgoing className="h-3 w-3" />
                                )}
                                {v.source}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-mono font-medium">
                                <Hash className="h-3 w-3 text-muted-foreground" />
                                {v.storeCode}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {v.locationName ?? 'Unnamed'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {[v.city, v.state].filter(Boolean).join(', ') || '—'}
                            </TableCell>
                            <TableCell>
                              <IvrLiveBadge live={v.ivrLive} label="" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )
      )}
    </div>
  )
}
