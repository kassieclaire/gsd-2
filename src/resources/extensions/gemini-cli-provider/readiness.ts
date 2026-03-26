/**
 * Readiness check for the Gemini CLI provider.
 *
 * Verifies the `gemini` binary is installed and responsive.
 * Result is cached for 30 seconds to avoid shelling out on every
 * model-availability check.
 */

import { execSync } from "node:child_process";

let cachedReady: boolean | null = null;
let lastCheckMs = 0;
const CHECK_INTERVAL_MS = 30_000;

export function isGeminiCliReady(): boolean {
	const now = Date.now();
	if (cachedReady !== null && now - lastCheckMs < CHECK_INTERVAL_MS) {
		return cachedReady;
	}

	try {
		execSync("gemini --version", { timeout: 5_000, stdio: "pipe" });
		cachedReady = true;
	} catch {
		cachedReady = false;
	}

	lastCheckMs = now;
	return cachedReady;
}
