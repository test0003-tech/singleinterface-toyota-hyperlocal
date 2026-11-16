import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RuleInput, Rule, RuleTargetType, RuleOperator, RuleSeverity } from '@/lib/types'

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
  // operators that don't need a value
  const noValueOps: RuleOperator[] = ['is_empty', 'is_not_empty']
  if (!noValueOps.includes(input.operator) && !input.value) {
    return `Value is required for operator "${input.operator}"`
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const targetType = searchParams.get('targetType')
    const isEnabled = searchParams.get('isEnabled')

     
    const where: any = {}
    if (targetType && VALID_TARGETS.includes(targetType as RuleTargetType)) {
      where.targetType = targetType
    }
    if (isEnabled === 'true') where.isEnabled = true
    if (isEnabled === 'false') where.isEnabled = false

    const rules = await db.rule.findMany({
      where,
      orderBy: [{ isEnabled: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ data: rules as unknown as Rule[] })
  } catch (e) {
    console.error('Rules GET error', e)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = buildInput(body)
    const err = validateInput(input)
    if (err) return NextResponse.json({ error: err }, { status: 400 })

    const created = await db.rule.create({ data: input })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('Rules POST error', e)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}
