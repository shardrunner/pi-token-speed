import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "token-speed";

export default function tokenSpeed(pi: ExtensionAPI) {
  const reset = (_event: unknown, ctx: ExtensionContext) => {
    if (ctx.mode === "tui") ctx.ui.setStatus(STATUS_KEY, undefined);
  };

  pi.on("session_start", reset);
  pi.on("session_tree", reset);
  pi.on("session_shutdown", reset);

  pi.on("message_end", (event, ctx) => {
    if (ctx.mode !== "tui" || event.message.role !== "assistant") return;
    const message = event.message;
    if (!["stop", "length", "toolUse"].includes(message.stopReason)) return;

    const durationMs = message.durationMs;
    if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) return;
    // Provider output already includes reasoning tokens, when reported.
    const output = message.usage?.output;
    if (!Number.isFinite(output) || output <= 0) return;

    const speed = output / (durationMs / 1_000);
    if (!Number.isFinite(speed)) return;
    ctx.ui.setStatus(STATUS_KEY, `${speed.toFixed(1)} tok/s`);
  });
}
