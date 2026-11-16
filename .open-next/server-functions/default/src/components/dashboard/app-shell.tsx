'use client'

import { useState, useCallback } from 'react'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import {
  Database,
  LayoutDashboard,
  Building2,
  MapPin,
  Upload,
  Wallet,
  Receipt,
  RefreshCw,
  Bell,
  Shield,
  ShieldAlert,
} from 'lucide-react'
import { Overview } from '@/components/dashboard/overview'
import { SIDataTable } from '@/components/dashboard/si-data-table'
import { SpotlightDataTable } from '@/components/dashboard/spotlight-data-table'
import { MediaSpendTab } from '@/components/dashboard/media-spend-tab'
import { PlatformFeesTab } from '@/components/dashboard/platform-fees-tab'
import { ImportDialog } from '@/components/dashboard/import-dialog'
import { RemindersWidget } from '@/components/dashboard/reminders-widget'
import { RulesPage } from '@/components/dashboard/rules-page'
import { AlertsCenterPage } from '@/components/dashboard/alerts-center-page'
import { useToast } from '@/hooks/use-toast'
import { formatMonth } from '@/lib/validation'

type PageId = 'overview' | 'si' | 'spotlight' | 'media-spend' | 'platform-fees' | 'alerts' | 'rules'

interface NavItem {
  id: PageId
  label: string
  icon: React.ReactNode
  description: string
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Dashboard',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        icon: <LayoutDashboard className="h-4 w-4" />,
        description: 'Reminders, stats & finance summary',
      },
      {
        id: 'alerts',
        label: 'Alerts Center',
        icon: <ShieldAlert className="h-4 w-4" />,
        description: 'All active alerts from rules & built-in checks',
      },
    ],
  },
  {
    label: 'Location Data',
    items: [
      {
        id: 'si',
        label: 'SI Data',
        icon: <Building2 className="h-4 w-4" />,
        description: 'Store Information records',
      },
      {
        id: 'spotlight',
        label: 'Spotlight',
        icon: <MapPin className="h-4 w-4" />,
        description: 'Spotlight location records',
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        id: 'media-spend',
        label: 'Media Spend',
        icon: <Wallet className="h-4 w-4" />,
        description: 'Per-location monthly media budget',
      },
      {
        id: 'platform-fees',
        label: 'Platform Fees',
        icon: <Receipt className="h-4 w-4" />,
        description: 'Monthly platform fees per location',
      },
    ],
  },
  {
    label: 'Automation',
    items: [
      {
        id: 'rules',
        label: 'Alert Rules',
        icon: <Shield className="h-4 w-4" />,
        description: 'Define custom alert rules for your data',
      },
    ],
  },
]

const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

export function AppShell() {
  const { toast } = useToast()
  const [page, setPage] = useState<PageId>('overview')
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

  const currentItem = ALL_ITEMS.find((i) => i.id === page) ?? ALL_ITEMS[0]
  const currentGroup =
    NAV_GROUPS.find((g) => g.items.some((i) => i.id === page))?.label ?? 'Dashboard'
  const currentMonth = formatMonth(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  )

  return (
    <SidebarProvider>
      {/* Sidebar */}
      <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Database className="h-5 w-5" />
              </div>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold leading-tight">
                  SingleInterface
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Toyota Hyperlocal
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarSeparator />

          <SidebarContent>
            {NAV_GROUPS.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={page === item.id}
                          onClick={() => setPage(item.id)}
                          tooltip={item.label}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter>
            <SidebarSeparator />
            <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                Current Month
              </p>
              <p className="text-xs font-medium mt-0.5">{currentMonth}</p>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setImportOpen(true)}
                  tooltip="Import Excel"
                >
                  <Upload className="h-4 w-4" />
                  <span>Import Excel</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main content area */}
        <SidebarInset>
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="hidden sm:inline text-xs text-muted-foreground/70">
                  {currentGroup}
                </span>
                <span className="hidden sm:inline text-muted-foreground/40">/</span>
                <h1 className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {currentItem.icon}
                  {currentItem.label}
                </h1>
                <span className="hidden md:inline text-xs text-muted-foreground">
                  — {currentItem.description}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                title="Refresh data"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative"
                onClick={() => setPage('alerts')}
                title="View alerts"
              >
                <Bell className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className="hidden sm:flex"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6">
            {page === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Overview of all your location data records, live status, and finances.
                  </p>
                </div>
                <Overview refreshKey={refreshKey} />
              </div>
            )}
            {page === 'si' && <SIDataTable onRefresh={handleRefresh} />}
            {page === 'spotlight' && <SpotlightDataTable onRefresh={handleRefresh} />}
            {page === 'media-spend' && <MediaSpendTab refreshKey={refreshKey} />}
            {page === 'platform-fees' && <PlatformFeesTab refreshKey={refreshKey} />}
            {page === 'alerts' && <AlertsCenterPage refreshKey={refreshKey} />}
            {page === 'rules' && <RulesPage />}
          </main>

          {/* Footer */}
          <footer className="border-t bg-background mt-auto">
            <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                SingleInterface Toyota Hyperlocal — Location Data Dashboard
              </p>
              <p className="text-xs text-muted-foreground">
                {currentMonth} • Built with Next.js &amp; Prisma
              </p>
            </div>
          </footer>
        </SidebarInset>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />
    </SidebarProvider>
  )
}
