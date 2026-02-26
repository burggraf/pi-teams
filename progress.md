# Progress Log: Separate Windows Mode Implementation

## 2026-02-26

### Completed
- [x] Researched terminal window title support for iTerm2, WezTerm, tmux, Zellij
- [x] Clarified requirements with user:
  - True separate OS windows (not panes/tabs)
  - Team lead also gets separate window
  - Title format: `team-name: agent-name`
  - iTerm2: use window title property via escape sequences
  - Implementation: optional flag + global setting
  - Skip tmux and Zellij for now
- [x] Created comprehensive task_plan.md with 10 phases
- [x] Created findings.md with technical research details

### Next Steps
1. ✅ Phase 1: Update Terminal Adapter Interface - COMPLETE
2. ✅ Phase 2: iTerm2 Window Support - COMPLETE
3. ✅ Phase 3: WezTerm Window Support - COMPLETE
4. ✅ Phase 4: Terminal Registry - COMPLETE
5. ✅ Phase 5: Team Configuration - COMPLETE
6. ✅ Phase 6: spawn_teammate Tool - COMPLETE
7. ✅ Phase 7: spawn_lead_window Tool - COMPLETE
8. ✅ Phase 8: Lifecycle Management (killTeammate, check_teammate updated) - COMPLETE
9. ✅ Phase 9: Testing - COMPLETE (all 8 tests pass, TypeScript compiles)
10. Phase 10: Documentation

### Blockers
None

### Decisions Made
- Use escape sequences (`\033]2;Title\007`) for iTerm2 window titles since AppleScript window.title is read-only
- Add new `windowId` field to Member model instead of reusing `tmuxPaneId`
- Store `separateWindows` global setting in TeamConfig
- Skip tmux/Zellij entirely (no fallback attempted)
