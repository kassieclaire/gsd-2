import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

// Create a reusable helper to get a fresh instance of the module.
// The `homedir()` calls in `pi-migration.ts` evaluate at the top level
// of the module, so we must mock the environment and dynamically import
// it with a cache buster so that it reads our temporary home directory.
async function getMigrationModule(homePath: string) {
  const oldHome = process.env.HOME
  const oldUserProfile = process.env.USERPROFILE
  process.env.HOME = homePath
  process.env.USERPROFILE = homePath

  try {
    const bust = Date.now() + Math.random()
    // Dynamic import relative to the current file (src/tests/pi-migration.test.ts)
    return await import(`../pi-migration.ts?bust=${bust}`)
  } finally {
    if (oldHome === undefined) delete process.env.HOME
    else process.env.HOME = oldHome

    if (oldUserProfile === undefined) delete process.env.USERPROFILE
    else process.env.USERPROFILE = oldUserProfile
  }
}

function createAuthStorage(initialData: Record<string, any> = {}) {
  const store = new Map<string, any>(Object.entries(initialData))
  return {
    list: () => Array.from(store.keys()),
    has: (id: string) => store.has(id),
    set: (id: string, cred: any) => store.set(id, cred),
    _store: store // for assertions
  }
}

// ---------------------------------------------------------------------------
// migratePiCredentials
// ---------------------------------------------------------------------------

test('migratePiCredentials returns false if authStorage already has an LLM provider', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    const { migratePiCredentials } = await getMigrationModule(tmp)
    const authStorage = createAuthStorage({
      openai: { type: 'api_key', key: 'existing-key' }
    })

    const result = migratePiCredentials(authStorage)
    assert.equal(result, false)
    assert.equal(authStorage._store.size, 1, 'Storage should not be modified')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('migratePiCredentials returns false if auth.json does not exist', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    const { migratePiCredentials } = await getMigrationModule(tmp)
    const authStorage = createAuthStorage()

    const result = migratePiCredentials(authStorage)
    assert.equal(result, false)
    assert.equal(authStorage._store.size, 0)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('migratePiCredentials returns false and does not crash if auth.json is malformed', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    mkdirSync(join(tmp, '.pi', 'agent'), { recursive: true })
    writeFileSync(join(tmp, '.pi', 'agent', 'auth.json'), 'not json')

    const { migratePiCredentials } = await getMigrationModule(tmp)
    const authStorage = createAuthStorage()

    const result = migratePiCredentials(authStorage)
    assert.equal(result, false)
    assert.equal(authStorage._store.size, 0)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('migratePiCredentials migrates credentials and returns true if an LLM provider was added', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    mkdirSync(join(tmp, '.pi', 'agent'), { recursive: true })
    writeFileSync(join(tmp, '.pi', 'agent', 'auth.json'), JSON.stringify({
      'anthropic': { type: 'api_key', key: 'anthropic-key-123' },
      'github': { type: 'oauth', token: 'gh-token-456' }
    }))

    const { migratePiCredentials } = await getMigrationModule(tmp)

    // Start with a non-LLM provider
    const authStorage = createAuthStorage({
      'tavily': { type: 'api_key', key: 'tvly-existing' }
    })

    // Capture stderr to prevent noisy test output
    const originalStderrWrite = process.stderr.write
    let stderrOutput = ''
    process.stderr.write = (chunk: any) => {
      stderrOutput += chunk
      return true
    }

    try {
      const result = migratePiCredentials(authStorage)

      assert.equal(result, true, 'Should return true because anthropic is an LLM provider')
      assert.equal(authStorage._store.size, 3)
      assert.deepEqual(authStorage._store.get('anthropic'), { type: 'api_key', key: 'anthropic-key-123' })
      assert.deepEqual(authStorage._store.get('github'), { type: 'oauth', token: 'gh-token-456' })
      assert.ok(stderrOutput.includes('anthropic'), 'Should log anthropic migration')
      assert.ok(stderrOutput.includes('github'), 'Should log github migration')
    } finally {
      process.stderr.write = originalStderrWrite
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('migratePiCredentials returns false if only non-LLM providers were migrated', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    mkdirSync(join(tmp, '.pi', 'agent'), { recursive: true })
    // 'github' is not in LLM_PROVIDER_IDS list
    writeFileSync(join(tmp, '.pi', 'agent', 'auth.json'), JSON.stringify({
      'github': { type: 'oauth', token: 'gh-token-456' }
    }))

    const { migratePiCredentials } = await getMigrationModule(tmp)
    const authStorage = createAuthStorage()

    const originalStderrWrite = process.stderr.write
    process.stderr.write = () => true

    try {
      const result = migratePiCredentials(authStorage)
      assert.equal(result, false, 'Should return false because no LLM provider was migrated')
      assert.equal(authStorage._store.size, 1)
      assert.deepEqual(authStorage._store.get('github'), { type: 'oauth', token: 'gh-token-456' })
    } finally {
      process.stderr.write = originalStderrWrite
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('migratePiCredentials skips providers already in GSD storage', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    mkdirSync(join(tmp, '.pi', 'agent'), { recursive: true })
    writeFileSync(join(tmp, '.pi', 'agent', 'auth.json'), JSON.stringify({
      'anthropic': { type: 'api_key', key: 'new-key' }
    }))

    const { migratePiCredentials } = await getMigrationModule(tmp)

    // GSD already has anthropic
    const authStorage = createAuthStorage({
      'anthropic': { type: 'api_key', key: 'old-key' }
    })

    const originalStderrWrite = process.stderr.write
    process.stderr.write = () => true

    try {
      // Returns false immediately because anthropic is in authStorage already
      // (handled by the early check `const hasLlm = existing.some(id => LLM_PROVIDER_IDS.includes(id))`)
      const result = migratePiCredentials(authStorage)

      assert.equal(result, false)
      assert.equal(authStorage._store.get('anthropic').key, 'old-key', 'Should not overwrite existing')
    } finally {
      process.stderr.write = originalStderrWrite
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('migratePiCredentials skips migrating individual providers already present', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    mkdirSync(join(tmp, '.pi', 'agent'), { recursive: true })
    writeFileSync(join(tmp, '.pi', 'agent', 'auth.json'), JSON.stringify({
      'github': { type: 'oauth', token: 'new-token' },
      'anthropic': { type: 'api_key', key: 'anthropic-key' }
    }))

    const { migratePiCredentials } = await getMigrationModule(tmp)

    // GSD already has github (not an LLM, so early exit won't trigger), but not anthropic
    const authStorage = createAuthStorage({
      'github': { type: 'oauth', token: 'old-token' }
    })

    const originalStderrWrite = process.stderr.write
    process.stderr.write = () => true

    try {
      const result = migratePiCredentials(authStorage)

      assert.equal(result, true, 'Migrated anthropic, an LLM provider')
      assert.equal(authStorage._store.get('github').token, 'old-token', 'Should not overwrite existing github credential')
      assert.equal(authStorage._store.get('anthropic').key, 'anthropic-key')
    } finally {
      process.stderr.write = originalStderrWrite
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// getPiDefaultModelAndProvider
// ---------------------------------------------------------------------------

test('getPiDefaultModelAndProvider returns null if settings.json does not exist', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    const { getPiDefaultModelAndProvider } = await getMigrationModule(tmp)
    const result = getPiDefaultModelAndProvider()
    assert.equal(result, null)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('getPiDefaultModelAndProvider returns null if settings.json is malformed', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    mkdirSync(join(tmp, '.pi', 'agent'), { recursive: true })
    writeFileSync(join(tmp, '.pi', 'agent', 'settings.json'), '{ bad json }')

    const { getPiDefaultModelAndProvider } = await getMigrationModule(tmp)
    const result = getPiDefaultModelAndProvider()
    assert.equal(result, null)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('getPiDefaultModelAndProvider returns null if properties are missing or wrong type', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    mkdirSync(join(tmp, '.pi', 'agent'), { recursive: true })
    writeFileSync(join(tmp, '.pi', 'agent', 'settings.json'), JSON.stringify({
      defaultProvider: 'openai',
      // defaultModel missing
    }))

    const { getPiDefaultModelAndProvider } = await getMigrationModule(tmp)
    const result = getPiDefaultModelAndProvider()
    assert.equal(result, null)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('getPiDefaultModelAndProvider returns object with provider and model if valid', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-pi-migration-'))
  try {
    mkdirSync(join(tmp, '.pi', 'agent'), { recursive: true })
    writeFileSync(join(tmp, '.pi', 'agent', 'settings.json'), JSON.stringify({
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
      otherSetting: true
    }))

    const { getPiDefaultModelAndProvider } = await getMigrationModule(tmp)
    const result = getPiDefaultModelAndProvider()
    assert.deepEqual(result, { provider: 'openai', model: 'gpt-4o' })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
