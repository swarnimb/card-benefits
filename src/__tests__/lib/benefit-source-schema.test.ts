import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'

const TEST_MARKER = '__src_schema_test__'
let testUserCardId = ''

beforeAll(async () => {
  const card = await prisma.card.create({
    data: { issuer: 'Chase', name: TEST_MARKER, scrapeUrl: null, defaultColor: '#1a56db' },
  })
  const userCard = await prisma.userCard.create({
    data: { userId: TEST_MARKER, cardId: card.id, displayOrder: 0 },
  })
  testUserCardId = userCard.id
})

afterAll(async () => {
  await prisma.benefit.deleteMany({ where: { name: TEST_MARKER } })
  await prisma.userCard.deleteMany({ where: { userId: TEST_MARKER } })
  await prisma.card.deleteMany({ where: { name: TEST_MARKER } })
})

describe('Benefit source field (Feature 11 / Task 79)', () => {
  it('defaults source to "scraped" when omitted — the migration backfill mechanism', async () => {
    const created = await prisma.benefit.create({
      data: {
        userCardId: testUserCardId,
        name: TEST_MARKER,
        type: 'perk',
        value: null,
        resetPeriod: 'once',
        resetAnchor: 'calendar',
        category: 'general',
      },
    })

    const fetched = await prisma.benefit.findUnique({ where: { id: created.id } })
    expect(fetched?.source).toBe('scraped')
  })

  it('persists an explicit source="manual" and reads it back', async () => {
    const created = await prisma.benefit.create({
      data: {
        userCardId: testUserCardId,
        name: TEST_MARKER,
        type: 'credit',
        value: 100,
        resetPeriod: 'monthly',
        resetAnchor: 'calendar',
        category: 'dining',
        source: 'manual',
      },
    })

    const fetched = await prisma.benefit.findUnique({ where: { id: created.id } })
    expect(fetched?.source).toBe('manual')
  })

  it('backfills all pre-existing rows: every Benefit row reads back with a valid source', async () => {
    // The migration's INSERT..SELECT omits `source`, so existing rows fall back
    // to the column DEFAULT 'scraped'. No row may be left null/empty.
    const rows = await prisma.benefit.findMany({ select: { source: true } })
    for (const row of rows) {
      expect(['scraped', 'manual']).toContain(row.source)
    }
  })

  it('exposes a source column after migration', async () => {
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      'PRAGMA table_info("Benefit")'
    )
    const columnNames = columns.map((col) => col.name)
    expect(columnNames).toContain('source')
  })
})
