import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import tokenSpeed from "./index.ts";

function harness(mode = "tui") {
  const handlers = new Map<string, (event: any, ctx: ExtensionContext) => unknown>();
  const statuses: Array<[string, string | undefined]> = [];
  const ctx = {
    mode,
    ui: {
      setStatus: (key: string, value: string | undefined) => statuses.push([key, value]),
    },
  } as unknown as ExtensionContext;
  const api = {
    on: (name: string, handler: (event: any, ctx: ExtensionContext) => unknown) => {
      handlers.set(name, handler);
    },
  } as unknown as ExtensionAPI;
  tokenSpeed(api);
  return {
    statuses,
    emit: (name: string, event: any = {}) => handlers.get(name)?.(event, ctx),
    last: () => statuses.at(-1)?.[1],
  };
}

function assistant(output = 100, durationMs = 1_000, stopReason = "stop", reasoning = 0) {
  return { role: "assistant", stopReason, durationMs, usage: { output, reasoning } };
}

test("displays only tok/s using the completed assistant's duration", () => {
  const h = harness();
  for (const stopReason of ["stop", "toolUse", "length"]) {
    h.emit("message_end", { message: assistant(100, 3_000, stopReason) });
    assert.deepEqual(h.statuses.at(-1), ["token-speed", "33.3 tok/s"]);
  }
});

test("does not double-count reasoning tokens already included in output", () => {
  const h = harness();
  h.emit("message_end", { message: assistant(100, 1_000, "stop", 80) });
  assert.equal(h.last(), "100.0 tok/s");
});

test("ignores user and tool messages, including nested usage", () => {
  const h = harness();
  h.emit("message_end", { message: assistant() });
  for (const role of ["user", "toolResult"]) {
    h.emit("message_end", { message: { ...assistant(50_000), role } });
  }
  assert.equal(h.statuses.length, 1);
  assert.equal(h.last(), "100.0 tok/s");
  h.emit("message_end", { message: assistant(80) });
  assert.equal(h.last(), "80.0 tok/s");
});

test("missing or invalid durations preserve the last speed", () => {
  const h = harness();
  h.emit("message_end", { message: assistant() });
  for (const durationMs of [undefined, 0, -1, NaN, Infinity]) {
    h.emit("message_end", { message: { ...assistant(), durationMs } });
  }
  assert.equal(h.statuses.length, 1);
  assert.equal(h.last(), "100.0 tok/s");
});

test("missing or invalid output usage preserves the last speed", () => {
  const h = harness();
  h.emit("message_end", { message: assistant() });
  for (const output of [undefined, 0, -1, NaN, Infinity]) {
    h.emit("message_end", { message: { ...assistant(), usage: { output } } });
  }
  h.emit("message_end", { message: { ...assistant(), usage: undefined } });
  assert.equal(h.statuses.length, 1);
  assert.equal(h.last(), "100.0 tok/s");
});

test("failed, aborted, pending, and deferred responses preserve the last speed", () => {
  const h = harness();
  h.emit("message_end", { message: assistant() });
  for (const stopReason of ["error", "aborted", "pending", "deferred"]) {
    h.emit("message_end", { message: assistant(500, 1_000, stopReason) });
  }
  assert.equal(h.statuses.length, 1);
  assert.equal(h.last(), "100.0 tok/s");
});

test("observes the completed message without modifying it", () => {
  const h = harness();
  const message = assistant();
  const original = structuredClone(message);
  assert.equal(h.emit("message_end", { message }), undefined);
  assert.deepEqual(message, original);
});

for (const event of ["session_start", "session_tree", "session_shutdown"]) {
  test(`${event} clears the status`, () => {
    const h = harness();
    h.emit("message_end", { message: assistant() });
    assert.equal(h.last(), "100.0 tok/s");
    h.emit(event);
    assert.deepEqual(h.statuses.at(-1), ["token-speed", undefined]);
  });
}

for (const mode of ["rpc", "json", "print"]) {
  test(`${mode} mode does not use terminal UI`, () => {
    const h = harness(mode);
    h.emit("session_start");
    h.emit("message_end", { message: assistant() });
    h.emit("session_tree");
    h.emit("session_shutdown");
    assert.equal(h.statuses.length, 0);
  });
}
