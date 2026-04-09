import { describe, it, expect } from 'vitest'

describe('db singleton', () => {
  it('returns same instance on second import', async () => {
    const { prisma: a } = await import('@/lib/db')
    const { prisma: b } = await import('@/lib/db')
    expect(a).toBe(b)
  })

  it('connects to SQLite without throwing', async () => {
    const { prisma } = await import('@/lib/db')
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeDefined()
  })
})
