'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Database,
  LayoutDashboard,
  Building2,
  MapPin,
  Upload,
  Github,
  RefreshCw,
} from 'lucide-react'
import { Overview } from '@/components/dashboard/overview'
import { SIDataTable } from '@/components/dashboard/si-data-table'
import { SpotlightDataTable } from '@/components/dashboard/spotlight-data-table'
import { ImportDialog } from '@/components/dashboard/import-dialog'
import { useToast } from '@/hooks/use-toast'

export default function Home() {
  const { toast } = useToast()
  const [tab, setTab] = useState('overview')
  const [importOpen, setImportOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleImported = useCallback(() => {
    handleRefresh()
    toast({
      title: 'Data refreshed',
      description: 'Dashboard updated with imported data.',
    })
  }, [handleRefresh, toast])

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">
                Location Data Dashboard
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Manage SI &amp; Spotlight records
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Excel
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="si" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              SI Data
            </TabsTrigger>
            <TabsTrigger value="spotlight" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Spotlight
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Overview of all your location data records.
              </p>
            </div>
            <Overview refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="si" className="mt-0">
            <SIDataTable onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="spotlight" className="mt-0">
            <SpotlightDataTable onRefresh={handleRefresh} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Location Data Dashboard - Manage SI &amp; Spotlight records
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Built with Next.js &amp; Prisma
            </span>
            <Github className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </footer>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />
    </div>
  )
}
