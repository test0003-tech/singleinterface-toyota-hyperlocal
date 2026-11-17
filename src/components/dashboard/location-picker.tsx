'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ChevronsUpDown, Check, Building2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLocations, type SILocationOption, type SpotlightLocationOption } from '@/lib/api'

interface LocationPickerProps {
  /** Currently selected code (siCode for SI, clientCode for Spotlight) */
  value: string
  /** Called when a location is selected */
  onChange: (code: string) => void
  /** Whether to show SI locations or Spotlight locations */
  type: 'SI' | 'Spotlight'
  /** Show only live/active locations (default: false — show all) */
  liveOnly?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Whether to allow manual code entry as a fallback (default: false) */
  allowManualEntry?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Searchable dropdown for picking an SI or Spotlight location.
 *
 * For SI locations, shows siCode + businessName + city/state.
 * For Spotlight locations, shows clientCode + name + city/state.
 */
export function LocationPicker({
  value,
  onChange,
  type,
  liveOnly = false,
  placeholder,
  allowManualEntry = false,
  disabled = false,
  className,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false)
  const [siLocations, setSiLocations] = useState<SILocationOption[]>([])
  const [spotlightLocations, setSpotlightLocations] = useState<SpotlightLocationOption[]>([])
  const [manualMode, setManualMode] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getLocations()
      .then((res) => {
        if (cancelled) return
        setSiLocations(res.si)
        setSpotlightLocations(res.spotlight)
        setLoaded(true)
      })
      .catch(() => {
        // silent fail — the picker still works in manual mode
      })
    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(() => {
    if (type === 'SI') {
      let list = siLocations
      if (liveOnly) list = list.filter((s) => s.isLive)
      // Ensure the current value is always visible even if not in the list
      if (value && !list.some((s) => s.siCode === value)) {
        list = [
          { siCode: value, clientCode: value, businessName: null, city: null, state: null, circle: null, isLive: false, linkedSpotlightCode: null },
          ...list,
        ]
      }
      return list.map((s) => ({
        code: s.siCode,
        name: s.businessName,
        city: s.city,
        state: s.state,
        isLive: s.isLive,
        searchText: `${s.siCode} ${s.businessName ?? ''} ${s.clientCode} ${s.city ?? ''} ${s.state ?? ''} ${s.circle ?? ''}`,
      }))
    }
    let list = spotlightLocations
    if (liveOnly) list = list.filter((s) => s.isLive)
    if (value && !list.some((s) => s.clientCode === value)) {
      list = [{ clientCode: value, name: null, city: null, state: null, region: null, isLive: false }, ...list]
    }
    return list.map((s) => ({
      code: s.clientCode,
      name: s.name,
      city: s.city,
      state: s.state,
      isLive: s.isLive,
      searchText: `${s.clientCode} ${s.name ?? ''} ${s.city ?? ''} ${s.state ?? ''} ${s.region ?? ''}`,
    }))
  }, [type, siLocations, spotlightLocations, liveOnly, value])

  const selected = options.find((o) => o.code === value)

  const totalLabel = type === 'SI' ? siLocations.length : spotlightLocations.length

  if (manualMode && allowManualEntry) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={type === 'SI' ? 'Enter SI Code, e.g. 10001' : 'Enter Spotlight Client Code, e.g. PU09A'}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setManualMode(false)}
          disabled={disabled}
        >
          Pick from list
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || !loaded}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected ? (
                <>
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-xs font-semibold">{selected.code}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {selected.name ?? selected.city ?? ''}
                  </span>
                  {selected.isLive && (
                    <Badge className="shrink-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 text-[9px] px-1 py-0">
                      Live
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  {loaded
                    ? placeholder ?? `Select ${type} location (${totalLabel} available)...`
                    : 'Loading locations...'}
                </span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${type} locations by code, name, city...`} />
            <CommandList>
              <CommandEmpty>
                {loaded ? `No ${type} location found.` : 'Loading...'}
              </CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.code}
                    value={o.searchText}
                    onSelect={() => {
                      onChange(o.code)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === o.code ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-mono text-xs font-semibold">{o.code}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {[o.name, o.city, o.state].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </div>
                      {o.isLive && (
                        <Badge className="ml-auto shrink-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 text-[9px] px-1 py-0">
                          Live
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {allowManualEntry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setManualMode(true)}
          disabled={disabled}
          title="Enter code manually"
          className="shrink-0"
        >
          Manual
        </Button>
      )}
    </div>
  )
}
