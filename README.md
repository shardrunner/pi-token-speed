# pi-token-speed

> **Disclaimer:** This extension is vibe coded for personal use. Use at your own risk.

See how fast your last model response was generated, right in
[Pi](https://pi.dev)'s existing footer:

```text
42.7 tok/s
```

## Why

- Speed varies a lot between providers, models and routes, but Pi doesn't show it, so slow setups go unnoticed.

## Features

- Average output speed of the last successful response.
- Uses its own status entry, so the footer and editor are not replaced.
- No extra requests, timers or session entries.

## Installation

Requires **Pi 1.1.0+** and **Node.js 22.19+**.

```sh
pi install git:github.com/shardrunner/pi-token-speed
```

Run `/reload` in open Pi sessions. Update with `pi update --extensions`.
For local development, try a checkout once with `pi -e ./index.ts`.
No runtime dependencies, no build step.

## Usage

Nothing to configure. The speed appears after the first successful response with valid
output-token and duration data, and updates after each further one.

## Behavior and limitations

- **Formula:** `usage.output / (durationMs / 1000)`, based on the completed assistant
  message. Reasoning tokens are included in the output count when the provider reports
  them.
- **Timing:** uses Pi's response duration, not a local timer. Tool execution and idle
  time are excluded, and so may be preparation, authentication or routing before the
  response starts. It is an average for the whole response, not pure decoding speed.
- **Updates:** successful responses count, including tool-call and token-limit
  responses. Failed responses and missing or invalid output or duration data keep
  the previous value. Session start or switch, `/tree` navigation, reload and shutdown clear it.
- **Modes:** TUI only. RPC, JSON and print modes are unaffected.

## Development

```sh
npm ci --ignore-scripts
npm run check
```

Requires Node.js 22.19+. Tests are self-contained and need no other extensions or
provider calls. The SDK is a development-only dependency used for types.

## License

[MIT](LICENSE) © 2026 Michael Brunner
