import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/db'

afterAll(async () => {
  // Clean up test data
  await prisma.benefitPeriod.deleteMany({ where: { benefit: { name: '__test__' } } })
  await prisma.benefit.deleteMany({ where: { name: '__test__' } })
  await prisma.userCard.deleteMany({ where: { userId: '__test__' } })
  await prisma.card.deleteMany({ where: { name: '__test__' } })
})

describe('schema', () => {
  it('all 4 models can be created and queried without error', async () => {
    const card = await prisma.card.create({
      data: {
        issuer: 'Chase',
        name: '__test__',
        scrapeUrl: null,
        defaultColor: '#1a56db',
      },
    })
    expect(card.id).toBeDefined()

    const userCard = await prisma.userCard.create({
      data: {
        userId: '__test__',
        cardId: card.id,
        displayOrder: 0,
      },
    })
    expect(userCard.id).toBeDefined()

    const benefit = await prisma.benefit.create({
      data: {
        userCardId: userCard.id,
        name: '__test__',
        type: 'credit',
        value: 100,
        resetPeriod: 'monthly',
        resetAnchor: 'calendar',
        category: 'dining',
        classification: "discretionary-credit",
        tracked: true,
      },
    })
    expect(benefit.id).toBeDefined()

    const period = await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-04-30'),
        usedAmount: 0,
        status: 'open',
      },
    })
    expect(period.id).toBeDefined()
    expect(period.status).toBe('open')

    // Verify relationships resolve
    const fetched = await prisma.benefit.findUnique({
      where: { id: benefit.id },
      include: { periods: true, userCard: { include: { card: true } } },
    })
    expect(fetched?.periods).toHaveLength(1)
    expect(fetched?.userCard.card.issuer).toBe('Chase')
  })

  it('Benefit row creates and queries with setAndForget + activatedAt', async () => {
    const card = await prisma.card.create({
      data: { issuer: 'Amex', name: '__test__', scrapeUrl: null, defaultColor: '#016fd0' },
    })
    const userCard = await prisma.userCard.create({
      data: { userId: '__test__', cardId: card.id, displayOrder: 0 },
    })
    const activatedAt = new Date('2026-05-28T00:00:00.000Z')
    const benefit = await prisma.benefit.create({
      data: {
        userCardId: userCard.id,
        name: '__test__',
        type: 'subscription',
        value: null,
        resetPeriod: 'annual',
        resetAnchor: 'calendar',
        category: 'general',
        classification: 'activation-perk',
        tracked: true,
        setAndForget: true,
        activatedAt,
      },
    })

    const fetched = await prisma.benefit.findUnique({ where: { id: benefit.id } })
    expect(fetched?.setAndForget).toBe(true)
    expect(fetched?.activatedAt?.toISOString()).toBe(activatedAt.toISOString())
  })

  it('setAndForget defaults false, activatedAt defaults null', async () => {
    const card = await prisma.card.create({
      data: { issuer: 'Amex', name: '__test__', scrapeUrl: null, defaultColor: '#016fd0' },
    })
    const userCard = await prisma.userCard.create({
      data: { userId: '__test__', cardId: card.id, displayOrder: 0 },
    })
    // setAndForget + activatedAt intentionally omitted → schema defaults apply
    const benefit = await prisma.benefit.create({
      data: {
        userCardId: userCard.id,
        name: '__test__',
        type: 'credit',
        value: 100,
        resetPeriod: 'monthly',
        resetAnchor: 'calendar',
        category: 'dining',
        classification: 'discretionary-credit',
        tracked: true,
      },
    })

    expect(benefit.setAndForget).toBe(false)
    expect(benefit.activatedAt).toBeNull()
  })

  // Task 57: Card.annualFee (Float?, nullable)
  it('prisma Card model accepts null annualFee', async () => {
    const card = await prisma.card.create({
      data: {
        issuer: 'Amex',
        name: '__test__',
        scrapeUrl: null,
        defaultColor: '#016fd0',
        annualFee: null,
      },
    })
    expect(card.id).toBeDefined()
    expect(card.annualFee).toBeNull()

    // A non-null value also round-trips as a Float
    const paidCard = await prisma.card.create({
      data: {
        issuer: 'Amex',
        name: '__test__',
        scrapeUrl: null,
        defaultColor: '#016fd0',
        annualFee: 695,
      },
    })
    expect(paidCard.annualFee).toBe(695)
  })

  it('existing card row reads annualFee as null post-migration', async () => {
    // Simulate a row created without specifying annualFee (as existing rows
    // were before the card_annual_fee migration). The migration adds the column
    // with no default, so the value reads back as null — no data loss.
    const card = await prisma.card.create({
      data: {
        issuer: 'Chase',
        name: '__test__',
        scrapeUrl: null,
        defaultColor: '#1a56db',
        // annualFee intentionally omitted
      },
    })

    const fetched = await prisma.card.findUnique({ where: { id: card.id } })
    expect(fetched).not.toBeNull()
    expect(fetched?.annualFee).toBeNull()
  })
})
