/**
 * Gemini CLI Provider Extension
 *
 * Registers a model provider that delegates inference to the user's
 * locally-installed Gemini CLI via the Agent Client Protocol (ACP).
 *
 * Users authenticate via the Gemini CLI (`gemini login`) and this
 * integration communicates with it via stdio RPC streams.
 *
 * TOS-compliant: uses the standard ACP protocol and never touches
 * credentials or offers a direct login flow.
 */

import type { ExtensionAPI } from "@gsd/pi-coding-agent";
import { GEMINI_CLI_MODELS } from "./models.js";
import { isGeminiCliReady } from "./readiness.js";
import { streamViaGeminiCli } from "./stream-adapter.js";

export default function geminiCli(pi: ExtensionAPI) {
	pi.registerProvider("gemini-cli", {
		authMode: "externalCli",
		api: "google-gemini-cli",
		baseUrl: "local://gemini-cli",
		isReady: isGeminiCliReady,
		streamSimple: streamViaGeminiCli,
		models: GEMINI_CLI_MODELS,
	});
}
