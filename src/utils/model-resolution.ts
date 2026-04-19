import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface AvailableModel {
  provider: string;
  model: string;
}

export interface ModelResolutionConfig {
  providerPriority?: string[];
}

export interface ResolvedModelResolutionConfig {
  providerPriority: string[];
}

export interface PiModelSettings {
  defaultProvider?: string;
  defaultModel?: string;
  enabledModels?: string[];
}

export interface SortedModel extends AvailableModel {
  qualified: string;
  preferred: boolean;
  preferredIndex: number;
  providerPriorityIndex: number;
}

const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

function normalizeList(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;

  const normalized = values
    .map((value) => String(value).trim())
    .filter(Boolean);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [];
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function readConfigFile(configPath: string): ModelResolutionConfig {
  const parsed = readJsonFile<ModelResolutionConfig>(configPath);
  if (!parsed) {
    return {};
  }

  return {
    providerPriority: normalizeList(parsed.providerPriority)?.map((value) => value.toLowerCase()),
  };
}

/**
 * Loads pi-teams model-selection preferences.
 *
 * Supported locations:
 * - ~/.pi/pi-teams.json
 * - <project>/.pi/pi-teams.json
 *
 * Project-local config overrides global config.
 */
export function loadModelResolutionConfig(options?: {
  projectDir?: string;
  homeDir?: string;
}): ResolvedModelResolutionConfig {
  const homeDir = options?.homeDir ?? os.homedir();
  const projectDir = options?.projectDir;

  const globalConfigPath = path.join(homeDir, ".pi", "pi-teams.json");
  const projectConfigPath = projectDir ? path.join(projectDir, ".pi", "pi-teams.json") : null;

  const merged: ResolvedModelResolutionConfig = {
    providerPriority: [],
  };

  for (const configPath of [globalConfigPath, projectConfigPath]) {
    if (!configPath) continue;

    const config = readConfigFile(configPath);
    if (config.providerPriority) {
      merged.providerPriority = config.providerPriority;
    }
  }

  return merged;
}

/**
 * Loads pi settings relevant to model selection.
 *
 * Supported locations:
 * - ~/.pi/agent/settings.json
 * - <project>/.pi/settings.json
 *
 * Project-local settings override global settings.
 */
export function loadPiModelSettings(options?: {
  projectDir?: string;
  homeDir?: string;
}): PiModelSettings {
  const homeDir = options?.homeDir ?? os.homedir();
  const projectDir = options?.projectDir;

  const globalSettingsPath = path.join(homeDir, ".pi", "agent", "settings.json");
  const projectSettingsPath = projectDir ? path.join(projectDir, ".pi", "settings.json") : null;

  const merged: PiModelSettings = {};

  for (const settingsPath of [globalSettingsPath, projectSettingsPath]) {
    if (!settingsPath) continue;

    const settings = readJsonFile<PiModelSettings>(settingsPath);
    if (!settings) continue;

    if (typeof settings.defaultProvider === "string" && settings.defaultProvider.trim()) {
      merged.defaultProvider = settings.defaultProvider.trim();
    }
    if (typeof settings.defaultModel === "string" && settings.defaultModel.trim()) {
      merged.defaultModel = settings.defaultModel.trim();
    }
    if (Array.isArray(settings.enabledModels)) {
      merged.enabledModels = settings.enabledModels
        .map((value) => String(value).trim())
        .filter(Boolean);
    }
  }

  return merged;
}

export function stripThinkingSuffix(specifier: string): string {
  const trimmed = specifier.trim();
  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon === -1) {
    return trimmed;
  }

  const suffix = trimmed.slice(lastColon + 1).toLowerCase();
  return THINKING_LEVELS.has(suffix) ? trimmed.slice(0, lastColon) : trimmed;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPattern(pattern: string, value: string): boolean {
  const normalizedPattern = pattern.toLowerCase();
  const normalizedValue = value.toLowerCase();

  if (normalizedPattern.includes("*")) {
    const regex = new RegExp(`^${normalizedPattern.split("*").map(escapeRegex).join(".*")}$`, "i");
    return regex.test(value);
  }

  return normalizedValue === normalizedPattern || normalizedValue.includes(normalizedPattern);
}

export function parseQualifiedModel(specifier: string): AvailableModel | null {
  const cleaned = stripThinkingSuffix(specifier);
  const slashIndex = cleaned.indexOf("/");
  if (slashIndex === -1) {
    return null;
  }

  const provider = cleaned.slice(0, slashIndex).trim();
  const model = cleaned.slice(slashIndex + 1).trim();
  if (!provider || !model) {
    return null;
  }

  return { provider, model };
}

export function isQualifiedModel(specifier: string): boolean {
  return parseQualifiedModel(specifier) !== null;
}

export function normalizeQualifiedModel(specifier: string): string | null {
  const parsed = parseQualifiedModel(specifier);
  return parsed ? `${parsed.provider}/${parsed.model}` : null;
}

function qualifyDefaultModel(settings: PiModelSettings): string | null {
  if (!settings.defaultModel) {
    return null;
  }

  if (isQualifiedModel(settings.defaultModel)) {
    return normalizeQualifiedModel(settings.defaultModel);
  }

  if (settings.defaultProvider) {
    return `${settings.defaultProvider}/${stripThinkingSuffix(settings.defaultModel)}`;
  }

  return null;
}

/**
 * Builds a list of preferred fully-qualified models from pi settings.
 *
 * Order is significant:
 * 1. preferredModels passed by the caller (must already be fully qualified)
 * 2. pi default model (qualified via defaultProvider when necessary)
 * 3. available models matching enabledModels patterns, in settings order
 */
export function buildPreferredModelsFromSettings(
  availableModels: AvailableModel[],
  settings: PiModelSettings,
  preferredModels: string[] = []
): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const push = (specifier?: string | null) => {
    if (!specifier) return;
    const normalized = normalizeQualifiedModel(specifier);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    results.push(normalized);
  };

  for (const model of preferredModels) {
    push(model);
  }

  push(qualifyDefaultModel(settings));

  for (const pattern of settings.enabledModels ?? []) {
    const cleanedPattern = stripThinkingSuffix(pattern);
    for (const availableModel of availableModels) {
      const qualified = `${availableModel.provider}/${availableModel.model}`;
      const target = cleanedPattern.includes("/") ? qualified : availableModel.model;
      if (matchesPattern(cleanedPattern, target)) {
        push(qualified);
      }
    }
  }

  return results;
}

export function listPreferredQualifiedModels(
  availableModels: AvailableModel[],
  options?: {
    projectDir?: string;
    homeDir?: string;
    preferredModels?: string[];
  }
): string[] {
  const settings = loadPiModelSettings(options);
  return buildPreferredModelsFromSettings(availableModels, settings, options?.preferredModels ?? []);
}

export function sortAvailableModels(
  availableModels: AvailableModel[],
  options?: {
    preferredModels?: string[];
    providerPriority?: string[];
  }
): SortedModel[] {
  const preferredModels = options?.preferredModels ?? [];
  const providerPriority = (options?.providerPriority ?? []).map((value) => value.toLowerCase());

  const preferredIndex = new Map(preferredModels.map((value, index) => [value, index]));
  const providerPriorityIndex = new Map(providerPriority.map((value, index) => [value, index]));

  return availableModels
    .map((model) => {
      const qualified = `${model.provider}/${model.model}`;
      return {
        ...model,
        qualified,
        preferred: preferredIndex.has(qualified),
        preferredIndex: preferredIndex.get(qualified) ?? Number.MAX_SAFE_INTEGER,
        providerPriorityIndex: providerPriorityIndex.get(model.provider.toLowerCase()) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => {
      if (a.preferred !== b.preferred) {
        return a.preferred ? -1 : 1;
      }
      if (a.preferredIndex !== b.preferredIndex) {
        return a.preferredIndex - b.preferredIndex;
      }
      if (a.providerPriorityIndex !== b.providerPriorityIndex) {
        return a.providerPriorityIndex - b.providerPriorityIndex;
      }
      const providerCompare = a.provider.localeCompare(b.provider);
      if (providerCompare !== 0) {
        return providerCompare;
      }
      return a.model.localeCompare(b.model);
    });
}

export function isKnownQualifiedModel(model: string, availableModels: AvailableModel[]): boolean {
  const normalized = normalizeQualifiedModel(model);
  if (!normalized) {
    return false;
  }

  return availableModels.some(
    (availableModel) => `${availableModel.provider}/${availableModel.model}` === normalized
  );
}
