'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  Play,
  Zap,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  evaluateRules,
} from '@/lib/api'
import type {
  Rule,
  RuleInput,
  RuleTargetType,
  RuleOperator,
  RuleSeverity,
} from '@/lib/types'
import { RULE_FIELDS, RULE_OPERATORS } from '@/lib/types'

const TARGET_LABELS: Record<RuleTargetType, string> = {
  SI: 'SI Record',
  Spotlight: 'Spotlight Record',
  MediaSpend: 'Media Spend',
  PlatformFee: 'Platform Fee',
}

const SEVERITY_CONFIG: Record<RuleSeverity, { icon: React.ReactNode; class: string; badge: string }> = {
  critical: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    class: 'text-destructive',
    badge: 'bg-destructive text-destructive-foreground',
  },
  warning: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    class: 'text-amber-600',
    badge: 'bg-amber-500 text-white',
  },
  info: {
    icon: <Info className="h-3.5 w-3.5" />,
    class: 'text-primary',
    badge: 'bg-primary text-primary-foreground',
  },
}

export function RulesPage() {
  const { toast } = useToast()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evalSummary, setEvalSummary] = useState<{
    totalRules: number
    totalMatches: number
  } | null>(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listRules()
      setRules(res.data)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load rules',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(rule: Rule) {
    setEditing(rule)
    setFormOpen(true)
  }

  async function handleSubmit(input: RuleInput) {
    if (editing) {
      await updateRule(editing.id, input)
      toast({ title: 'Rule updated', description: input.name })
    } else {
      await createRule(input)
      toast({ title: 'Rule created', description: input.name })
    }
    await fetchRules()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRule(deleteTarget.id)
      toast({ title: 'Rule deleted', description: deleteTarget.name })
      setDeleteTarget(null)
      await fetchRules()
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggleEnabled(rule: Rule, enabled: boolean) {
    try {
      await updateRule(rule.id, {
        name: rule.name,
        description: rule.description,
        targetType: rule.targetType,
        field: rule.field,
        operator: rule.operator,
        value: rule.value,
        severity: rule.severity,
        scopeMonth: rule.scopeMonth,
        isEnabled: enabled,
      })
      await fetchRules()
      toast({
        title: enabled ? 'Rule enabled' : 'Rule disabled',
        description: rule.name,
      })
    } catch (e) {
      toast({
        title: 'Toggle failed',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    }
  }

  async function handleEvaluate() {
    setEvaluating(true)
    try {
      const res = await evaluateRules()
      setEvalSummary({
        totalRules: res.totalRules,
        totalMatches: res.totalMatches,
      })
      toast({
        title: 'Evaluation complete',
        description: `${res.totalRules} rules evaluated, ${res.totalMatches} matches found`,
      })
    } catch (e) {
      toast({
        title: 'Evaluation failed',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setEvaluating(false)
    }
  }

  const enabledCount = rules.filter((r) => r.isEnabled).length
  const criticalCount = rules.filter((r) => r.severity === 'critical' && r.isEnabled).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Alert Rules
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define custom rules that automatically generate alerts based on your
            data conditions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEvaluate} disabled={evaluating}>
            {evaluating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Evaluate Now
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Rules</p>
            <p className="text-2xl font-bold mt-1">{rules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Enabled</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{enabledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Critical</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Matches Found</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">
              {evalSummary?.totalMatches ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Evaluation result banner */}
      {evalSummary && (
        <div className="rounded-lg border bg-primary/5 p-4 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Last Evaluation</p>
            <p className="text-xs text-muted-foreground">
              Evaluated <b>{evalSummary.totalRules}</b> rules —{' '}
              <b>{evalSummary.totalMatches}</b> total matches across all rules.
              {evalSummary.totalMatches > 0 && ' Check the Overview tab to see alerts.'}
            </p>
          </div>
        </div>
      )}

      {/* Rules table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-center">Enabled</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full max-w-[140px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rules.length > 0 ? (
                rules.map((rule) => {
                  const sev = SEVERITY_CONFIG[rule.severity]
                  const fieldDef = RULE_FIELDS.find((f) => f.field === rule.field)
                  const opDef = RULE_OPERATORS.find((o) => o.value === rule.operator)
                  return (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{rule.name}</span>
                          {rule.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">
                              {rule.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {fieldDef?.label ?? rule.field} {opDef?.label ?? rule.operator}{' '}
                          {rule.value ?? ''}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${sev.badge}`}>
                          {sev.icon}
                          <span className="ml-1 capitalize">{rule.severity}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TARGET_LABELS[rule.targetType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {rule.scopeMonth ? 'Current month' : 'All records'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={rule.isEnabled}
                          onCheckedChange={(v) => handleToggleEnabled(rule, v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(rule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteTarget(rule)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No rules yet. Default rules will be seeded on first evaluation,
                    or click &quot;New Rule&quot; to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <RuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RuleFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Rule | null
  onSubmit: (input: RuleInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetType, setTargetType] = useState<RuleTargetType>('MediaSpend')
  const [field, setField] = useState('allocated')
  const [operator, setOperator] = useState<RuleOperator>('greater_than')
  const [value, setValue] = useState('')
  const [severity, setSeverity] = useState<RuleSeverity>('warning')
  const [scopeMonth, setScopeMonth] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setDescription(editing?.description ?? '')
      setTargetType(editing?.targetType ?? 'MediaSpend')
      setField(editing?.field ?? 'allocated')
      setOperator(editing?.operator ?? 'greater_than')
      setValue(editing?.value ?? '')
      setSeverity(editing?.severity ?? 'warning')
      setScopeMonth(editing?.scopeMonth ?? true)
      setError(null)
    }
  }, [open, editing])

  // When targetType changes, reset field to first available for that target
  const availableFields = RULE_FIELDS.filter((f) => f.applicableTo.includes(targetType))
  useEffect(() => {
    if (availableFields.length > 0 && !availableFields.find((f) => f.field === field)) {
      setField(availableFields[0].field)
    }
     
  }, [targetType])

  const currentOp = RULE_OPERATORS.find((o) => o.value === operator)
  const currentField = RULE_FIELDS.find((f) => f.field === field)
  const needsValue = currentOp?.needsValue ?? true
  const isBooleanField = currentField?.type === 'boolean'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Rule name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        targetType,
        field,
        operator,
        value: needsValue ? value.trim() || null : null,
        severity,
        scopeMonth,
        isEnabled: editing?.isEnabled ?? true,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {editing ? 'Edit Rule' : 'Create Alert Rule'}
          </DialogTitle>
          <DialogDescription>
            Define a condition that generates an alert when matched.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-name" className="text-xs font-medium">
                Rule Name *
              </Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Media spend over 90% utilized"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-desc" className="text-xs font-medium">Description</Label>
              <Textarea
                id="rule-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What does this rule check?"
              />
            </div>

            {/* Condition builder */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Condition
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Target Type</Label>
                  <Select value={targetType} onValueChange={(v) => setTargetType(v as RuleTargetType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TARGET_LABELS) as RuleTargetType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TARGET_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Field</Label>
                  <Select value={field} onValueChange={setField}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((f) => (
                        <SelectItem key={f.field} value={f.field}>
                          {f.label}
                          {f.description && (
                            <span className="text-muted-foreground ml-1">({f.description})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Operator</Label>
                  <Select value={operator} onValueChange={(v) => setOperator(v as RuleOperator)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Value {!needsValue && <span className="text-muted-foreground">(not needed)</span>}
                  </Label>
                  {isBooleanField && needsValue ? (
                    <Select value={value || 'true'} onValueChange={setValue}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={needsValue ? 'Enter value...' : 'N/A'}
                      disabled={!needsValue}
                    />
                  )}
                </div>
              </div>
              {/* Condition preview */}
              <div className="rounded bg-background border px-3 py-2">
                <p className="text-xs text-muted-foreground">Alert when:</p>
                <p className="text-sm font-medium mt-0.5">
                  <span className="text-primary">{TARGET_LABELS[targetType]}</span>{' '}
                  <code className="text-xs">{currentField?.label ?? field}</code>{' '}
                  <span className="text-muted-foreground">{currentOp?.label ?? operator}</span>{' '}
                  {needsValue && <code className="text-xs">{value || '...'}</code>}
                </p>
              </div>
            </div>

            {/* Severity + Scope */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as RuleSeverity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Scope</Label>
                <Select
                  value={scopeMonth ? 'current' : 'all'}
                  onValueChange={(v) => setScopeMonth(v === 'current')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current month only</SelectItem>
                    <SelectItem value="all">All records</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
