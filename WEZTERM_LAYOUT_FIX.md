# WezTerm Panel Layout Fix

## Problem
WezTerm was not creating the correct panel layout for pi-teams. The desired layout is:
- **Main controller panel** on the LEFT (takes 70% width)
- **Teammate panels** stacked on the RIGHT (takes 30% width, divided vertically)

This matches the layout behavior in tmux and iTerm2.

## Root Cause
The WezTermAdapter was sequentially spawning panes without tracking which pane should be the "right sidebar." When using `split-pane --bottom`, it would split the currently active pane (which could be any teammate pane), rather than always splitting within the designated right sidebar area.

## Solution
Modified `src/adapters/wezterm-adapter.ts`:

1. **Added sidebar tracking**: Store the pane ID of the first teammate spawn (`sidebarPaneId`)
   
2. **Fixed split logic**:
   - **First teammate** (paneCounter=0): Split RIGHT with 30% width (leaves 70% for main)
   - **Subsequent teammates**: Split the saved sidebar pane BOTTOM with 50% height
   
3. **Used `--pane-id` parameter**: WezTerm CLI's `--pane-id` ensures we always split within the right sidebar, not whichever pane is currently active

## Code Changes

```typescript
private sidebarPaneId: string | null = null; // Track the right sidebar pane

spawn(options: SpawnOptions): string {
  // First pane: split RIGHT (creates right sidebar)
  // Subsequent panes: split BOTTOM within the sidebar pane
  const isFirstPane = this.paneCounter === 0;
  const weztermArgs = [
    "cli",
    "split-pane",
    isFirstPane ? "--right" : "--bottom",
    "--percent", isFirstPane ? "30" : "50",
    ...(isFirstPane ? [] : ["--pane-id", this.sidebarPaneId!]), // Key: always split in sidebar
    "--cwd", options.cwd,
    // ... rest of args
  ];
  
  // ... execute command ...
  
  // Track sidebar pane on first spawn
  if (isFirstPane) {
    this.sidebarPaneId = paneId;
  }
}
```

## Result
✅ Main controller stays on the left at full height
✅ Teammates stack vertically on the right at equal heights
✅ Matches tmux/iTerm2 layout behavior
✅ All existing tests pass

## Testing
```bash
npm test -- src/adapters/wezterm-adapter.test.ts
# ✓ 17 tests passed
```
