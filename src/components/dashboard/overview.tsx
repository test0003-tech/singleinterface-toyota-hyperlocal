'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  MapPin,
  CircleDot,
  Globe,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getStats } from '@/lib/api'
import type { DashboardStats } from '@/lib/types'

const SI_COLORS = ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899']
const SPOT_COLORS = ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#0ea5e9', '#06b6d4', '#14b8a6']

export function Overview({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadedKey, setLoadedKey] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const loading = loadedKey !== refreshKey

  useEffect(() => {
    let cancelled = false
    getStats()
      .then((s) => {
        if (!cancelled) {
          setStats(s)
          setLoadedKey(refreshKey)
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats(null)
          setLoadedKey(refreshKey)
          setError(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Failed to load stats. Try refreshing.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const siTopStates = stats.si.byState.slice(0, 8)
  const spotTopStates = stats.spotlight.byState.slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="SI Records"
          value={stats.si.total}
          icon={<Building2 className="h-5 w-5" />}
          accent="emerald"
          subtitle={`${stats.si.byState.length} states`}
        />
        <StatCard
          title="Spotlight Records"
          value={stats.spotlight.total}
          icon={<MapPin className="h-5 w-5" />}
          accent="amber"
          subtitle={`${stats.spotlight.byState.length} states`}
        />
        <StatCard
          title="SI Circles"
          value={stats.si.byCircle.length}
          icon={<CircleDot className="h-5 w-5" />}
          accent="cyan"
          subtitle={stats.si.byCircle.map((c) => c.circle).join(', ') || '—'}
        />
        <StatCard
          title="Spotlight Regions"
          value={stats.spotlight.byRegion.length}
          icon={<Globe className="h-5 w-5" />}
          accent="violet"
          subtitle={stats.spotlight.byRegion.map((r) => r.region).join(', ') || '—'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-emerald-600" />
              SI Records by State
            </CardTitle>
            <CardDescription>Top 8 states by SI record count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={siTopStates} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="state"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {siTopStates.map((_, i) => (
                      <Cell key={i} fill={SI_COLORS[i % SI_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-amber-600" />
              Spotlight Records by State
            </CardTitle>
            <CardDescription>Top 8 states by Spotlight record count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spotTopStates} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="state"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {spotTopStates.map((_, i) => (
                      <Cell key={i} fill={SPOT_COLORS[i % SPOT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDot className="h-4 w-4 text-cyan-600" />
              SI by Circle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.si.byCircle.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              stats.si.byCircle.map((c) => (
                <div key={c.circle} className="flex items-center justify-between">
                  <span className="text-sm">{c.circle}</span>
                  <Badge variant="secondary">{c.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              SI GMB Listing Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.si.byGmbStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              stats.si.byGmbStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{s.status}</span>
                  <Badge variant={s.status === 'verified' ? 'default' : 'outline'}>
                    {s.count}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-violet-600" />
              Spotlight by Region
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.spotlight.byRegion.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              stats.spotlight.byRegion.map((r) => (
                <div key={r.region} className="flex items-center justify-between">
                  <span className="text-sm">{r.region}</span>
                  <Badge variant="secondary">{r.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick insight */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Data Summary</p>
              <p className="text-sm text-muted-foreground">
                You are managing{' '}
                <span className="font-semibold text-foreground">
                  {stats.si.total} SI records
                </span>{' '}
                across {stats.si.byState.length} states and{' '}
                <span className="font-semibold text-foreground">
                  {stats.spotlight.total} Spotlight records
                </span>{' '}
                across {stats.spotlight.byState.length} states.
                {stats.si.byGmbStatus.find((s) => s.status !== 'verified') && (
                  <>
                    {' '}
                    <AlertCircle className="inline h-3.5 w-3.5 text-amber-500" />{' '}
                    Some SI records have non-verified GMB listing status.
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
  accent,
}: {
  title: string
  value: number
  icon: React.ReactNode
  subtitle?: string
  accent: 'emerald' | 'amber' | 'cyan' | 'violet'
}) {
  const accentMap = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    cyan: 'bg-cyan-500/10 text-cyan-600',
    violet: 'bg-violet-500/10 text-violet-600',
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-lg p-2 ${accentMap[accent]}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value.toLocaleString()}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 truncate" title={subtitle}>
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
