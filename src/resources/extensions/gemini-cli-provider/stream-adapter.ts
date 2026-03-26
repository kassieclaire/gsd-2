/**
 * GSD stream adapter for the Gemini CLI via Agent Client Protocol (ACP).
 *
 * Spawns the locally installed `gemini` binary using `--acp` and acts as the
 * ACP Client, forwarding session updates to GSD's event stream.
 */

import { execSync, spawn } from "node:child_process";
import { EventStream } from "@gsd/pi-ai";
import type {
	AssistantMessageEvent,
	AssistantMessage,
	AssistantMessageEventStream,
	Context,
	Model,
	SimpleStreamOptions,
} from "@gsd/pi-ai";
import { Readable, Writable } from "node:stream";

const ZERO_USAGE = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function getGeminiPath(): string {
	try {
		return execSync("which gemini", { timeout: 5_000, stdio: "pipe" }).toString().trim();
	} catch {
		return "gemini";
	}
}

function extractLastUserPrompt(context: Context): string {
	for (let i = context.messages.length - 1; i >= 0; i--) {
		const msg = context.messages[i];
		if (msg.role === "user") {
			if (typeof msg.content === "string") return msg.content;
			if (Array.isArray(msg.content)) {
				const textParts = msg.content
					.filter((part: any) => part.type === "text")
					.map((part: any) => part.text);
				if (textParts.length > 0) return textParts.join("\n");
			}
		}
	}
	return "";
}

function mapStopReason(reason: string): "stop" | "length" | "toolUse" {
	switch (reason) {
		case "end_turn": return "stop";
		case "max_tokens": return "length";
		case "refusal": return "stop";
		case "max_turn_requests": return "length";
		case "cancelled": return "stop";
		default: return "stop";
	}
}

function createAssistantStream(): AssistantMessageEventStream {
	return new EventStream<AssistantMessageEvent, AssistantMessage>(
		(event) => event.type === "done" || event.type === "error",
		(event) => {
			if (event.type === "done") return event.message;
			throw (event as any).error;
		}
	) as AssistantMessageEventStream;
}

export function streamViaGeminiCli(
	model: Model<any>,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream {
	const stream = createAssistantStream();
	void pumpAcpMessages(model, context, options, stream);
	return stream;
}

async function pumpAcpMessages(
	model: Model<any>,
	context: Context,
	options: SimpleStreamOptions | undefined,
	stream: AssistantMessageEventStream,
): Promise<void> {
	const modelId = model.id;
	let child: ReturnType<typeof spawn> | null = null;

	const partialMessage: AssistantMessage = {
		role: "assistant",
		content: [],
		api: "google-gemini-cli",
		provider: "gemini-cli",
		model: modelId,
		usage: { ...ZERO_USAGE },
		stopReason: "stop",
		timestamp: Date.now(),
	};

	try {
		// Dynamic import of ACP client so GSD runs if it's not installed
		const acpSdkModule = "@agentclientprotocol/sdk";
		const acp = (await import(/* webpackIgnore: true */ acpSdkModule));

		child = spawn(getGeminiPath(), ["--acp"], {
			cwd: process.cwd(),
			env: { ...process.env },
			stdio: ["pipe", "pipe", "inherit"],
		});

		const stdoutWeb = Writable.toWeb(child.stdin as any);
		const stdinWeb = Readable.toWeb(child.stdout as any);

		const acpStream = acp.ndJsonStream(stdoutWeb as any, stdinWeb as any);
		let accumulatedText = "";

		const clientHandler: any = {
			async requestPermission(params: any) {
				return { outcome: "accept" };
			},
			async sessionUpdate(params: any) {
				const update = params.update;

				if (update.sessionUpdate === "agent_message_chunk") {
					if (update.content && update.content.type === "text") {
						const chunk = update.content.text;
						accumulatedText += chunk;
						if (partialMessage.content.length === 0) {
							partialMessage.content.push({ type: "text", text: chunk });
							stream.push({ type: "text_start", contentIndex: 0, partial: partialMessage });
						} else {
							(partialMessage.content[0] as any).text = accumulatedText;
						}
						stream.push({ type: "text_delta", contentIndex: 0, delta: chunk, partial: partialMessage });
					}
				}
			}
		};

		const connection = new acp.ClientSideConnection(() => clientHandler, acpStream);

		stream.push({ type: "start", partial: partialMessage });

		await connection.initialize({
			protocolVersion: "1.0" as any,
			clientInfo: { name: "pi-coding-agent", version: "1.0.0" }
		});

		const newSessionResponse = await connection.newSession({
			cwd: process.cwd(),
			mcpServers: []
		});
		const sessionId = newSessionResponse.sessionId;

		if (options?.signal) {
			options.signal.addEventListener("abort", () => {
				connection.cancel({ sessionId }).catch(() => {});
			});
		}

		const promptText = extractLastUserPrompt(context);

		const response = await connection.prompt({
			sessionId,
			prompt: [{ type: "text", text: promptText }],
		});

		if (partialMessage.content.length > 0 && partialMessage.content[0].type === "text") {
			stream.push({ type: "text_end", contentIndex: 0, content: accumulatedText, partial: partialMessage });
		} else if (accumulatedText === "") {
			partialMessage.content.push({ type: "text", text: "(No text response)" });
		}

		partialMessage.stopReason = mapStopReason(response.stopReason);

		stream.push({ type: "done", reason: partialMessage.stopReason, message: partialMessage });

	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		partialMessage.stopReason = "error";
		partialMessage.errorMessage = errorMsg;
		stream.push({ type: "error", reason: "error", error: partialMessage });
	} finally {
		if (child) {
			child.kill();
		}
	}
}
