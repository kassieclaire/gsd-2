/**
 * Model definitions for the Gemini CLI provider.
 *
 * Costs are zero because inference is covered by the user's Gemini CLI authentication.
 */

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const GEMINI_CLI_MODELS = [
	{
		id: "gemini-3-flash",
		name: "Gemini 3 Flash (via Gemini CLI)",
		reasoning: false,
		input: ["text", "image"] as ("text" | "image")[],
		cost: ZERO_COST,
		contextWindow: 1_000_000,
		maxTokens: 8192,
	},
	{
		id: "gemini-3.1-pro",
		name: "Gemini 3.1 Pro (via Gemini CLI)",
		reasoning: true,
		input: ["text", "image"] as ("text" | "image")[],
		cost: ZERO_COST,
		contextWindow: 2_000_000,
		maxTokens: 8192,
	},
];
