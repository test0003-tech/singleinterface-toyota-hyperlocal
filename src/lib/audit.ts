// Audit log helper - records all data changes for compliance and traceability.
import { db } from '@/lib/db'

export type AuditAction = 'create' | 'update' | 'delete'
export type EntityType = 'SI' | 'Spotlight' | 'MediaSpend' | 'PlatformFee' | 'Payment' | 'Rule'

export interface AuditEntry {
  action: AuditAction
  entityType: EntityType
  entityId: string
  entityCode?: string | null
  changes?: Record<string, { from: unknown; to: unknown }> | null
  summary?: string | null
}

/**
 * Record an audit log entry.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityCode: entry.entityCode ?? null,
        changes: entry.changes ? JSON.stringify(entry.changes) : null,
        summary: entry.summary ?? null,
      },
    })
  } catch (e) {
    // Audit logging should never break the main operation
    console.error('Audit log error:', e)
  }
}

/**
 * Compute a diff of changed fields between old and new objects.
 */
export function diffChanges(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  if (oldObj) {
    for (const key of Object.keys(newObj)) {
      const oldVal = oldObj[key]
      const newVal = newObj[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = { from: oldVal, to: newVal }
      }
    }
  } else {
    for (const key of Object.keys(newObj)) {
      changes[key] = { from: null, to: newObj[key] }
    }
  }
  return changes
}

/**
 * Generate the next auto-invoice number using a counter.
 * Format: INV-YYYYMM-0001 (e.g. INV-202611-0001)
 */
export async function generateInvoiceNumber(month: string): Promise<string> {
  const counterId = `invoice_${month}`
  const counter = await db.counter.upsert({
    where: { id: counterId },
    update: { value: { increment: 1 } },
    create: { id: counterId, value: 1 },
  })
  const seq = String(counter.value).padStart(4, '0')
  return `INV-${month.replace('-', '')}-${seq}`
}
