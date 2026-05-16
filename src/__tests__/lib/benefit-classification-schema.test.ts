import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'

const TEST_MARKER = '__cls_schema_test__'
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

describe('Benefit schema', () => {
  it('creates a benefit with classification and tracked and reads them back', async () => {
    const created = await prisma.benefit.create({
      data: {
        userCardId: testUserCardId,
        name: TEST_MARKER,
        type: 'credit',
        value: 100,
        resetPeriod: 'monthly',
        resetAnchor: 'calendar',
        category: 'dining',
        classification: 'discretionary-credit',
        tracked: true,
      },
    })

    const fetched = await prisma.benefit.findUnique({ where: { id: created.id } })
    expect(fetched?.classification).toBe('discretionary-credit')
    expect(fetched?.tracked).toBe(true)
  })

  it('applies defaults classification="one-time-bonus" and tracked=false when omitted', async () => {
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
    expect(fetched?.classification).toBe('one-time-bonus')
    expect(fetched?.tracked).toBe(false)
  })

  it('does not expose an isTrackable column after migration', async () => {
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      'PRAGMA table_info("Benefit")'
    )
    const columnNames = columns.map((col) => col.name)

    expect(columnNames).not.toContain('isTrackable')
    expect(columnNames).toContain('classification')
    expect(columnNames).toContain('tracked')
  })
})
