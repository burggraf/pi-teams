# Changelog

All notable changes to this project will be documented in this file.

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