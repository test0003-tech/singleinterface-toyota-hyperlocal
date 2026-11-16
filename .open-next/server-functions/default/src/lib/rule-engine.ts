// Rule evaluation engine - evaluates custom rules against current data.
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/validation'
import type {
  Rule,
  RuleOperator,
  RuleEvaluationResult,
  ReminderAlert,
} from '@/lib/types'

interface EvalItem {
  code: string
  type: string
  name: string | null
   
  fields: Record<string, any>
}

function compare(
   
  actual: any,
  operator: RuleOperator,
  value: string | null
): boolean {
  if (operator === 'is_empty') {
    return actual === null || actual === undefined || actual === ''
  }
  if (operator === 'is_not_empty') {
    return actual !== null && actual !== undefined && actual !== ''
  }
  if (value === null || value === undefined) return false

  // Boolean comparisons
  if (typeof actual === 'boolean' || actual === 'true' || actual === 'false') {
    const actualBool = typeof actual === 'boolean' ? actual : actual === 'true'
    const valueBool = value === 'true' || value === '1' || value === 'yes'
    switch (operator) {
      case 'equals':
        return actualBool === valueBool
      case 'not_equals':
        return actualBool !== valueBool
      default:
        return false
    }
  }

  // Numeric comparisons
  const actualNum = typeof actual === 'number' ? actual : parseFloat(actual)
  const valueNum = parseFloat(value)
  if (Number.isFinite(actualNum) && Number.isFinite(valueNum)) {
    switch (operator) {
      case 'equals':
        return actualNum === valueNum
      case 'not_equals':
        return actualNum !== valueNum
      case 'greater_than':
        return actualNum > valueNum
      case 'less_than':
        return actualNum < valueNum
      case 'greater_or_equal':
        return actualNum >= valueNum
      case 'less_or_equal':
        return actualNum <= valueNum
    }
  }

  // String comparisons
  const actualStr = String(actual ?? '')
  switch (operator) {
    case 'equals':
      return actualStr === value
    case 'not_equals':
      return actualStr !== value
    case 'contains':
      return actualStr.toLowerCase().includes(value.toLowerCase())
    case 'not_contains':
      return !actualStr.toLowerCase().includes(value.toLowerCase())
  }

  return false
}

function getFieldFromItem(item: EvalItem, field: string): unknown {
  // Computed fields
  if (field === 'utilizationPercent') {
    const allocated = item.fields.allocated
    const utilized = item.fields.utilized
    if (typeof allocated === 'number' && typeof utilized === 'number' && allocated > 0) {
      return (utilized / allocated) * 100
    }
    return 0
  }
  return item.fields[field]
}

/**
 * Fetch all records that a rule could evaluate against.
 */
async function fetchItemsForRule(rule: Rule): Promise<EvalItem[]> {
  const month = currentMonth()
  const items: EvalItem[] = []

  if (rule.targetType === 'SI') {
    const records = await db.sIRecord.findMany({
      where: {},
      select: {
        siCode: true,
        businessName: true,
        isLive: true,
        gmbListingStatus: true,
        salesLandingNumbers: true,
        serviceLandingNumbers: true,
        circle: true,
        state: true,
        city: true,
      },
    })
    for (const r of records) {
      items.push({
        code: r.siCode,
        type: 'SI',
        name: r.businessName,
        fields: {
          isLive: r.isLive,
          gmbListingStatus: r.gmbListingStatus,
          salesLandingNumbers: r.salesLandingNumbers,
          serviceLandingNumbers: r.serviceLandingNumbers,
          circle: r.circle,
          state: r.state,
          city: r.city,
        },
      })
    }
  } else if (rule.targetType === 'Spotlight') {
    const records = await db.spotlightRecord.findMany({
      where: {},
      select: {
        clientCode: true,
        name: true,
        isLive: true,
        spotlightLandingNumbers: true,
        region: true,
        state: true,
        city: true,
      },
    })
    for (const r of records) {
      items.push({
        code: r.clientCode,
        type: 'Spotlight',
        name: r.name,
        fields: {
          isLive: r.isLive,
          spotlightLandingNumbers: r.spotlightLandingNumbers,
          region: r.region,
          state: r.state,
          city: r.city,
        },
      })
    }
  } else if (rule.targetType === 'MediaSpend') {
    const where = rule.scopeMonth ? { month } : {}
    const records = await db.mediaSpend.findMany({
      where,
      select: {
        recordType: true,
        recordCode: true,
        allocated: true,
        utilized: true,
        pendingInWallet: true,
        month: true,
      },
    })
    for (const r of records) {
      items.push({
        code: r.recordCode,
        type: r.recordType,
        name: null,
        fields: {
          allocated: r.allocated,
          utilized: r.utilized,
          pendingInWallet: r.pendingInWallet,
          month: r.month,
        },
      })
    }
  } else if (rule.targetType === 'PlatformFee') {
    const where = rule.scopeMonth ? { month } : {}
    const records = await db.platformFee.findMany({
      where,
      select: {
        recordType: true,
        recordCode: true,
        totalAmount: true,
        paymentStatus: true,
        amountPaid: true,
        dueDate: true,
        baseAmount: true,
        month: true,
        createdAt: true,
      },
    })
    for (const r of records) {
      // For days_overdue, compute days since due date (or creation if no due date)
      const isPaid = r.paymentStatus === 'paid'
      const refDate = r.dueDate ?? r.createdAt
      const daysOverdue = isPaid
        ? 0
        : Math.floor((Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24))
      items.push({
        code: r.recordCode,
        type: r.recordType,
        name: null,
        fields: {
          totalAmount: r.totalAmount,
          isPaid,
          paymentStatus: r.paymentStatus,
          amountPaid: r.amountPaid,
          baseAmount: r.baseAmount,
          month: r.month,
          daysOverdue,
        },
      })
    }
  }

  return items
}

/**
 * Evaluate a single rule against current data.
 */
export async function evaluateRule(
  rule: Rule
): Promise<RuleEvaluationResult> {
  const items = await fetchItemsForRule(rule)
  const matched: RuleEvaluationResult['matchedItems'] = []

  for (const item of items) {
    let isMatch = false
    let detail: string | undefined

    if (rule.operator === 'days_overdue') {
      // Special: compare daysOverdue field
      const days = (item.fields.daysOverdue as number) ?? 0
      const threshold = parseInt(rule.value ?? '0', 10)
      isMatch = days > threshold
      if (isMatch) detail = `${days} days overdue`
    } else {
      const actual = getFieldFromItem(item, rule.field)
      isMatch = compare(actual, rule.operator, rule.value)
      if (isMatch && rule.field === 'utilizationPercent') {
        const pct = typeof actual === 'number' ? actual.toFixed(1) : '?'
        detail = `${pct}% utilized`
      }
    }

    if (isMatch) {
      matched.push({
        code: item.code,
        type: item.type,
        name: item.name,
        detail,
      })
    }
  }

  return {
    rule,
    matchedCount: matched.length,
    matchedItems: matched,
  }
}

/**
 * Evaluate all enabled rules and return alerts.
 */
export async function evaluateAllRules(): Promise<{
  results: RuleEvaluationResult[]
  alerts: ReminderAlert[]
}> {
  const rules = await db.rule.findMany({
    where: { isEnabled: true },
  })

  const results: RuleEvaluationResult[] = []
  const alerts: ReminderAlert[] = []

  for (const rule of rules) {
    try {
      const result = await evaluateRule(rule)
      results.push(result)
      if (result.matchedCount > 0) {
        alerts.push({
          severity: rule.severity as ReminderAlert['severity'],
          category: 'custom_rule',
          title: rule.name,
          message:
            rule.description ||
            `Rule matched ${result.matchedCount} record(s)`,
          count: result.matchedCount,
          locations: result.matchedItems.slice(0, 20),
        })
      }
    } catch (e) {
      console.error(`Rule evaluation error for "${rule.name}":`, e)
    }
  }

  return { results, alerts }
}

/**
 * Seed default rules if none exist.
 */
export async function seedDefaultRules(): Promise<void> {
  const count = await db.rule.count()
  if (count > 0) return

  const defaults: Array<Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
      name: 'Media spend over 90% utilized',
      description: 'Alert when a location has utilized over 90% of allocated media budget',
      targetType: 'MediaSpend',
      field: 'utilizationPercent',
      operator: 'greater_than',
      value: '90',
      severity: 'warning',
      scopeMonth: true,
      isEnabled: true,
    },
    {
      name: 'Media spend fully utilized (100%+)',
      description: 'Critical alert when media spend reaches or exceeds 100% of allocated budget',
      targetType: 'MediaSpend',
      field: 'utilizationPercent',
      operator: 'greater_or_equal',
      value: '100',
      severity: 'critical',
      scopeMonth: true,
      isEnabled: true,
    },
    {
      name: 'Platform fee unpaid over 15 days',
      description: 'Warning when a platform fee has been unpaid for more than 15 days past due date',
      targetType: 'PlatformFee',
      field: 'isPaid',
      operator: 'days_overdue',
      value: '15',
      severity: 'warning',
      scopeMonth: true,
      isEnabled: true,
    },
    {
      name: 'Platform fee unpaid over 30 days',
      description: 'Critical alert when a platform fee has been unpaid for more than 30 days past due date',
      targetType: 'PlatformFee',
      field: 'isPaid',
      operator: 'days_overdue',
      value: '30',
      severity: 'critical',
      scopeMonth: true,
      isEnabled: true,
    },
    {
      name: 'Platform fee partially paid',
      description: 'Alert when a platform fee has been partially paid (payment status is partial)',
      targetType: 'PlatformFee',
      field: 'paymentStatus',
      operator: 'equals',
      value: 'partial',
      severity: 'warning',
      scopeMonth: true,
      isEnabled: true,
    },
    {
      name: 'Live SI missing sales landing numbers',
      description: 'Alert when a live SI record has no sales landing numbers configured',
      targetType: 'SI',
      field: 'salesLandingNumbers',
      operator: 'is_empty',
      value: null,
      severity: 'warning',
      scopeMonth: false,
      isEnabled: true,
    },
  ]

  for (const d of defaults) {
    await db.rule.create({ data: d })
  }
}
