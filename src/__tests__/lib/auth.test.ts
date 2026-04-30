import { describe, it, expect, beforeAll } from 'vitest'
import { vi } from 'vitest'

// Hoist mock references so vi.mock factory can close over them
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }))

vi.mock('next-auth', () => ({
  default: () => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: mockAuth,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn((config) => config),
}))

beforeAll(() => {
  // CONSTRAINT-14: plaintext password — bcrypt removed due to dotenv-expand incompatibility
  process.env.ADMIN_PASSWORD = 'correctpassword'
})

describe('credentials provider', () => {
  it('returns session token when password matches', async () => {
    const { authorizeUser } = await import('@/lib/auth')
    const result = await authorizeUser('test@example.com', 'correctpassword')
    expect(result).toEqual({ id: 'user_test', email: 'test@example.com' })
  })

  it('returns null when password does not match', async () => {
    const { authorizeUser } = await import('@/lib/auth')
    const result = await authorizeUser('test@example.com', 'wrongpassword')
    expect(result).toBeNull()
  })
})

describe('requireAuth()', () => {
  it('returns session when valid JWT present', async () => {
    const mockSession = {
      user: { id: 'user_test', email: 'test@example.com' },
      expires: '2099-01-01',
    }
    mockAuth.mockResolvedValue(mockSession)
    const { requireAuth } = await import('@/lib/auth')
    const session = await requireAuth()
    expect(session).toEqual(mockSession)
  })

  it('throws 401 when no session', async () => {
    mockAuth.mockResolvedValue(null)
    const { requireAuth } = await import('@/lib/auth')
    await expect(requireAuth()).rejects.toMatchObject({ status: 401 })
  })
})
