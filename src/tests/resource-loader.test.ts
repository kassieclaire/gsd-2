import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverExtensionEntryPaths } from '../resource-loader.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): { dirPath: string; cleanup: () => void } {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-resource-loader-test-'))
  return { dirPath: tmp, cleanup: () => rmSync(tmp, { recursive: true, force: true }) }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

test('discoverExtensionEntryPaths returns empty array for non-existent directory', () => {
  const result = discoverExtensionEntryPaths('/tmp/non-existent-dir-for-test-12345')
  assert.deepEqual(result, [])
})

test('discoverExtensionEntryPaths returns empty array for empty directory', () => {
  const { dirPath, cleanup } = makeTmpDir()
  try {
    const result = discoverExtensionEntryPaths(dirPath)
    assert.deepEqual(result, [])
  } finally {
    cleanup()
  }
})

test('discoverExtensionEntryPaths discovers single .ts and .js files in the root', () => {
  const { dirPath, cleanup } = makeTmpDir()
  try {
    writeFileSync(join(dirPath, 'my-extension.ts'), 'export {}')
    writeFileSync(join(dirPath, 'another.js'), 'module.exports = {}')
    // Should ignore non-ts/js files
    writeFileSync(join(dirPath, 'readme.md'), '# hello')

    const result = discoverExtensionEntryPaths(dirPath)

    assert.equal(result.length, 2)
    assert.ok(result.includes(join(dirPath, 'my-extension.ts')))
    assert.ok(result.includes(join(dirPath, 'another.js')))
  } finally {
    cleanup()
  }
})

test('discoverExtensionEntryPaths discovers index.ts inside a subdirectory', () => {
  const { dirPath, cleanup } = makeTmpDir()
  try {
    const extDir = join(dirPath, 'my-ext')
    mkdirSync(extDir)
    writeFileSync(join(extDir, 'index.ts'), 'export {}')
    writeFileSync(join(extDir, 'index.js'), 'module.exports = {}') // Should be ignored because index.ts takes precedence

    const result = discoverExtensionEntryPaths(dirPath)
    assert.equal(result.length, 1)
    assert.equal(result[0], join(extDir, 'index.ts'))
  } finally {
    cleanup()
  }
})

test('discoverExtensionEntryPaths discovers index.js inside a subdirectory when index.ts is absent', () => {
  const { dirPath, cleanup } = makeTmpDir()
  try {
    const extDir = join(dirPath, 'my-ext')
    mkdirSync(extDir)
    writeFileSync(join(extDir, 'index.js'), 'module.exports = {}')

    const result = discoverExtensionEntryPaths(dirPath)
    assert.equal(result.length, 1)
    assert.equal(result[0], join(extDir, 'index.js'))
  } finally {
    cleanup()
  }
})

test('discoverExtensionEntryPaths resolves pi.extensions from package.json', () => {
  const { dirPath, cleanup } = makeTmpDir()
  try {
    const extDir = join(dirPath, 'my-ext')
    mkdirSync(extDir)

    // Write target files
    mkdirSync(join(extDir, 'dist'))
    writeFileSync(join(extDir, 'dist', 'main.js'), 'module.exports = {}')
    writeFileSync(join(extDir, 'dist', 'other.js'), 'module.exports = {}')

    // Write package.json declaring the files
    const pkg = {
      pi: {
        extensions: [
          'dist/main.js',
          'dist/other.js',
          'dist/does-not-exist.js' // Should be filtered out
        ]
      }
    }
    writeFileSync(join(extDir, 'package.json'), JSON.stringify(pkg))

    // Add index.ts to ensure it prioritizes package.json
    writeFileSync(join(extDir, 'index.ts'), 'export {}')

    const result = discoverExtensionEntryPaths(dirPath)
    assert.equal(result.length, 2)
    assert.ok(result.includes(join(extDir, 'dist', 'main.js')))
    assert.ok(result.includes(join(extDir, 'dist', 'other.js')))
    assert.ok(!result.includes(join(extDir, 'dist', 'does-not-exist.js')))
    assert.ok(!result.includes(join(extDir, 'index.ts')))
  } finally {
    cleanup()
  }
})

test('discoverExtensionEntryPaths falls back to index.ts when package.json pi.extensions is empty/invalid', () => {
  const { dirPath, cleanup } = makeTmpDir()
  try {
    const extDir = join(dirPath, 'my-ext')
    mkdirSync(extDir)

    // Write target file
    writeFileSync(join(extDir, 'index.ts'), 'export {}')

    // Write package.json with no valid resolved files
    const pkg = {
      pi: {
        extensions: [
          'dist/does-not-exist.js'
        ]
      }
    }
    writeFileSync(join(extDir, 'package.json'), JSON.stringify(pkg))

    const result = discoverExtensionEntryPaths(dirPath)
    assert.equal(result.length, 1)
    assert.equal(result[0], join(extDir, 'index.ts'))
  } finally {
    cleanup()
  }
})

test('discoverExtensionEntryPaths falls back to index.ts when package.json is malformed', () => {
  const { dirPath, cleanup } = makeTmpDir()
  try {
    const extDir = join(dirPath, 'my-ext')
    mkdirSync(extDir)

    writeFileSync(join(extDir, 'index.ts'), 'export {}')
    writeFileSync(join(extDir, 'package.json'), 'not { json }')

    const result = discoverExtensionEntryPaths(dirPath)
    assert.equal(result.length, 1)
    assert.equal(result[0], join(extDir, 'index.ts'))
  } finally {
    cleanup()
  }
})

test('discoverExtensionEntryPaths skips directories with no matching entry points', () => {
  const { dirPath, cleanup } = makeTmpDir()
  try {
    const extDir = join(dirPath, 'my-ext')
    mkdirSync(extDir)

    // Directory without index.ts, index.js or valid package.json
    writeFileSync(join(extDir, 'random.ts'), 'export {}')

    const pkg = { name: "no-pi-extensions" }
    writeFileSync(join(extDir, 'package.json'), JSON.stringify(pkg))

    const result = discoverExtensionEntryPaths(dirPath)
    assert.deepEqual(result, [])
  } finally {
    cleanup()
  }
})
