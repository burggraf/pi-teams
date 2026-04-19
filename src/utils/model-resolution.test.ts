import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildPreferredModelsFromSettings,
  isKnownQualifiedModel,
  isQualifiedModel,
  listPreferredQualifiedModels,
  loadModelResolutionConfig,
  loadPiModelSettings,
  normalizeQualifiedModel,
  parseQualifiedModel,
  sortAvailableModels,
  stripThinkingSuffix,
  type AvailableModel,
} from "./model-resolution";

const availableModels: AvailableModel[] = [
  { provider: "openrouter", model: "gpt-5" },
  { provider: "openai-codex", model: "gpt-5.4" },
  { provider: "claude-agent-sdk", model: "claude-sonnet-4-6" },
  { provider: "claude-agent-sdk", model: "claude-opus-4-7" },
  { provider: "kimi-coding", model: "kimi-for-coding" },
];

describe("qualified model helpers", () => {
  it("parses qualified models", () => {
    expect(parseQualifiedModel("openai-codex/gpt-5.4")).toEqual({
      provider: "openai-codex",
      model: "gpt-5.4",
    });
  });

  it("strips thinking suffixes", () => {
    expect(stripThinkingSuffix("openai-codex/gpt-5.4:high")).toBe("openai-codex/gpt-5.4");
  });

  it("detects qualified models", () => {
    expect(isQualifiedModel("openai-codex/gpt-5.4")).toBe(true);
    expect(isQualifiedModel("gpt-5")).toBe(false);
  });

  it("normalizes qualified models", () => {
    expect(normalizeQualifiedModel("openai-codex/gpt-5.4:high")).toBe("openai-codex/gpt-5.4");
    expect(normalizeQualifiedModel("gpt-5")).toBeNull();
  });

  it("checks known qualified models", () => {
    expect(isKnownQualifiedModel("openai-codex/gpt-5.4", availableModels)).toBe(true);
    expect(isKnownQualifiedModel("openrouter/gpt-4o", availableModels)).toBe(false);
  });
});

describe("loadModelResolutionConfig", () => {
  const testRoot = path.join(os.tmpdir(), `pi-teams-model-config-${Date.now()}`);
  const homeDir = path.join(testRoot, "home");
  const projectDir = path.join(testRoot, "project");

  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(homeDir, ".pi"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, ".pi"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it("loads empty defaults when no config files exist", () => {
    fs.rmSync(path.join(homeDir, ".pi"), { recursive: true, force: true });
    fs.rmSync(path.join(projectDir, ".pi"), { recursive: true, force: true });

    const config = loadModelResolutionConfig({ homeDir, projectDir });

    expect(config.providerPriority).toEqual([]);
  });

  it("loads global config", () => {
    fs.writeFileSync(
      path.join(homeDir, ".pi", "pi-teams.json"),
      JSON.stringify({ providerPriority: ["openai-codex", "claude-agent-sdk"] }, null, 2)
    );

    const config = loadModelResolutionConfig({ homeDir, projectDir });

    expect(config.providerPriority).toEqual(["openai-codex", "claude-agent-sdk"]);
  });

  it("lets project config override global config", () => {
    fs.writeFileSync(
      path.join(homeDir, ".pi", "pi-teams.json"),
      JSON.stringify({ providerPriority: ["claude-agent-sdk"] }, null, 2)
    );
    fs.writeFileSync(
      path.join(projectDir, ".pi", "pi-teams.json"),
      JSON.stringify({ providerPriority: ["openai-codex"] }, null, 2)
    );

    const config = loadModelResolutionConfig({ homeDir, projectDir });

    expect(config.providerPriority).toEqual(["openai-codex"]);
  });
});

describe("loadPiModelSettings", () => {
  const testRoot = path.join(os.tmpdir(), `pi-teams-pi-settings-${Date.now()}`);
  const homeDir = path.join(testRoot, "home");
  const projectDir = path.join(testRoot, "project");

  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(homeDir, ".pi", "agent"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, ".pi"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it("loads global pi settings", () => {
    fs.writeFileSync(
      path.join(homeDir, ".pi", "agent", "settings.json"),
      JSON.stringify({
        defaultProvider: "openai-codex",
        defaultModel: "gpt-5.4",
        enabledModels: ["claude-*"],
      }, null, 2)
    );

    const settings = loadPiModelSettings({ homeDir, projectDir });

    expect(settings.defaultProvider).toBe("openai-codex");
    expect(settings.defaultModel).toBe("gpt-5.4");
    expect(settings.enabledModels).toEqual(["claude-*"]);
  });

  it("lets project pi settings override global settings", () => {
    fs.writeFileSync(
      path.join(homeDir, ".pi", "agent", "settings.json"),
      JSON.stringify({ defaultProvider: "claude-agent-sdk", defaultModel: "claude-opus-4-7" }, null, 2)
    );
    fs.writeFileSync(
      path.join(projectDir, ".pi", "settings.json"),
      JSON.stringify({ defaultProvider: "openai-codex", defaultModel: "gpt-5.4" }, null, 2)
    );

    const settings = loadPiModelSettings({ homeDir, projectDir });

    expect(settings.defaultProvider).toBe("openai-codex");
    expect(settings.defaultModel).toBe("gpt-5.4");
  });
});

describe("preferred model selection", () => {
  it("builds preferred models from explicit preferences and pi settings", () => {
    const preferred = buildPreferredModelsFromSettings(
      availableModels,
      {
        defaultProvider: "openai-codex",
        defaultModel: "gpt-5.4",
        enabledModels: ["claude-*", "kimi-for-coding"],
      },
      ["claude-agent-sdk/claude-opus-4-7"]
    );

    expect(preferred).toEqual([
      "claude-agent-sdk/claude-opus-4-7",
      "openai-codex/gpt-5.4",
      "claude-agent-sdk/claude-sonnet-4-6",
      "kimi-coding/kimi-for-coding",
    ]);
  });

  it("lists preferred qualified models from on-disk settings", () => {
    const testRoot = path.join(os.tmpdir(), `pi-teams-preferred-${Date.now()}`);
    const homeDir = path.join(testRoot, "home");

    fs.mkdirSync(path.join(homeDir, ".pi", "agent"), { recursive: true });
    fs.writeFileSync(
      path.join(homeDir, ".pi", "agent", "settings.json"),
      JSON.stringify({
        defaultProvider: "openai-codex",
        defaultModel: "gpt-5.4",
        enabledModels: ["claude-*"],
      }, null, 2)
    );

    const preferred = listPreferredQualifiedModels(availableModels, { homeDir });
    expect(preferred).toEqual([
      "openai-codex/gpt-5.4",
      "claude-agent-sdk/claude-sonnet-4-6",
      "claude-agent-sdk/claude-opus-4-7",
    ]);

    fs.rmSync(testRoot, { recursive: true, force: true });
  });
});

describe("sortAvailableModels", () => {
  it("sorts preferred models first, then provider priority, then alphabetically", () => {
    const sorted = sortAvailableModels(availableModels, {
      preferredModels: ["openai-codex/gpt-5.4", "claude-agent-sdk/claude-sonnet-4-6"],
      providerPriority: ["kimi-coding", "claude-agent-sdk"],
    });

    expect(sorted.map((model) => model.qualified)).toEqual([
      "openai-codex/gpt-5.4",
      "claude-agent-sdk/claude-sonnet-4-6",
      "kimi-coding/kimi-for-coding",
      "claude-agent-sdk/claude-opus-4-7",
      "openrouter/gpt-5",
    ]);
  });
});
