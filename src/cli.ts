import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  SessionManager,
  createAgentSession,
  InteractiveMode,
} from '@mariozechner/pi-coding-agent'
import { agentDir, sessionsDir, authFilePath } from './app-paths.js'
import { buildResourceLoader, initResources } from './resource-loader.js'
import { loadStoredEnvKeys, runWizardIfNeeded } from './wizard.js'

const authStorage = AuthStorage.create(authFilePath)
loadStoredEnvKeys(authStorage)
await runWizardIfNeeded(authStorage)

const modelRegistry = new ModelRegistry(authStorage)
const settingsManager = SettingsManager.create(agentDir)

// Auto-select a default model if none is configured, or if the configured
// model no longer exists (e.g. stale settings referencing a retired model).
const configuredProvider = settingsManager.getDefaultProvider()
const configuredModel = settingsManager.getDefaultModel()
const availableModels = modelRegistry.getAvailable()
const configuredExists = configuredProvider && configuredModel &&
  availableModels.some((m) => m.provider === configuredProvider && m.id === configuredModel)

if (!configuredModel || !configuredExists) {
  if (availableModels.length > 0) {
    // Preferred default: anthropic/claude-sonnet-4-6
    const preferred =
      availableModels.find((m) => m.provider === 'anthropic' && m.id === 'claude-sonnet-4-6') ||
      availableModels.find((m) => m.provider === 'anthropic' && m.id.includes('sonnet')) ||
      availableModels.find((m) => m.provider === 'anthropic') ||
      availableModels[0]
    settingsManager.setDefaultModelAndProvider(preferred.provider, preferred.id)
  }
}

// Default thinking level: off
if (!settingsManager.getDefaultThinkingLevel()) {
  settingsManager.setDefaultThinkingLevel('off')
}

// GSD always uses quiet startup — the gsd extension renders its own branded header
if (!settingsManager.getQuietStartup()) {
  settingsManager.setQuietStartup(true)
}

// Collapse changelog by default — avoid wall of text on updates
if (!settingsManager.getCollapseChangelog()) {
  settingsManager.setCollapseChangelog(true)
}

const sessionManager = SessionManager.create(process.cwd(), sessionsDir)

initResources(agentDir)
const resourceLoader = buildResourceLoader(agentDir)
await resourceLoader.reload()

const { session, extensionsResult } = await createAgentSession({
  authStorage,
  modelRegistry,
  settingsManager,
  sessionManager,
  resourceLoader,
})

if (extensionsResult.errors.length > 0) {
  for (const err of extensionsResult.errors) {
    process.stderr.write(`[gsd] Extension load error: ${err.error}\n`)
  }
}

const interactiveMode = new InteractiveMode(session)
await interactiveMode.run()
