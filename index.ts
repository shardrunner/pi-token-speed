import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "token-speed";

export default function tokenSpeed(pi: ExtensionAPI) {
  let startedAt: number | undefined;

  const reset = (_event: unknown, ctx: ExtensionContext) => {
    startedAt = undefined;
    if (ctx.mode === "tui") ctx.ui.setStatus(STATUS_KEY, undefined);
  };

  pi.on("session_start", reset);
  pi.on("session_tree", reset);
  pi.on("session_shutdown", reset);

  // message_start can arrive only after the provider responds. Start at the
  // turn boundary instead, so request latency is included, but tool time isn't.
  pi.on("turn_start", (_event, ctx) => {
    startedAt = ctx.mode === "tui" ? performance.now() : undefined;
  });

  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "assistant") return;
    const start = startedAt;
    startedAt = undefined;
    if (ctx.mode !== "tui" || start === undefined) return;

    const message = event.message;
    if (!["stop", "length", "toolUse"].includes(message.stopReason)) return;

    const elapsed = (performance.now() - start) / 1_000;
    // Provider output already includes reasoning tokens, when reported.
    const output = message.usage?.output;
    if (!Number.isFinite(output) || !(output > 0) || !(elapsed > 0)) return;
    const speed = output / elapsed;
    if (!Number.isFinite(speed)) return;
    ctx.ui.setStatus(STATUS_KEY, `${speed.toFixed(1)} tok/s`);
  });

  const discardTiming = () => { startedAt = undefined; };
  pi.on("turn_end", discardTiming);
  pi.on("agent_end", discardTiming);
}
