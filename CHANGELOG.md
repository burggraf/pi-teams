# Changelog

All notable changes to this project will be documented in this file.

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