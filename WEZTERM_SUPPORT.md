# WezTerm Terminal Support

## Summary

Successfully added support for **WezTerm** terminal emulator to pi-teams, bringing the total number of supported terminals to **4**:
- tmux (multiplexer)
- Zellij (multiplexer)
- iTerm2 (macOS)
- **WezTerm** (cross-platform) ✨ NEW

## Implementation Details

### Files Created
1. **`src/adapters/wezterm-adapter.ts`** (89 lines)
   - Implements TerminalAdapter interface for WezTerm
   - Uses `wezterm cli split-pane` for spawning panes
   - Supports auto-layout: first pane splits left (30%), subsequent panes split bottom (50%)
   - Pane ID prefix: `wezterm_%pane_id`

2. **`src/adapters/wezterm-adapter.test.ts`** (157 lines)
   - 17 test cases covering all adapter methods
   - Tests detection, spawning, killing, isAlive, and setTitle

### Files Modified
1. **`src/adapters/terminal-registry.ts`**
   - Imported WezTermAdapter
   - Added to adapters array with proper priority order
   - Updated documentation

2. **`README.md`**
   - Updated headline to mention WezTerm
   - Added "Also works with WezTerm" note
   - Added Option 4: WezTerm (installation and usage instructions)

## Detection Priority Order

The registry now detects terminals in this priority order:
1. **tmux** - if `TMUX` env is set
2. **Zellij** - if `ZELLIJ` env is set and not in tmux
3. **iTerm2** - if `TERM_PROGRAM=iTerm.app` and not in tmux/zellij
4. **WezTerm** - if `WEZTERM_PANE` env is set and not in tmux/zellij

## How Easy Was This?

**Extremely easy** thanks to the modular design!

### What We Had to Do:
1. ✅ Create adapter file implementing the same 5-method interface
2. ✅ Create test file
3. ✅ Add import statement to registry
4. ✅ Add adapter to the array
5. ✅ Update README documentation

### What We Didn't Need to Change:
- ❌ No changes to the core teams logic
- ❌ No changes to messaging system
- ❌ No changes to task management
- ❌ No changes to the spawn_teammate tool
- ❌ No changes to any other adapter

### Code Statistics:
- **New lines of code**: ~246 lines (adapter + tests)
- **Modified lines**: ~20 lines (registry + README)
- **Files added**: 2
- **Files modified**: 2
- **Time to implement**: ~20 minutes

## Test Results

All tests passing:
```
✓ src/adapters/wezterm-adapter.test.ts (17 tests)
✓ All existing tests (still passing)
```

Total: **46 tests passing**, 0 failures

## Key Features

### WezTerm Adapter
- ✅ CLI-based pane management (`wezterm cli split-pane`)
- ✅ Auto-layout: left split for first pane (30%), bottom splits for subsequent (50%)
- ✅ Environment variable filtering (only `PI_*` prefixed)
- ✅ Graceful error handling
- ✅ Pane killing via Ctrl-C
- ✅ Tab title setting

## Cross-Platform Benefits

WezTerm is cross-platform:
- macOS ✅
- Linux ✅
- Windows ✅

This means pi-teams now works out-of-the-box on **more platforms** without requiring multiplexers like tmux or Zellij.

## Conclusion

The modular design with the TerminalAdapter interface made adding support for WezTerm incredibly straightforward. The pattern of:

1. Implement `detect()`, `spawn()`, `kill()`, `isAlive()`, `setTitle()`
2. Add to registry
3. Write tests

...is clean, maintainable, and scalable. Adding future terminal support will be just as easy!
