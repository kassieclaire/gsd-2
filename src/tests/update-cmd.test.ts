import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import child_process from 'node:child_process'
import { runUpdate } from '../update-cmd.js'

test('runUpdate', async (t) => {
  const originalEnv = { ...process.env }
  let stdoutWriteCalls: string[] = []
  let stderrWriteCalls: string[] = []
  let exitCode: number | undefined

  t.beforeEach(() => {
    stdoutWriteCalls = []
    stderrWriteCalls = []
    exitCode = undefined

    mock.method(process.stdout, 'write', (chunk: string) => {
      stdoutWriteCalls.push(chunk.toString())
      return true
    })

    mock.method(process.stderr, 'write', (chunk: string) => {
      stderrWriteCalls.push(chunk.toString())
      return true
    })

    mock.method(process, 'exit', (code?: number) => {
      exitCode = code
      throw new Error(`Process exited with code ${code}`)
    })
  })

  t.afterEach(() => {
    process.env = { ...originalEnv }
    mock.restoreAll()
  })

  await t.test('it indicates when already up to date', async () => {
    process.env.GSD_VERSION = '2.0.0'
    mock.method(child_process, 'execSync', (cmd: string) => {
      if (cmd.includes('npm view')) {
        return '1.0.0\n'
      }
      return ''
    })

    await runUpdate()

    assert.ok(stdoutWriteCalls.some(call => call.includes('Already up to date.')))
    assert.equal(exitCode, undefined)
  })

  await t.test('it performs an update when current is older than latest', async () => {
    process.env.GSD_VERSION = '1.0.0'
    let installCalled = false
    mock.method(child_process, 'execSync', (cmd: string) => {
      if (cmd.includes('npm view')) {
        return '2.0.0\n'
      }
      if (cmd.includes('npm install')) {
        installCalled = true
        return Buffer.from('')
      }
      return ''
    })

    await runUpdate()

    assert.ok(installCalled)
    assert.ok(stdoutWriteCalls.some(call => call.includes('Updated to v2.0.0')))
    assert.equal(exitCode, undefined)
  })

  await t.test('it exits and prints error on npm registry failure', async () => {
    process.env.GSD_VERSION = '1.0.0'
    mock.method(child_process, 'execSync', (cmd: string) => {
      if (cmd.includes('npm view')) {
        throw new Error('Network error')
      }
      return ''
    })

    try {
      await runUpdate()
    } catch (e) {
      assert.equal(e.message, 'Process exited with code 1')
    }

    assert.ok(stderrWriteCalls.some(call => call.includes('Failed to reach npm registry.')))
    assert.equal(exitCode, 1)
  })

  await t.test('it handles npm install failure', async () => {
    process.env.GSD_VERSION = '1.0.0'
    mock.method(child_process, 'execSync', (cmd: string) => {
      if (cmd.includes('npm view')) {
        return '2.0.0\n'
      }
      if (cmd.includes('npm install')) {
        throw new Error('Install error')
      }
      return ''
    })

    try {
      await runUpdate()
    } catch (e) {
      assert.equal(e.message, 'Process exited with code 1')
    }

    assert.ok(stderrWriteCalls.some(call => call.includes('Update failed. Try manually')))
    assert.equal(exitCode, 1)
  })
})
