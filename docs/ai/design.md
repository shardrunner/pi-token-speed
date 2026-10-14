# Token speed extension

## Scope

User request: create a Pi extension in this repository that displays only tok/s.
No automatic installation or changes to personal Pi settings.

## Design

Use `ctx.ui.setStatus("token-speed", "42.7 tok/s")` rather than replacing the
footer. Start a monotonic clock on `turn_start` and finish at the assistant's
`message_end`. Starting at `message_start` would omit provider latency because
that event is emitted when the provider stream starts, not before the request.
Tool execution follows the assistant message, so it is excluded.

Use final provider `usage.output`. It includes reported reasoning tokens. Never
count stream chunks as tokens. Only successful stop/length/toolUse responses
with positive finite output usage and positive elapsed time update the display.
Discard consumed and unfinished timing; preserve the last valid speed between
responses. Clear status and timing on session start, tree navigation, and
shutdown. No terminal UI calls outside `tui` mode.

## Verification

`npm run check` runs strict TypeScript checking and 16 deterministic Node tests
with a mocked monotonic clock. Covers latency, tools, reasoning accounting,
rounding, failed/deferred responses, invalid usage, lifecycle cleanup, duplicate
completions, and non-interactive modes.

Tests initially failed because `index.ts` did not yet exist, then passed after
implementation. npm rejected development dependency Pi 1.2.0 with `ETARGET`
because the user's minimum-release-age is three days. Use available Pi 1.1.0
for development types without bypassing that policy. The installed Pi runtime
is 1.2.0; no compatibility shims or runtime dependencies are included.
