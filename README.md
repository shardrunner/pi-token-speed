# Pi token speed

Displays only the last completed model response's average output speed in Pi's
existing footer:

```text
42.7 tok/s
```

## Install

```bash
pi install /home/mbr724/Documents/Personal/repos/extensions/pi/token-speed
```

Run `/reload` in an existing Pi session after installing. To try it without
installing:

```bash
pi -e /home/mbr724/Documents/Personal/repos/extensions/pi/token-speed/index.ts
```

## Measurement

- Uses the provider-reported output token count, not streamed chunk counts or
  text-based estimates. Reasoning tokens are included when the provider includes
  them in output usage; they are not counted twice.
- Divides by elapsed time from `turn_start` to the assistant's `message_end`.
  This includes request setup, network latency, and generation, but excludes
  tool execution and time between turns. It is an end-to-end response average,
  not the model's pure decoding throughput.
- Updates after each successful assistant response, including tool-call and
  token-limit responses. The last value stays visible during tools and the next
  response. Nothing is displayed before the first valid measurement.
- Failed, aborted, deferred, and zero/invalid-usage responses leave the previous
  value unchanged. Session start/switch, tree navigation, reload, and shutdown
  clear it.
- No timers, extra model requests, saved session entries, or replacement footer.
  Terminal UI only; RPC, JSON, and print modes are unaffected.

## Development

```bash
npm ci --ignore-scripts
npm run check
```

Pi supplies the extension's only import at runtime. Development types are pinned
at Pi 1.1.0, respecting the local npm minimum-release-age policy; the extension
uses the same lifecycle and status APIs in the installed Pi 1.2.0.
