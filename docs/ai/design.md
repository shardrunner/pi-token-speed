---
summary: Host-provided token-speed measurement and lifecycle isolation.
read_when:
  - Changing token speed measurement or lifecycle handling.
---

# Token speed extension

See [README](../../README.md) for usage, measurement semantics, lifecycle behavior,
and development commands.

## Design decisions

- Reuse Pi's optional `AssistantMessage.durationMs` instead of tracking local
  timing state. Do not add a fallback timer: mixing response and full-turn
  durations would give the same displayed metric competing definitions.
- Use a key-scoped status rather than owning the footer or adding persistent
  state. Installation remains an explicit user action.
- Keep tests self-contained; other extension repositories are not part of this
  package's verification contract.

## Development SDK pin

SDK types remain pinned to Pi 1.1.0 because Pi 1.2.0 was initially blocked by the
local three-day npm minimum-release-age policy. Both provide `durationMs`; no
compatibility shims or additional runtime dependencies are needed.
