import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import tokenSpeed from "./index.ts";

function harness(t: TestContext, mode = "tui") {
  let now = 0;
  t.mock.method(performance, "now", () => now);
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
    at: (milliseconds: number) => { now = milliseconds; },
    emit: (name: string, event: any = {}) => handlers.get(name)?.(event, ctx),
    last: () => statuses.at(-1)?.[1],
  };
}

function assistant(output = 100, stopReason = "stop", reasoning = 0) {
  return { role: "assistant", stopReason, usage: { output, reasoning } };
}

test("displays only tok/s, including latency before streaming starts", (t) => {
  const h = harness(t);
  h.emit("session_start");
  h.emit("turn_start");
  h.at(1_000);
  h.emit("message_start", { message: assistant() });
  h.at(2_000);
  h.emit("message_end", { message: assistant() });
  assert.deepEqual(h.statuses.at(-1), ["token-speed", "50.0 tok/s"]);
});

test("ignores user and tool messages without disturbing response timing", (t) => {
  const h = harness(t);
  h.emit("turn_start");
  h.at(500);
  for (const role of ["user", "toolResult"]) {
    h.emit("message_end", { message: { role } });
  }
  assert.equal(h.statuses.length, 0);
  h.at(2_000);
  h.emit("message_end", { message: assistant() });
  assert.equal(h.last(), "50.0 tok/s");
});

test("keeps the last result and excludes tool execution and idle time", (t) => {
  const h = harness(t);
  h.emit("turn_start");
  h.at(2_000);
  h.emit("message_end", { message: assistant(100, "toolUse") });
  h.at(30_000);
  h.emit("turn_end");
  h.emit("turn_start");
  assert.equal(h.last(), "50.0 tok/s");
  h.at(31_000);
  h.emit("message_end", { message: assistant(80) });
  assert.equal(h.last(), "80.0 tok/s");
});

test("does not double-count reasoning tokens already included in output", (t) => {
  const h = harness(t);
  h.emit("turn_start");
  h.at(1_000);
  h.emit("message_end", { message: assistant(100, "stop", 80) });
  assert.equal(h.last(), "100.0 tok/s");
});

test("accepts token-limit completions", (t) => {
  const h = harness(t);
  h.emit("turn_start");
  h.at(3_000);
  h.emit("message_end", { message: assistant(100, "length") });
  assert.equal(h.last(), "33.3 tok/s");
});

test("skips failed, aborted, pending, and deferred responses", (t) => {
  const h = harness(t);
  for (const stopReason of ["error", "aborted", "pending", "deferred"]) {
    h.emit("turn_start");
    h.at(10_000);
    h.emit("message_end", { message: assistant(100, stopReason) });
    h.at(20_000);
  }
  assert.equal(h.statuses.length, 0);
});

test("skips missing/invalid usage and nonpositive elapsed time", (t) => {
  const h = harness(t);
  for (const output of [0, -1, NaN, Infinity, undefined]) {
    h.at(0);
    h.emit("turn_start");
    h.at(1_000);
    h.emit("message_end", { message: { ...assistant(), usage: { output } } });
  }
  h.at(0);
  h.emit("turn_start");
  h.at(1_000);
  h.emit("message_end", { message: { role: "assistant", stopReason: "stop" } });
  for (const elapsed of [0, -1]) {
    h.at(0);
    h.emit("turn_start");
    h.at(elapsed);
    h.emit("message_end", { message: assistant() });
  }
  assert.equal(h.statuses.length, 0);
});

test("does not reuse timing for duplicate or unpaired completions", (t) => {
  const h = harness(t);
  h.at(1_000);
  h.emit("message_end", { message: assistant() });
  assert.equal(h.statuses.length, 0);
  h.emit("turn_start");
  h.at(2_000);
  h.emit("message_end", { message: assistant() });
  h.at(3_000);
  h.emit("message_end", { message: assistant() });
  assert.equal(h.statuses.length, 1);
});

for (const event of ["turn_end", "agent_end"]) {
  test(`${event} discards unfinished timing but preserves the last speed`, (t) => {
    const h = harness(t);
    h.emit("turn_start");
    h.at(1_000);
    h.emit("message_end", { message: assistant() });
    h.emit("turn_start");
    h.emit(event);
    h.at(2_000);
    h.emit("message_end", { message: assistant() });
    assert.equal(h.statuses.length, 1);
    assert.equal(h.last(), "100.0 tok/s");
  });
}

for (const event of ["session_start", "session_tree", "session_shutdown"]) {
  test(`${event} clears status and timing`, (t) => {
    const h = harness(t);
    h.emit("turn_start");
    h.at(1_000);
    h.emit("message_end", { message: assistant() });
    h.emit("turn_start");
    h.emit(event);
    assert.equal(h.last(), undefined);
    h.at(2_000);
    h.emit("message_end", { message: assistant() });
    assert.equal(h.last(), undefined);
  });
}

for (const mode of ["rpc", "json", "print"]) {
  test(`${mode} mode does not use terminal UI`, (t) => {
    const h = harness(t, mode);
    h.emit("session_start");
    h.emit("turn_start");
    h.at(1_000);
    h.emit("message_end", { message: assistant() });
    h.emit("session_shutdown");
    assert.equal(h.statuses.length, 0);
  });
}
