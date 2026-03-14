import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldRunOnboarding } from '../onboarding.js'
import type { AuthStorage } from '@gsd/pi-coding-agent'

test('shouldRunOnboarding', async (t) => {
  const originalIsTTY = process.stdin.isTTY

  t.afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    })
  })

  await t.test('returns false when not a TTY', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      configurable: true,
    })

    const mockAuthStorage = {
      hasAuth: () => false,
    } as unknown as AuthStorage

    assert.equal(shouldRunOnboarding(mockAuthStorage), false)
  })

  await t.test('returns false when a known LLM provider is authenticated', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      configurable: true,
    })

    const mockAuthStorage = {
      hasAuth: (id: string) => id === 'openai',
    } as unknown as AuthStorage

    assert.equal(shouldRunOnboarding(mockAuthStorage), false)
  })

  await t.test('returns true when a TTY and no known LLM provider is authenticated', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      configurable: true,
    })

    const mockAuthStorage = {
      hasAuth: () => false,
    } as unknown as AuthStorage

    assert.equal(shouldRunOnboarding(mockAuthStorage), true)
  })
})
