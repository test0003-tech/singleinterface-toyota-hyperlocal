'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import type { FieldDef } from '@/lib/fields'

export interface RecordFormModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  fields: FieldDef[]
  initial?: Record<string, string | null>
  onSubmit: (values: Record<string, string | null>) => Promise<void>
  submitLabel?: string
}

function emptyValues(fields: FieldDef[]): Record<string, string> {
  const v: Record<string, string> = {}
  for (const f of fields) v[f.name] = ''
  return v
}

export function RecordFormModal({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  onSubmit,
  submitLabel = 'Save',
}: RecordFormModalProps) {
  const [values, setValues] = useState<Record<string, string>>(emptyValues(fields))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      const v = emptyValues(fields)
      if (initial) {
        for (const k of Object.keys(v)) {
          const val = initial[k]
          v[k] = val ?? ''
        }
      }
      setValues(v)
      setErrors({})
    }
  }, [open, initial])

  const requiredFields = useMemo(
    () => fields.filter((f) => f.required).map((f) => f.name),
    [fields]
  )

  function setValue(name: string, val: string) {
    setValues((prev) => ({ ...prev, [name]: val }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    for (const name of requiredFields) {
      if (!values[name]?.trim()) errs[name] = 'Required'
    }
    // Run per-field validators
    for (const f of fields) {
      if (errs[f.name]) continue
      const val = values[f.name] ?? ''
      if (f.validate) {
        const v = f.validate(val)
        if (v) errs[f.name] = v
      }
    }
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, string | null> = {}
      for (const f of fields) {
        const val = values[f.name]?.trim() ?? ''
        payload[f.name] = val === '' ? null : val
      }
      await onSubmit(payload)
      onOpenChange(false)
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : 'Submission failed',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-2">
              {fields.map((f) => {
                const colSpan = f.full ? 'sm:col-span-2' : ''
                const error = errors[f.name]
                return (
                  <div key={f.name} className={`space-y-1.5 ${colSpan}`}>
                    <Label htmlFor={f.name} className="text-xs font-medium">
                      {f.label}
                      {f.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {f.type === 'textarea' || f.multiline ? (
                      <Textarea
                        id={f.name}
                        value={values[f.name] ?? ''}
                        onChange={(e) => setValue(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        rows={2}
                        className={error ? 'border-destructive' : ''}
                      />
                    ) : f.type === 'select' ? (
                      <Select
                        value={values[f.name] ?? '__none__'}
                        onValueChange={(v) =>
                          setValue(f.name, v === '__none__' ? '' : v)
                        }
                      >
                        <SelectTrigger className={error ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">None</span>
                          </SelectItem>
                          {f.options?.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={f.name}
                        type={
                          f.type === 'url'
                            ? 'url'
                            : f.type === 'number'
                              ? 'number'
                              : f.type === 'date'
                                ? 'month'
                                : 'text'
                        }
                        step={f.type === 'number' ? 'any' : undefined}
                        value={values[f.name] ?? ''}
                        onChange={(e) => setValue(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        className={error ? 'border-destructive' : ''}
                      />
                    )}
                    {f.hint && !error && (
                      <p className="text-xs text-muted-foreground">{f.hint}</p>
                    )}
                    {error && (
                      <p className="text-xs text-destructive">{error}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          {errors._form && (
            <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {errors._form}
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
