import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { auditLog } from '@/lib/audit'
import type { RuleTargetType, RuleOperator, RuleSeverity } from '@/lib/types'

/**
 * Alert Rules Excel/CSV import.
 *
 * Expected columns (case-insensitive header matching):
 *   NAME (required)
 *   DESCRIPTION
 *   TARGET TYPE / TARGET -> SI | Spotlight | MediaSpend | PlatformFee
 *   FIELD -> e.g. isLive, allocated, paymentStatus, gmbListingStatus, ...
 *   OPERATOR -> equals|not_equals|greater_than|less_than|contains|is_empty|is_not_empty|days_overdue
 *   VALUE -> the comparison value (string)
 *   SEVERITY -> info|warning|critical (default: warning)
 *   SCOPE MONTH / SCOPE -> true|false (default: true)
 *   ENABLED -> true|false (default: true)
 *
 * In upsert mode, rules are matched by name (case-insensitive). In replace
 * mode, all existing rules are deleted first (seeds are re-created on next
 * reminders fetch).
 */

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

const VALID_TARGETS: RuleTargetType[] = ['SI', 'Spotlight', 'MediaSpend', 'PlatformFee']
const VALID_OPERATORS: RuleOperator[] = [
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
  'days_overdue',
]
const VALID_SEVERITIES: RuleSeverity[] = ['info', 'warning', 'critical']

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '' || s.toLowerCase() === 'null') return null
  return s
}

function pickColumn(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const k = keys.find((key) => key.trim().toLowerCase() === alias.toLowerCase())
    if (k !== undefined && row[k] !== null && row[k] !== undefined) return row[k]
  }
  return undefined
}

function normalizeTarget(v: unknown): RuleTargetType | null {
  const s = cleanStr(v)?.toLowerCase().replace(/[\s-]/g, '')
  if (!s) return null
  if (s === 'si') return 'SI'
  if (s === 'spotlight') return 'Spotlight'
  if (s === 'mediaspend') return 'MediaSpend'
  if (s === 'platformfee') return 'PlatformFee'
  return null
}

function normalizeOperator(v: unknown): RuleOperator | null {
  const s = cleanStr(v)?.toLowerCase().replace(/[\s-]/g, '_')
  if (!s) return null
  if (VALID_OPERATORS.includes(s as RuleOperator)) return s as RuleOperator
  // Common aliases
  if (s === '=') return 'equals'
  if (s === '!=' || s === '<>') return 'not_equals'
  if (s === '>') return 'greater_than'
  if (s === '<') return 'less_than'
  if (s === '>=') return 'greater_or_equal'
  if (s === '<=') return 'less_or_equal'
  if (s.includes('empty') && s.includes('not')) return 'is_not_empty'
  if (s.includes('empty')) return 'is_empty'
  if (s.includes('overdue')) return 'days_overdue'
  return null
}

function normalizeSeverity(v: unknown): RuleSeverity {
  const s = cleanStr(v)?.toLowerCase()
  if (s && VALID_SEVERITIES.includes(s as RuleSeverity)) return s as RuleSeverity
  if (s?.includes('crit')) return 'critical'
  if (s?.includes('info')) return 'info'
  return 'warning'
}

function parseBool(v: unknown, def = true): boolean {
  const s = cleanStr(v)?.toLowerCase()
  if (s === null || s === undefined) return def
  if (s === 'true' || s === 'yes' || s === '1' || s === 'y') return true
  if (s === 'false' || s === 'no' || s === '0' || s === 'n') return false
  return def
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const mode = (formData.get('mode') as string) === 'replace' ? 'replace' : 'upsert'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const buf = Buffer.from(bytes)
    const wb = XLSX.read(buf, { type: 'buffer' })

    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'No sheet found in workbook' }, { status: 400 })
    }
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

    if (mode === 'replace') {
      await db.rule.deleteMany({})
    }

    // Cache existing rules by name (lowercase) for upsert matching
    const existingRules = await db.rule.findMany({
      select: { id: true, name: true },
    })
    const ruleByName = new Map(
      existingRules.map((r) => [r.name.toLowerCase(), r])
    )

    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    }

    for (const [idx, row] of rows.entries()) {
      const rowNum = idx + 2
      const name = cleanStr(pickColumn(row, ['Name', 'NAME', 'Rule Name']))
      if (!name) {
        result.skipped++
        result.errors.push(`Row ${rowNum}: missing rule name`)
        continue
      }

      const targetType = normalizeTarget(
        pickColumn(row, ['Target Type', 'Target', 'TARGET TYPE', 'TargetType'])
      )
      if (!targetType) {
        result.skipped++
        result.errors.push(`Row ${rowNum} (${name}): missing or invalid target type`)
        continue
      }

      const field = cleanStr(pickColumn(row, ['Field', 'FIELD', 'Rule Field']))
      if (!field) {
        result.skipped++
        result.errors.push(`Row ${rowNum} (${name}): missing field`)
        continue
      }

      const operator = normalizeOperator(
        pickColumn(row, ['Operator', 'OPERATOR', 'Condition', 'Comparison'])
      ) ?? 'equals'

      const value = cleanStr(pickColumn(row, ['Value', 'VALUE', 'Threshold']))
      const description = cleanStr(pickColumn(row, ['Description', 'DESC']))
      const severity = normalizeSeverity(pickColumn(row, ['Severity', 'SEVERITY']))
      const scopeMonth = parseBool(
        pickColumn(row, ['Scope Month', 'Scope', 'Current Month Only']),
        true
      )
      const isEnabled = parseBool(pickColumn(row, ['Enabled', 'Active', 'Is Enabled']), true)

      const existing = ruleByName.get(name.toLowerCase())
      const data = {
        name,
        description,
        targetType,
        field,
        operator,
        value,
        severity,
        scopeMonth,
        isEnabled,
      }

      if (existing) {
        await db.rule.update({ where: { id: existing.id }, data })
        await auditLog({
          action: 'update',
          entityType: 'Rule',
          entityId: existing.id,
          entityCode: name,
          summary: `Rule "${name}" updated via import`,
        })
        result.updated++
      } else {
        const created = await db.rule.create({ data })
        ruleByName.set(name.toLowerCase(), {
          id: created.id,
          name: created.name,
        })
        await auditLog({
          action: 'create',
          entityType: 'Rule',
          entityId: created.id,
          entityCode: name,
          summary: `Rule "${name}" imported`,
        })
        result.inserted++
      }
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('Rules import error', e)
    return NextResponse.json(
      {
        error:
          'Failed to import rules. ' + (e instanceof Error ? e.message : String(e)),
      },
      { status: 500 }
    )
  }
}
