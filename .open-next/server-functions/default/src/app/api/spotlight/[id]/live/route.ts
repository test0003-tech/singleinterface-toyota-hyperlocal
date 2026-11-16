import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Mark a Spotlight record as live (or toggle off).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { live?: boolean; liveSince?: string } = {}
    try {
      body = await req.json()
    } catch {
      // empty body -> default to live=true
    }
    const wantLive = body.live !== false

    const record = await db.spotlightRecord.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const liveSince = wantLive
      ? body.liveSince
        ? new Date(body.liveSince)
        : record.liveSince ?? new Date()
      : null

    const updated = await db.spotlightRecord.update({
      where: { id },
      data: { isLive: wantLive, liveSince },
    })

    return NextResponse.json({ success: true, record: updated })
  } catch (e) {
    console.error('Spotlight mark live error', e)
    return NextResponse.json(
      { error: 'Failed to update live status' },
      { status: 500 }
    )
  }
}
