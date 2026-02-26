# Implementation Plan: Separate Windows Mode for pi-teams

## Goal
Implement the ability to open team members (including the team lead) in separate OS windows instead of panes, with window titles set to "team-name: agent-name" format.

## Research Summary

### Terminal Support Matrix

| Terminal | New Window Support | Window Title Method | Notes |
|----------|-------------------|---------------------|-------|
| **iTerm2** | ✅ AppleScript `create window with default profile` | AppleScript `set name` on session (tab) + escape sequences for window title | Primary target; window title property is read-only, use escape sequence `\033]2;Title\007` |
| **WezTerm** | ✅ `wezterm cli spawn --new-window` | `wezterm cli set-window-title` or escape sequences | Full support |
| **tmux** | ❌ Skipped | N/A | Only creates windows within session, not OS windows |
| **Zellij** | ❌ Skipped | N/A | Only creates tabs, not OS windows |

### Key Technical Findings

1. **iTerm2 AppleScript for New Window:**
   ```applescript
   tell application "iTerm"
       set newWindow to (create window with default profile)
       tell current session of newWindow
           write text "printf '\\033]2;Team: Agent\\007'"  -- Set window title via escape sequence
           set name to "tab-title"  -- Optional: set tab title
       end tell
   end tell
   ```

2. **WezTerm CLI for New Window:**
   ```bash
   wezterm cli spawn --new-window --cwd /path -- env KEY=val command
   wezterm cli set-window-title --window-id X "Team: Agent"
   ```

3. **Escape Sequence for Window Title (Universal):**
   ```bash
   printf '\033]2;Window Title\007'
   ```

## Implementation Phases

### Phase 1: Update Terminal Adapter Interface
**Status:** pending
**Files:** `src/utils/terminal-adapter.ts`

- [ ] Add `spawnWindow(options: SpawnOptions): string` method to `TerminalAdapter` interface
- [ ] Add `setWindowTitle(windowId: string, title: string): void` method to `TerminalAdapter` interface
- [ ] Update `SpawnOptions` to include optional `teamName?: string` for title formatting

### Phase 2: Implement iTerm2 Window Support
**Status:** pending
**Files:** `src/adapters/iterm2-adapter.ts`

- [ ] Implement `spawnWindow()` using AppleScript `create window with default profile`
- [ ] Capture and return window ID from AppleScript
- [ ] Implement `setWindowTitle()` using escape sequence injection via `write text`
- [ ] Format title as `{teamName}: {agentName}`
- [ ] Handle window lifecycle (track window IDs)

### Phase 3: Implement WezTerm Window Support
**Status:** pending
**Files:** `src/adapters/wezterm-adapter.ts`

- [ ] Implement `spawnWindow()` using `wezterm cli spawn --new-window`
- [ ] Capture and return window ID from spawn output
- [ ] Implement `setWindowTitle()` using `wezterm cli set-window-title`
- [ ] Format title as `{teamName}: {agentName}`

### Phase 4: Update Terminal Registry
**Status:** pending
**Files:** `src/adapters/terminal-registry.ts`

- [ ] Add feature detection method `supportsWindows(): boolean`
- [ ] Update registry to expose window capabilities

### Phase 5: Update Team Configuration
**Status:** pending
**Files:** `src/utils/models.ts`, `src/utils/teams.ts`

- [ ] Add `separateWindows?: boolean` to `TeamConfig` model
- [ ] Add `windowId?: string` to `Member` model (for tracking OS window IDs)
- [ ] Update `createTeam()` to accept and store `separateWindows` option

### Phase 6: Update spawn_teammate Tool
**Status:** pending
**Files:** `extensions/index.ts`

- [ ] Add `separate_window?: boolean` parameter to `spawn_teammate` tool
- [ ] Check team config for global `separateWindows` setting
- [ ] Use `spawnWindow()` instead of `spawn()` when separate windows mode is active
- [ ] Store window ID in member record instead of pane ID
- [ ] Set window title immediately after spawn using `setWindowTitle()`

### Phase 7: Create spawn_lead_window Tool (Optional)
**Status:** pending
**Files:** `extensions/index.ts`

- [ ] Create new tool `spawn_lead_window` to move team lead to separate window
- [ ] Only available if team has `separateWindows: true`
- [ ] Set window title for lead as `{teamName}: team-lead`

### Phase 8: Update Kill/Lifecycle Management
**Status:** pending
**Files:** `extensions/index.ts`, adapter files

- [ ] Update `killTeammate()` to handle window IDs (not just pane IDs)
- [ ] Implement window closing via AppleScript (iTerm2) or CLI (WezTerm)
- [ ] Update `isAlive()` checks for window-based teammates

### Phase 9: Testing & Validation
**Status:** pending

- [ ] Test iTerm2 window creation and title setting
- [ ] Test WezTerm window creation and title setting
- [ ] Test global `separateWindows` team setting
- [ ] Test per-teammate `separate_window` override
- [ ] Test window lifecycle (kill, isAlive)
- [ ] Verify title format: `{teamName}: {agentName}`

### Phase 10: Documentation
**Status:** pending
**Files:** `README.md`, `docs/guide.md`, `docs/reference.md`

- [ ] Document new `separate_window` parameter
- [ ] Document global `separateWindows` team setting
- [ ] Add iTerm2 and WezTerm window mode examples
- [ ] Update terminal requirements section

## Design Decisions

1. **Window Title Strategy:** Use escape sequences (`\033]2;Title\007`) for iTerm2 window titles since AppleScript's window title property is read-only. Tab titles will use the session `name` property.

2. **ID Tracking:** Store window IDs in the same `tmuxPaneId` field (renamed conceptually to `terminalId`) or add a new `windowId` field to Member model. Decision: Add `windowId` field to be explicit.

3. **Fallback Behavior:** If `separate_window: true` is requested but terminal doesn't support it, throw an error with clear message.

4. **Lead Window:** Team lead window is optional and must be explicitly requested via a separate tool call after team creation.

## Open Questions

None - all clarified by user.

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| N/A | - | - |

## Files to Modify

1. `src/utils/terminal-adapter.ts` - Add interface methods
2. `src/adapters/iterm2-adapter.ts` - Implement window support
3. `src/adapters/wezterm-adapter.ts` - Implement window support
4. `src/adapters/terminal-registry.ts` - Add capability detection
5. `src/utils/models.ts` - Update Member and TeamConfig types
6. `src/utils/teams.ts` - Update createTeam signature
7. `extensions/index.ts` - Update spawn_teammate, add spawn_lead_window
8. `README.md` - Document new feature
9. `docs/guide.md` - Add usage examples
10. `docs/reference.md` - Update tool documentation
