---
summary: Host-provided token-speed measurement and lifecycle isolation.
read_when:
  - Changing token speed measurement or lifecycle handling.
---

# Token speed extension

Display only tok/s through `ctx.ui.setStatus("token-speed", ...)`. Do not replace
the footer/editor, mutate messages, add session entries, or modify personal Pi
settings automatically.

## Measurement

Use completed assistant `usage.output` and Pi's optional `durationMs`. Output
already includes reported reasoning tokens. The host owns response timing;
there is no local clock, request-pairing state, or turn/agent cleanup handler.

This deliberately measures the response rather than the full turn. Tool and idle
time are excluded; setup/authentication/routing before the response stream may
not be included. Missing or invalid duration does not trigger a fallback timer.

Only successful stop/length/toolUse responses with positive finite usage and
duration update the display. Preserve the last valid speed otherwise. Clear
only this extension's status on session start, tree navigation, and shutdown.
Never use terminal UI outside `tui` mode.

## Verification and dependencies

`npm run check` runs strict type checking and self-contained Node tests. There
are no sibling-repository dependencies or live provider calls.

Pi provides the extension API. Development SDK types remain pinned to Pi 1.1.0:
Pi 1.2.0 was initially blocked by the local three-day npm minimum-release-age
policy. Both versions provide `AssistantMessage.durationMs`; no compatibility
shims or additional runtime dependencies are needed.
