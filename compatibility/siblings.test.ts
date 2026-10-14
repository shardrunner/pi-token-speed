import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DefaultResourceLoader,
  SettingsManager,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siblings = resolve(root, "..");
const siblingPaths = readdirSync(siblings, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "token-speed")
  .flatMap((entry) => {
    const directory = join(siblings, entry.name);
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    return (manifest.pi.extensions as string[]).map((path) => resolve(directory, path));
  });

for (const tokenFirst of [true, false]) {
  test(`coexists with all sibling extensions, loaded ${tokenFirst ? "first" : "last"}`, async (t) => {
    const temporary = mkdtempSync(join(tmpdir(), "pi-token-speed-compat-"));
    const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_CODING_AGENT_DIR = temporary;
    t.after(() => {
      if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
      else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
      rmSync(temporary, { recursive: true, force: true });
    });
    const paths = tokenFirst
      ? [join(root, "index.ts"), ...siblingPaths]
      : [...siblingPaths, join(root, "index.ts")];
    const loader = new DefaultResourceLoader({
      cwd: temporary,
      agentDir: temporary,
      settingsManager: SettingsManager.inMemory(),
      additionalExtensionPaths: paths,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
    });
    await loader.reload();
    const loaded = loader.getExtensions();
    assert.deepEqual(loaded.errors, []);
    assert.deepEqual(loaded.warnings ?? [], []);
    assert.equal(loaded.extensions.length, paths.length);
    assert.equal(siblingPaths.length, 10, "Update this check when sibling extensions change");

    let now = 0;
    t.mock.method(performance, "now", () => now);
    let activeTools = loaded.extensions.flatMap((extension) => [...extension.tools.keys()]);
    loaded.runtime.getActiveTools = () => activeTools;
    loaded.runtime.setActiveTools = (names) => { activeTools = names; };
    const entries: unknown[] = [];
    loaded.runtime.appendEntry = (...args) => { entries.push(args); };
    const statuses = new Map<string, string>();
    let editorChanges = 0;
    let terminalListeners = 0;
    let classifierCalls = 0;
    const ctx = {
      cwd: temporary,
      mode: "tui",
      hasUI: true,
      model: { provider: "openai", id: "test-model", api: "openai-responses" },
      isProjectTrusted: () => false,
      sessionManager: { getBranch: () => [] },
      modelRegistry: {
        findOfType: () => ({ id: "typesafe/jev-1.13" }),
        classify: async () => {
          classifierCalls++;
          now += 20_000; // Nested safety review must not affect model throughput.
          return {
            stopReason: "stop", model: "typesafe/jev-1.13",
            answers: { safety: {
              type: "choice", choice: "harmful", confidence: 1,
              probabilities: { harmful: 1, not_harmful: 0, may_be_harmful: 0 },
            } },
          };
        },
      },
      ui: {
        setStatus: (key: string, value: string | undefined) => {
          if (value === undefined) statuses.delete(key);
          else statuses.set(key, value);
        },
        setEditorComponent: () => { editorChanges++; },
        onTerminalInput: () => {
          terminalListeners++;
          let subscribed = true;
          return () => {
            if (subscribed) terminalListeners--;
            subscribed = false;
          };
        },
        notify: () => {},
        setFooter: () => { assert.fail("Extensions must not replace the footer"); },
        setWidget: () => { assert.fail("Token speed must not install a widget"); },
      },
    };
    const emit = async (type: string, event: Record<string, unknown> = {}) => {
      const results: unknown[] = [];
      for (const extension of loaded.extensions) {
        for (const handler of extension.handlers.get(type) ?? []) {
          results.push(await handler({ type, ...event }, ctx as unknown as ExtensionContext));
        }
      }
      return results;
    };
    // Always release the cache status timer and Jev/subagent session resources,
    // even if an assertion fails. "reload" avoids session-summary quit output.
    t.after(() => emit("session_shutdown", { reason: "reload" }));

    await emit("session_start", { reason: "startup" });
    assert.deepEqual([...statuses.keys()].sort(), ["jev-control", "prompt-cache-status"]);
    assert.equal(editorChanges, 1, "Shared prompt history still owns the editor");
    assert.equal(terminalListeners, 1, "Jev still owns its cancellation input hook");
    const originalActiveTools = [...activeTools];
    const registeredNames = (kind: "tools" | "commands" | "flags") =>
      loaded.extensions.flatMap((extension) => [...extension[kind].keys()]);
    for (const kind of ["tools", "commands", "flags"] as const) {
      const names = registeredNames(kind);
      assert.equal(new Set(names).size, names.length, `Duplicate ${kind} registration`);
    }

    const message = {
      role: "assistant", content: [{ type: "text", text: "response" }],
      provider: "openai", model: "test-model", api: "openai-responses",
      stopReason: "toolUse", timestamp: Date.now(),
      usage: { input: 100, output: 100, reasoning: 80, cacheRead: 100, cacheWrite: 0,
        totalTokens: 300, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    const original = structuredClone(message);
    await emit("turn_start");
    now = 2_000;
    assert.ok((await emit("message_end", { message })).every((result) => result === undefined));
    assert.deepEqual(message, original, "No transcript or usage mutation");
    assert.equal(statuses.get("token-speed"), "50.0 tok/s");
    assert.match(statuses.get("prompt-cache-status")!, /50\.0%/);
    assert.match(statuses.get("jev-control")!, /ready/);
    const cachedStatus = statuses.get("prompt-cache-status");

    const blocked = await emit("tool_call", {
      toolName: "bash", toolCallId: "bash-1", input: { command: "rm -rf /" },
    });
    assert.ok(blocked.some((result) => (result as { block?: boolean } | undefined)?.block === true));
    assert.equal(classifierCalls, 1, "Jev still reviews and blocks bash independently");
    assert.equal(statuses.get("token-speed"), "50.0 tok/s");
    assert.equal(statuses.get("prompt-cache-status"), cachedStatus);
    assert.match(statuses.get("jev-control")!, /blocked/);
    assert.equal(entries.length, 1, "Only Jev adds an entry; token speed stays UI-only");

    // Subagent/nested tool output usage belongs to the tool, not the parent model.
    await emit("message_end", { message: {
      role: "toolResult", toolName: "subagent", usage: { output: 50_000 },
    } });
    await emit("turn_end");
    await emit("turn_start");
    now += 1_000;
    await emit("message_end", { message: { ...message, stopReason: "stop", usage: { ...message.usage, output: 80 } } });
    assert.equal(statuses.get("token-speed"), "80.0 tok/s");
    assert.deepEqual(activeTools, originalActiveTools);
    assert.equal(editorChanges, 1);

    // Selected virtual identities still yield physical assistant messages.
    ctx.model = { provider: "router", id: "virtual", api: "pi-virtual" };
    await emit("model_select");
    await emit("turn_start");
    now += 1_000;
    await emit("message_end", { message });
    assert.equal(statuses.get("token-speed"), "100.0 tok/s");
    assert.match(statuses.get("prompt-cache-status")!, /latest physical response/);

    await emit("session_tree");
    assert.equal(statuses.has("token-speed"), false);
    assert.equal(statuses.has("prompt-cache-status"), true);
    assert.match(statuses.get("jev-control")!, /blocked/);
    await emit("session_shutdown", { reason: "reload" });
    assert.equal(statuses.size, 0);
    assert.equal(terminalListeners, 0);
  });
}
