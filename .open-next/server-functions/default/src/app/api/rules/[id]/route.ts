import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RuleInput, RuleTargetType, RuleOperator, RuleSeverity } from '@/lib/types'

const VALID_TARGETS: RuleTargetType[] = ['SI', 'Spotlight', 'MediaSpend', 'PlatformFee']
const VALID_OPERATORS: RuleOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than',
  'greater_or_equal', 'less_or_equal', 'contains', 'not_contains',
  'is_empty', 'is_not_empty', 'days_overdue',
]
const VALID_SEVERITIES: RuleSeverity[] = ['info', 'warning', 'critical']

function buildInput(body: Partial<RuleInput>): RuleInput {
  return {
    name: (body.name ?? '').trim(),
    description: body.description?.trim() || null,
    targetType: (body.targetType as RuleTargetType) ?? 'MediaSpend',
    field: (body.field ?? '').trim(),
    operator: (body.operator as RuleOperator) ?? 'greater_than',
    value: body.value?.trim() || null,
    severity: (body.severity as RuleSeverity) ?? 'warning',
    scopeMonth: body.scopeMonth ?? true,
    isEnabled: body.isEnabled ?? true,
  }
}

function validateInput(input: RuleInput): string | null {
  if (!input.name) return 'Rule name is required'
  if (!input.field) return 'Field is required'
  if (!VALID_TARGETS.includes(input.targetType)) return `Invalid targetType`
  if (!VALID_OPERATORS.includes(input.operator)) return `Invalid operator`
  if (!VALID_SEVERITIES.includes(input.severity)) return `Invalid severity`
  const noValueOps: RuleOperator[] = ['is_empty', 'is_not_empty']
  if (!noValueOps.includes(input.operator) && !input.value) {
    return `Value is required for operator "${input.operator}"`
  }
  return null
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const input = buildInput(body)
    const err = validateInput(input)
    if (err) return NextResponse.json({ error: err }, { status: 400 })

    const existing = await db.rule.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await db.rule.update({ where: { id }, data: input })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('Rules PUT error', e)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await db.rule.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.rule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Rules DELETE error', e)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
