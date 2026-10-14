---
summary: Token-speed measurement, lifecycle isolation, and coexistence verification with sibling Pi extensions.
read_when:
  - Changing token speed measurement or lifecycle handling.
  - Checking interactions with sibling Pi extensions.
---

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

## Coexistence

All ten sibling extensions were reviewed. None replace the footer. Only
prompt-cache-status and jev-control write footer status; their keys are distinct
from token-speed. Shared prompt history owns the editor. Jev owns a terminal
input hook for cancelling user command reviews. Other siblings affect commands,
input, prompts, tool guards, session restoration/summary, or child SDK sessions;
token-speed registers none of those capabilities.

`npm run test:coexistence` loads the actual sibling entry points from their
package manifests using `DefaultResourceLoader`, not reimplementations. Tests
load token-speed first and last, dispatch shared lifecycle events in registration
order, and verify:

- Distinct cache/Jev/token-speed statuses survive each other's updates.
- Prompt history's editor and Jev's input hook remain installed.
- Commands/tools/flags have no duplicate names; active tool state is preserved.
- Jev still blocks a bash call using a mocked local classifier (no execution).
- Classification/tool time and subagent tool-result usage do not affect tok/s.
- Final messages/usage remain unmodified and no token-speed entries are appended.
- Virtual selection/physical response identities do not cause status collisions.
- Tree navigation and shutdown reset only the appropriate session state.

The tests use a disposable agent directory and never send a prompt, make provider
calls, run a shell command, or write to personal Pi settings/history. SDK
coexistence uses development dependency Pi 1.1.0. The installed Pi 1.2.0 also
passed an offline CLI load check with all ten sibling packages using
`--offline --no-extensions -e ./index.ts -e ../<sibling> ... --list-models openrouter`.
This verifies extension loading, not full interactive rendering or live models.

## Verification

`npm run check` runs strict TypeScript checking and 16 deterministic Node tests
with a mocked monotonic clock. Covers latency, tools, reasoning accounting,
rounding, failed/deferred responses, invalid usage, lifecycle cleanup, duplicate
completions, and non-interactive modes. The separate coexistence suite adds two
all-sibling integration scenarios and requires those sibling checkouts.

Tests initially failed because `index.ts` did not yet exist, then passed after
implementation. npm rejected development dependency Pi 1.2.0 with `ETARGET`
because the user's minimum-release-age is three days. Use available Pi 1.1.0
for development types without bypassing that policy. The installed Pi runtime
is 1.2.0; no compatibility shims or runtime dependencies are included.
