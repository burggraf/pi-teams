# Changelog

All notable changes to this project will be documented in this file.

## [0.9.12] - 2025-03-20

### Fixed
- **Improved shim-based install support**: Enhanced `getPiLaunchCommand()` to better handle Volta and other shim-based toolchains (#13)
  - Detects script files by extension (.js, .mjs, .cjs, .ts, .mts, .cts) and path pattern
  - Explicitly excludes `node` and `bun` from execPath fallback
  - Falls back to `pi` from PATH for shim-based installs, which is more reliable
  - Thanks to the contributor for the comprehensive fix

## [0.9.11] - 2025-03-20

### Fixed
- **Regression fix for Node-based installs**: Fixed a regression introduced in v0.9.9 that broke regular Node-based pi installs (#10)
  - Previous fix prioritized `process.execPath` which points to the Node interpreter, not the pi script
  - Now checks if `argv[1]` is a real "pi" file on disk before falling back to `execPath`
  - Correctly handles both Bun-compiled binaries and regular Node installs
  - Thanks to @jacek-schefler for reporting and providing the fix

## [0.9.10] - 2025-03-20

### Fixed
- **Windows PowerShell compatibility**: Added fallback to Windows PowerShell 5.1 (`powershell`) when PowerShell Core (`pwsh`) is not available (#12)
  - Windows adapter now auto-detects available PowerShell at runtime
  - Prefers PowerShell Core (pwsh) if installed, falls back to built-in Windows PowerShell
  - Users without PowerShell Core installed can now use pi-teams on Windows

## [0.9.9] - 2025-03-19

### Fixed
- **Bun-compiled binary support**: Fixed spawning teammates when pi is compiled as a Bun binary (#10)
  - Added `getPiLaunchCommand()` helper to detect and handle Bun-compiled binaries
  - Bun binaries have `process.argv[1]` pointing to virtual `/$bunfs/root/pi` path
  - Now uses `process.execPath` which works for both compiled binaries and regular Node environments
  - Fixes "node /$bunfs/root/pi" error when spawning teammates in compiled mode

## [0.9.8] - 2025-03-17

### Added
- **Save Teams as Templates**: Convert runtime teams into reusable predefined team templates (#7)
  - New `save_team_as_template` tool to save any runtime team as a template
  - New `list_runtime_teams` tool to see available teams that can be saved
  - Creates agent definition files (`.md`) with frontmatter for each teammate
  - Updates `teams.yaml` with the new template entry
  - Supports both `user` (global) and `project` (local) scope
  - Enables the workflow: Create → Use → Save → Reuse

### Changed
- Updated README with comprehensive documentation for the save-to-template workflow
- Added helper functions to `predefined-teams.ts`: `saveTeamTemplate`, `generateAgentMarkdown`, `generateTeamsYamlWithTemplate`, `listRuntimeTeams`

## [0.9.7] - 2025-03-17

### Added
- **Automatic cleanup of orphaned agent session folders** (#cleanup)
  - New `cleanupAgentSessionFolders()` utility function to remove stale `~/.pi/agent/teams/` entries
  - `team_shutdown` now automatically cleans up agent sessions older than 1 hour
  - New `cleanup_agent_sessions` tool for manual cleanup with configurable max age
  - Prevents accumulation of orphaned agent session folders (186+ folders were found in some environments)

### Changed
- `team_shutdown` now reports the number of cleaned agent session folders in its output

## [0.9.6] - 2025-03-17

### Added
- **Predefined Teams**: Define reusable team templates in `teams.yaml` files (#6)
  - Create `~/.pi/teams.yaml` (global) or `.pi/teams.yaml` (project-local) to define team presets
  - Define agent configurations in `~/.pi/agent/agents/` or `.pi/agents/` with frontmatter
  - New tools: `list_predefined_teams`, `list_predefined_agents`, `create_predefined_team`
  - Agent definitions support: name, description, tools, model, thinking, and custom prompt
  - Project-local definitions override global definitions

### Changed
- Improved agent discovery with support for both `.md` files and `SKILL.md` in subdirectories

## [0.9.5] - 2026-03-17

### Fixed
- `spawn_teammate` now kills existing teammate with same name before spawning (#1)
- Handles the case where user aborts mid-execution, changes model, and continues
- Prevents duplicate teammate entries and broken communication after model switch

## [0.9.4] - 2026-03-17

### Fixed
- Auto-cleanup of stale teams when `team_create` is called with an existing team name (#1)
- Old teammate panes/windows are now properly killed before creating a new team

### Added
- `isPidAlive()` utility to check if a process is still running
- `cleanupStaleTeam()` function to clean up dead team state (kills panes, removes files)
- Automatic detection of stale lead sessions via PID checking

## [0.9.3] - 2026-03-17

### Fixed
- Team leads now automatically subscribe to their inbox and poll for messages (#9)
- Leads no longer need to call `spawn_lead_window` just to receive messages from teammates
- Lead session is registered via PID tracking when `team_create` is called

### Changed
- Inbox polling now runs for both team leads and teammates (any agent with team context)
- Added `findLeadTeamForSession()` to detect lead membership without environment variables
- Added `registerLeadSession()` to track which session is the lead for a team
- Added `leadSessionPath()` to paths module for lead session file location

## [0.9.2] - 2026-03-17

### Fixed
- CmuxAdapter is now properly registered in the terminal registry (#8)
- CmuxAdapter detection now defensively checks for tmux/Zellij to avoid false positives in nested environments

### Added
- Comprehensive test suite for CmuxAdapter (25 tests covering all adapter methods)

## [0.9.1] - 2026-03-17

### Fixed
- Tmux teammate spawning now correctly targets the originating pane/window
- Prevents teammates from appearing in wrong tmux window when client context changes
- Layout commands (`set-window-option`, `select-layout`) now target the correct window
- `setTitle()` now explicitly targets the current pane

### Added
- `anchorPaneId` option to `SpawnOptions` for explicit pane targeting
- Tests for `TmuxAdapter` with pane targeting scenarios

## [0.9.0] - 2026-03-17

### Added
- Runtime status telemetry for teammate health checks
- New `runtime.ts` utility module for tracking agent status
- Heartbeat mechanism for teammate monitoring with configurable stale timeout
- Tests for runtime utilities (`runtime.test.ts`)

### Changed
- Improved teammate bootstrap process with better health check reliability
- Enhanced teammate readiness tracking during startup

## [0.8.7] - 2026-02-27

### Changed
- Bug fixes and stability improvements

## [0.8.6] - 2026-02-27

### Added
- Smart model resolution with OAuth provider priority

### Changed
- Implemented separate OS windows mode with persistent titles for iTerm2

## [0.8.0] - 2026-02-27

### Added
- WezTerm terminal support
- CMUX terminal adapter with split-pane support

### Changed
- Refactored terminal support to modular adapter pattern
- Removed Kitty terminal support