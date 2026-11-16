import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PaginatedResponse } from '@/lib/types'

interface AuditLogWithParsed {
  id: string
  action: string
  entityType: string
  entityId: string
  entityCode: string | null
  changes: Record<string, { from: unknown; to: unknown }> | null
  summary: string | null
  createdAt: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10) || 25))
    const entityType = (searchParams.get('entityType') ?? '').trim()
    const action = (searchParams.get('action') ?? '').trim()
    const entityId = (searchParams.get('entityId') ?? '').trim()
    const exportCsv = searchParams.get('export') === '1'

    const where: Record<string, unknown> = {}
    if (entityType) where.entityType = entityType
    if (action) where.action = action
    if (entityId) where.entityId = entityId

    if (exportCsv) {
      const all = await db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 1000,
      })
      return NextResponse.json({ data: all })
    }

    const [total, data] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    // Parse changes JSON
    const parsedData: AuditLogWithParsed[] = data.map((d) => ({
      ...d,
      changes: d.changes ? JSON.parse(d.changes) : null,
      createdAt: d.createdAt.toISOString(),
    }))

    const res: PaginatedResponse<AuditLogWithParsed> = {
      data: parsedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
    return NextResponse.json(res)
  } catch (e) {
    console.error('Audit logs GET error', e)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
