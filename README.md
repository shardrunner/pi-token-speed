# Pi token speed

Check the average output speed of your last successful model response directly
in [Pi](https://pi.dev)'s existing footer:

```text
42.7 tok/s
```

## Usage

From a local checkout, try without installing:

```bash
pi -e ./index.ts
```

For persistent installation:

```bash
pi install git:github.com/shardrunner/pi-token-speed
```

Then run `/reload` in an existing Pi session.

## Measurement

Calculates `usage.output / (durationMs / 1000)` from the completed assistant
message. Reported output already includes reasoning tokens when available.

Uses Pi's response duration, not a locally timed turn. Tool execution and idle
time are excluded; preparation, authentication, or routing before the response
stream may also be excluded. This is a response average, not pure decoding speed.

Updates after successful responses, including tool-call and token-limit
responses. Failed responses and missing/invalid usage or duration leave the
previous value unchanged. Nothing appears before the first valid measurement.
Session start/switch, tree navigation, reload, and shutdown clear the status.

Uses its own `token-speed` status key without replacing the footer or editor,
changing messages, or adding requests, timers, or session entries. Terminal UI
only; RPC, JSON, and print modes are unaffected.

## Project status

Developed with AI assistance for personal use. Provided as-is, without support or
compatibility guarantees. Review the source and documented limitations before use.

## Development

```bash
npm ci --ignore-scripts
npm run check
```

Tests are self-contained and require no sibling extensions or provider calls.
Pi provides the extension API; the SDK dependency is used only for development
types. No runtime dependencies are bundled.

## License

[MIT](LICENSE) © 2026 Michael Brunner.
