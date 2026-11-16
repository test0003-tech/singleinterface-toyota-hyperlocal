'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Link2,
  Unlink,
  MapPin,
  Building2,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Search,
  ExternalLink,
  TrendingUp,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ---- Types ----

interface MappingRow {
  siId: string
  siCode: string
  siClientCode: string
  siName: string | null
  siCity: string | null
  siState: string | null
  siCircle: string | null
  siIsLive: boolean
  spotlightId: string | null
  spotlightCode: string | null
  spotlightName: string | null
  spotlightCity: string | null
  spotlightState: string | null
  spotlightRegion: string | null
  spotlightIsLive: boolean | null
  spotlightDomain: string | null
  matchType: 'manual' | 'auto' | 'none'
  matchScore: number
}

interface UnmatchedSpotlightRow {
  id: string
  clientCode: string
  name: string | null
  city: string | null
  state: string | null
  region: string | null
  isLive: boolean
  domain: string | null
}

interface MappingSummary {
  totalSI: number
  totalSpotlight: number
  matched: number
  manuallyLinked: number
  autoMatched: number
  unmatchedSI: number
  unmatchedSpotlight: number
  matchRate: number
}

interface LocationMappingData {
  mappings: MappingRow[]
  unmatchedSpotlight: UnmatchedSpotlightRow[]
  summary: MappingSummary
}

type TabId = 'mapped' | 'unmatched-si' | 'unmatched-spotlight'

const MIN_SCORE_OPTIONS = [50, 60, 70, 80, 90]
const PAGE_SIZE = 50

// ---- API helpers ----

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

function linkRecords(siId: string, spotlightCode: string | null) {
  return fetchJson<{ success: boolean }>('/api/location-mapping/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siId, spotlightCode }),
  })
}

// ---- Small presentational helpers ----

function LiveBadge({ live }: { live: boolean | null }) {
  if (live === null || live === undefined) return null
  return live ? (
    <Badge className="h-5 px-1.5 text-[10px] bg-emerald-600 text-white hover:bg-emerald-600">
      Live
    </Badge>
  ) : (
    <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
      Not Live
    </Badge>
  )
}

function MatchTypeBadge({ type, score }: { type: MappingRow['matchType']; score: number }) {
  if (type === 'manual') {
    return (
      <Badge className="bg-primary text-primary-foreground text-xs">
        <Link2 className="h-3 w-3" />
        <span className="ml-1">Manual</span>
      </Badge>
    )
  }
  if (type === 'auto') {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-xs">
        <Zap className="h-3 w-3" />
        <span className="ml-1">Auto · {score}%</span>
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-xs text-muted-foreground">
      Unmatched
    </Badge>
  )
}

function RecordCell({
  code,
  name,
  city,
  state,
  extra,
  live,
  domain,
}: {
  code: string | null
  name: string | null
  city: string | null
  state: string | null
  extra?: string | null
  live: boolean | null
  domain?: string | null
}) {
  const location = [city, state, extra].filter(Boolean).join(', ')
  return (
    <div className="flex flex-col gap-1 min-w-[170px] py-0.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {code ? (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{code}</code>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        <LiveBadge live={live} />
      </div>
      {name && (
        <span className="text-sm font-medium leading-snug line-clamp-1 max-w-[250px]" title={name}>
          {name}
        </span>
      )}
      {location && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[220px]">{location}</span>
        </span>
      )}
      {domain && (
        <a
          href={domain}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 truncate max-w-[220px]"
          title={domain}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {domain.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <p className="text-xs uppercase tracking-wide">{label}</p>
        </div>
        <p className={`text-2xl font-bold mt-1.5 ${valueClass ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function LoadMoreButton({
  remaining,
  onClick,
}: {
  remaining: number
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-3 border-t p-3">
      <Button variant="outline" size="sm" onClick={onClick}>
        Load More
      </Button>
      <span className="text-xs text-muted-foreground">{remaining} more rows</span>
    </div>
  )
}

// ---- Main component ----

export function LocationMappingPage() {
  const { toast } = useToast()
  const [data, setData] = useState<LocationMappingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [minScore, setMinScore] = useState(50)
  const [tab, setTab] = useState<TabId>('mapped')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [busySiId, setBusySiId] = useState<string | null>(null)
  const [autoLinkProgress, setAutoLinkProgress] = useState<{ done: number; total: number } | null>(
    null
  )
  const hasDataRef = useRef(false)

  const fetchData = useCallback(
    async (score: number) => {
      setRefreshing(true)
      setError(null)
      try {
        const json = await fetchJson<LocationMappingData>(
          `/api/location-mapping?minScore=${score}`
        )
        setData(json)
        hasDataRef.current = true
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load location mapping'
        setError(msg)
        if (hasDataRef.current) {
          toast({
            title: 'Refresh failed',
            description: msg,
            variant: 'destructive',
          })
        }
      } finally {
        setRefreshing(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    fetchData(minScore)
  }, [fetchData, minScore])

  // Reset pagination when the view changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [tab, query])

  // ---- Derived data ----

  const mappedRows = useMemo(() => {
    if (!data) return []
    return data.mappings
      .filter((m) => m.matchType !== 'none' && m.spotlightCode)
      .sort((a, b) => {
        if (a.matchType !== b.matchType) return a.matchType === 'manual' ? -1 : 1
        return b.matchScore - a.matchScore
      })
  }, [data])

  const unmatchedSiRows = useMemo(
    () => (data ? data.mappings.filter((m) => m.matchType === 'none') : []),
    [data]
  )

  const unmatchedSpotRows = data?.unmatchedSpotlight ?? []

  const q = query.trim().toLowerCase()

  const filteredMapped = useMemo(() => {
    if (!q) return mappedRows
    return mappedRows.filter((r) =>
      [
        r.siCode,
        r.siClientCode,
        r.siName,
        r.siCity,
        r.siState,
        r.spotlightCode,
        r.spotlightName,
        r.spotlightCity,
        r.spotlightState,
      ].some((t) => !!t && t.toLowerCase().includes(q))
    )
  }, [mappedRows, q])

  const filteredUnmatchedSi = useMemo(() => {
    if (!q) return unmatchedSiRows
    return unmatchedSiRows.filter((r) =>
      [r.siCode, r.siClientCode, r.siName, r.siCity, r.siState, r.siCircle].some(
        (t) => !!t && t.toLowerCase().includes(q)
      )
    )
  }, [unmatchedSiRows, q])

  const filteredUnmatchedSpot = useMemo(() => {
    if (!q) return unmatchedSpotRows
    return unmatchedSpotRows.filter((r) =>
      [r.clientCode, r.name, r.city, r.state, r.region, r.domain].some(
        (t) => !!t && t.toLowerCase().includes(q)
      )
    )
  }, [unmatchedSpotRows, q])

  // ---- Actions ----

  async function handleLink(row: MappingRow, spotlightCode: string | null) {
    setBusySiId(row.siId)
    try {
      await linkRecords(row.siId, spotlightCode)
      toast({
        title: spotlightCode ? 'Records linked' : 'Link removed',
        description: spotlightCode
          ? `SI ${row.siCode} is now linked to Spotlight ${spotlightCode}`
          : `SI ${row.siCode} was unlinked from Spotlight`,
      })
      await fetchData(minScore)
    } catch (e) {
      toast({
        title: spotlightCode ? 'Link failed' : 'Unlink failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setBusySiId(null)
    }
  }

  async function handleAutoLinkAll() {
    if (!data || autoLinkProgress) return
    const targets = data.mappings.filter((m) => m.matchType === 'auto' && m.spotlightCode)
    if (targets.length === 0) {
      toast({
        title: 'Nothing to auto-link',
        description: 'No auto-matched pairs above the current score threshold.',
      })
      return
    }
    setAutoLinkProgress({ done: 0, total: targets.length })
    let linked = 0
    let failed = 0
    for (let i = 0; i < targets.length; i++) {
      try {
        await linkRecords(targets[i].siId, targets[i].spotlightCode)
        linked++
      } catch {
        failed++
      }
      setAutoLinkProgress({ done: i + 1, total: targets.length })
    }
    setAutoLinkProgress(null)
    toast({
      title: 'Auto-link complete',
      description: `${linked} pair${linked === 1 ? '' : 's'} linked${
        failed > 0 ? `, ${failed} failed` : ''
      }.`,
      variant: failed > 0 && linked === 0 ? 'destructive' : undefined,
    })
    await fetchData(minScore)
  }

  // ---- Render ----

  if (!data) {
    if (error) {
      return (
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Failed to load location mapping
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchData(minScore)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-14" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-3 flex items-center gap-2 border-b">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-5 w-6" />
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const summary = data.summary
  const actionsDisabled = refreshing || !!autoLinkProgress
  const autoLinkCount = summary.autoMatched

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Location Mapping
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            SI ↔ Spotlight record mapping — auto-matched by dealer name, city, and state
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="min-score" className="text-xs text-muted-foreground whitespace-nowrap">
              Min Score
            </Label>
            <Select
              value={String(minScore)}
              onValueChange={(v) => setMinScore(Number(v))}
              disabled={actionsDisabled}
            >
              <SelectTrigger id="min-score" className="w-[88px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIN_SCORE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={handleAutoLinkAll}
            disabled={actionsDisabled || autoLinkCount === 0}
            title="Confirm all auto-matched pairs as manual links"
          >
            {autoLinkProgress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking {autoLinkProgress.done}/{autoLinkProgress.total}…
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Auto-Link All{autoLinkCount > 0 ? ` (${autoLinkCount})` : ''}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(minScore)}
            disabled={actionsDisabled}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <SummaryCard
          label="Total SI"
          value={summary.totalSI}
          icon={<Building2 className="h-3.5 w-3.5" />}
        />
        <SummaryCard
          label="Total Spotlight"
          value={summary.totalSpotlight}
          icon={<MapPin className="h-3.5 w-3.5" />}
        />
        <SummaryCard
          label="Matched"
          value={summary.matched}
          valueClass="text-emerald-600"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <SummaryCard
          label="Manually Linked"
          value={summary.manuallyLinked}
          valueClass="text-primary"
          icon={<Link2 className="h-3.5 w-3.5" />}
        />
        <SummaryCard
          label="Auto-Matched"
          value={summary.autoMatched}
          valueClass="text-amber-600"
          icon={<Zap className="h-3.5 w-3.5" />}
        />
        <SummaryCard
          label="Match Rate"
          value={`${summary.matchRate}%`}
          valueClass="text-emerald-600"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Tabs: mapped / unmatched SI / unmatched Spotlight */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="mapped" className="gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              All Mapped
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
                {summary.matched}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unmatched-si" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Unmatched SI
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
                {summary.unmatchedSI}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unmatched-spotlight" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Unmatched Spotlight
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
                {summary.unmatchedSpotlight}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code, name, or city…"
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* All Mapped tab */}
        <TabsContent value="mapped" className="mt-3">
          <div className={`rounded-lg border bg-card overflow-hidden transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SI Record</TableHead>
                    <TableHead className="w-[44px] text-center" aria-label="Mapped to" />
                    <TableHead>Spotlight Record</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="w-[110px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMapped.length > 0 ? (
                    filteredMapped.slice(0, visibleCount).map((row) => {
                      const busy = busySiId === row.siId
                      return (
                        <TableRow key={row.siId}>
                          <TableCell>
                            <RecordCell
                              code={row.siCode}
                              name={row.siName}
                              city={row.siCity}
                              state={row.siState}
                              extra={row.siCircle}
                              live={row.siIsLive}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                            ) : (
                              <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <RecordCell
                              code={row.spotlightCode}
                              name={row.spotlightName}
                              city={row.spotlightCity}
                              state={row.spotlightState}
                              extra={row.spotlightRegion}
                              live={row.spotlightIsLive}
                            />
                          </TableCell>
                          <TableCell>
                            <MatchTypeBadge type={row.matchType} score={row.matchScore} />
                          </TableCell>
                          <TableCell className="text-right">
                            {row.matchType === 'manual' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-destructive hover:text-destructive"
                                disabled={busy || actionsDisabled}
                                onClick={() => handleLink(row, null)}
                              >
                                <Unlink className="mr-1.5 h-3.5 w-3.5" />
                                Unlink
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={busy || actionsDisabled}
                                onClick={() => handleLink(row, row.spotlightCode)}
                                title="Confirm this auto match as a manual link"
                              >
                                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                                Link
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                        {query
                          ? 'No mapped records match your search.'
                          : 'No mapped records yet. Link records from the Unmatched SI tab or lower the score threshold.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredMapped.length > visibleCount && (
              <LoadMoreButton
                remaining={filteredMapped.length - visibleCount}
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              />
            )}
          </div>
        </TabsContent>

        {/* Unmatched SI tab */}
        <TabsContent value="unmatched-si" className="mt-3">
          <div className={`rounded-lg border bg-card overflow-hidden transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SI Record</TableHead>
                    <TableHead className="w-[300px]">Link to Spotlight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnmatchedSi.length > 0 ? (
                    filteredUnmatchedSi.slice(0, visibleCount).map((row) => {
                      const busy = busySiId === row.siId
                      return (
                        <TableRow key={row.siId}>
                          <TableCell>
                            <RecordCell
                              code={row.siCode}
                              name={row.siName}
                              city={row.siCity}
                              state={row.siState}
                              extra={row.siCircle}
                              live={row.siIsLive}
                            />
                          </TableCell>
                          <TableCell>
                            {unmatchedSpotRows.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <Select
                                  key={row.siId}
                                  disabled={busy || actionsDisabled}
                                  onValueChange={(v) => handleLink(row, v)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a Spotlight record…" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    {unmatchedSpotRows.map((s) => (
                                      <SelectItem key={s.id} value={s.clientCode}>
                                        {s.clientCode} — {s.name ?? 'Unnamed'}
                                        {s.city ? ` (${s.city})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {busy && (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No Spotlight records available to link
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="h-28 text-center text-muted-foreground">
                        {query
                          ? 'No unmatched SI records match your search.'
                          : 'Every SI record is mapped to a Spotlight record.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredUnmatchedSi.length > visibleCount && (
              <LoadMoreButton
                remaining={filteredUnmatchedSi.length - visibleCount}
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              />
            )}
          </div>
        </TabsContent>

        {/* Unmatched Spotlight tab */}
        <TabsContent value="unmatched-spotlight" className="mt-3">
          <div className={`rounded-lg border bg-card overflow-hidden transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Spotlight Record</TableHead>
                    <TableHead className="w-[110px]">Region</TableHead>
                    <TableHead className="w-[220px]">Domain</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnmatchedSpot.length > 0 ? (
                    filteredUnmatchedSpot.slice(0, visibleCount).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <RecordCell
                            code={row.clientCode}
                            name={row.name}
                            city={row.city}
                            state={row.state}
                            live={row.isLive}
                          />
                        </TableCell>
                        <TableCell>
                          {row.region ? (
                            <Badge variant="outline" className="text-xs">
                              {row.region}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.domain ? (
                            <a
                              href={row.domain}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1 truncate max-w-[200px]"
                              title={row.domain}
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              {row.domain.replace(/^https?:\/\//, '')}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-28 text-center text-muted-foreground">
                        {query
                          ? 'No unmatched Spotlight records match your search.'
                          : 'Every Spotlight record is mapped to an SI record.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredUnmatchedSpot.length > visibleCount && (
              <LoadMoreButton
                remaining={filteredUnmatchedSpot.length - visibleCount}
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
