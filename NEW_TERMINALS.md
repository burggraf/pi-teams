# WezTerm and Kitty Terminal Support

## Summary

Successfully added support for **WezTerm** and **Kitty** terminal emulators to pi-teams, bringing the total number of supported terminals to **5**:
- tmux (multiplexer)
- Zellij (multiplexer)
- iTerm2 (macOS)
- **WezTerm** (cross-platform) ✨ NEW
- **Kitty** (cross-platform) ✨ NEW

## Implementation Details

### Files Created
1. **`src/adapters/wezterm-adapter.ts`** (89 lines)
   - Implements TerminalAdapter interface for WezTerm
   - Uses `wezterm cli split-pane` for spawning panes
   - Supports auto-layout: first pane splits left (30%), subsequent panes split bottom (50%)
   - Pane ID prefix: `wezterm_%pane_id`

2. **`src/adapters/kitty-adapter.ts`** (97 lines)
   - Implements TerminalAdapter interface for Kitty
   - Uses `kitty @ launch --location` for spawning panes
   - Supports auto-layout: first window splits vertically, subsequent windows split horizontally
   - Pane ID prefix: `kitty_%window_id`
   - Includes spawn context tracking (like iTerm2)

3. **`src/adapters/wezterm-adapter.test.ts`** (157 lines)
   - 17 test cases covering all adapter methods
   - Tests detection, spawning, killing, isAlive, and setTitle

4. **`src/adapters/kitty-adapter.test.ts`** (189 lines)
   - 21 test cases covering all adapter methods
   - Tests detection, spawning, killing, isAlive, setTitle, and context management

### Files Modified
1. **`src/adapters/terminal-registry.ts`**
   - Imported WezTermAdapter and KittyAdapter
   - Added to adapters array with proper priority order
   - Updated documentation

2. **`README.md`**
   - Updated headline to mention WezTerm and Kitty
   - Added "Also works with WezTerm and Kitty" note
   - Added Option 4: WezTerm (installation and usage instructions)
   - Added Option 5: Kitty (installation and usage instructions)

## Detection Priority Order

The registry now detects terminals in this priority order:
1. **tmux** - if `TMUX` env is set
2. **Zellij** - if `ZELLIJ` env is set and not in tmux
3. **iTerm2** - if `TERM_PROGRAM=iTerm.app` and not in tmux/zellij
4. **WezTerm** - if `WEZTERM_PANE` env is set and not in tmux/zellij
5. **Kitty** - if `KITTY_WINDOW_ID` env is set and not in tmux/zellij

## How Easy Was This?

**Extremely easy** thanks to the modular design!

### What We Had to Do:
1. ✅ Create 2 adapter files implementing the same 5-method interface
2. ✅ Create 2 test files
3. ✅ Add 2 import statements to registry
4. ✅ Add 2 adapters to the array
5. ✅ Update README documentation

### What We Didn't Need to Change:
- ❌ No changes to the core teams logic
- ❌ No changes to messaging system
- ❌ No changes to task management
- ❌ No changes to the spawn_teammate tool
- ❌ No changes to any other adapter

### Code Statistics:
- **New lines of code**: ~530 lines (adapters + tests)
- **Modified lines**: ~20 lines (registry + README)
- **Files added**: 4
- **Files modified**: 2
- **Time to implement**: ~30 minutes

## Test Results

All tests passing:
```
✓ src/adapters/kitty-adapter.test.ts (21 tests)
✓ src/adapters/wezterm-adapter.test.ts (17 tests)
✓ All existing tests (still passing)
```

Total: **67 tests passing**, 0 failures

## Key Features

### WezTerm Adapter
- ✅ CLI-based pane management (`wezterm cli split-pane`)
- ✅ Auto-layout: left split for first pane (30%), bottom splits for subsequent (50%)
- ✅ Environment variable filtering (only `PI_*` prefixed)
- ✅ Graceful error handling
- ✅ Pane killing via Ctrl-C
- ✅ Tab title setting

### Kitty Adapter
- ✅ Remote control API (`kitty @ launch`)
- ✅ Auto-layout: vertical split for first, horizontal for subsequent
- ✅ Window title setting via `--title`
- ✅ Spawn context tracking (for layout state)
- ✅ Window killing by ID
- ✅ Window existence checking via `kitty @ ls`

## Cross-Platform Benefits

Both WezTerm and Kitty are cross-platform:

**WezTerm:**
- macOS ✅
- Linux ✅
- Windows ✅

**Kitty:**
- macOS ✅
- Linux ✅
- Windows (via WSL) ✅

This means pi-teams now works out-of-the-box on **more platforms** without requiring multiplexers like tmux or Zellij.

## Conclusion

Your modular design with the TerminalAdapter interface made adding support for WezTerm and Kitty incredibly straightforward. The pattern of:

1. Implement `detect()`, `spawn()`, `kill()`, `isAlive()`, `setTitle()`
2. Add to registry
3. Write tests

...is clean, maintainable, and scalable. Adding future terminal support will be just as easy!
