import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

describe("Gemini CLI Stream Adapter via ACP", () => {
    // Tests for mapStopReason equivalent logic
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

    it("should map ACP stop reasons to GSD stop reasons", () => {
        assert.equal(mapStopReason("end_turn"), "stop");
        assert.equal(mapStopReason("max_tokens"), "length");
        assert.equal(mapStopReason("refusal"), "stop");
        assert.equal(mapStopReason("max_turn_requests"), "length");
        assert.equal(mapStopReason("cancelled"), "stop");
        assert.equal(mapStopReason("unknown_reason"), "stop");
    });

    it("should accumulate message text chunks", () => {
        let accumulatedText = "";
        const partialMessage: any = { content: [] };
        const chunks = ["Hello, ", "world", "!"];
        const streamEvents: any[] = [];

        for (const chunk of chunks) {
            accumulatedText += chunk;
            if (partialMessage.content.length === 0) {
                partialMessage.content.push({ type: "text", text: chunk });
                streamEvents.push({ type: "text_start", contentIndex: 0, partial: partialMessage });
            } else {
                partialMessage.content[0].text = accumulatedText;
            }
            streamEvents.push({ type: "text_delta", contentIndex: 0, delta: chunk, partial: partialMessage });
        }

        assert.equal(accumulatedText, "Hello, world!");
        assert.equal(partialMessage.content[0].text, "Hello, world!");
        assert.equal(streamEvents.length, 4); // 1 start + 3 deltas
        assert.equal(streamEvents[0].type, "text_start");
        assert.equal(streamEvents[1].type, "text_delta");
        assert.equal(streamEvents[2].type, "text_delta");
        assert.equal(streamEvents[3].type, "text_delta");
    });
});
