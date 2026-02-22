/**
 * Terminal Registry
 * 
 * Manages terminal adapters and provides automatic selection based on
 * the current environment.
 */

import { TerminalAdapter } from "../utils/terminal-adapter";
import { TmuxAdapter } from "./tmux-adapter";
import { Iterm2Adapter } from "./iterm2-adapter";
import { ZellijAdapter } from "./zellij-adapter";
import { WezTermAdapter } from "./wezterm-adapter";

/**
 * Available terminal adapters, ordered by priority
 *
 * Detection order (first match wins):
 * 1. tmux - if TMUX env is set
 * 2. Zellij - if ZELLIJ env is set and not in tmux
 * 3. iTerm2 - if TERM_PROGRAM=iTerm.app and not in tmux/zellij
 * 4. WezTerm - if WEZTERM_PANE env is set and not in tmux/zellij
 */
const adapters: TerminalAdapter[] = [
  new TmuxAdapter(),
  new ZellijAdapter(),
  new Iterm2Adapter(),
  new WezTermAdapter(),
];

/**
 * Cached detected adapter
 */
let cachedAdapter: TerminalAdapter | null = null;

/**
 * Detect and return the appropriate terminal adapter for the current environment.
 *
 * Detection order (first match wins):
 * 1. tmux - if TMUX env is set
 * 2. Zellij - if ZELLIJ env is set and not in tmux
 * 3. iTerm2 - if TERM_PROGRAM=iTerm.app and not in tmux/zellij
 * 4. WezTerm - if WEZTERM_PANE env is set and not in tmux/zellij
 *
 * @returns The detected terminal adapter, or null if none detected
 */
export function getTerminalAdapter(): TerminalAdapter | null {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  for (const adapter of adapters) {
    if (adapter.detect()) {
      cachedAdapter = adapter;
      return adapter;
    }
  }

  return null;
}

/**
 * Get a specific terminal adapter by name.
 *
 * @param name - The adapter name (e.g., "tmux", "iTerm2", "zellij", "WezTerm")
 * @returns The adapter instance, or undefined if not found
 */
export function getAdapterByName(name: string): TerminalAdapter | undefined {
  return adapters.find(a => a.name === name);
}

/**
 * Get all available adapters.
 * 
 * @returns Array of all registered adapters
 */
export function getAllAdapters(): TerminalAdapter[] {
  return [...adapters];
}

/**
 * Clear the cached adapter (useful for testing or environment changes)
 */
export function clearAdapterCache(): void {
  cachedAdapter = null;
}

/**
 * Set a specific adapter (useful for testing or forced selection)
 */
export function setAdapter(adapter: TerminalAdapter): void {
  cachedAdapter = adapter;
}

/**
 * Check if any terminal adapter is available.
 * 
 * @returns true if a terminal adapter was detected
 */
export function hasTerminalAdapter(): boolean {
  return getTerminalAdapter() !== null;
}
