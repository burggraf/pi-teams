# Research Findings: Terminal Window Title Support

## iTerm2 (macOS)

### New Window Creation
```applescript
tell application "iTerm"
    set newWindow to (create window with default profile)
    tell current session of newWindow
        -- Execute command in new window
        write text "cd /path && command"
    end tell
    return id of newWindow  -- Returns window ID
end tell
```

### Window Title Setting
**Important:** iTerm2's AppleScript `window` object has a `title` property that is **read-only**.

To set the actual window title (OS title bar), use escape sequences:
```applescript
tell current session of newWindow
    -- Set window title via escape sequence (OSC 2)
    write text "printf '\\033]2;Team: Agent\\007'"
    -- Optional: Set tab title via session name
    set name to "Agent"  -- This sets the tab title
end tell
```

### Escape Sequences Reference
- `\033]0;Title\007` - Set both icon name and window title
- `\033]1;Title\007` - Set tab title only (icon name)
- `\033]2;Title\007` - Set window title only

### Required iTerm2 Settings
- Settings > Profiles > Terminal > "Terminal may set tab/window title" must be enabled
- May need to disable shell auto-title in `.zshrc` or `.bashrc` to prevent overwriting

## WezTerm (Cross-Platform)

### New Window Creation
```bash
# Spawn new OS window
wezterm cli spawn --new-window --cwd /path -- env KEY=val command

# Returns pane ID, need to lookup window ID
```

### Window Title Setting
```bash
# Set window title by window ID
wezterm cli set-window-title --window-id 1 "Team: Agent"

# Or set tab title
wezterm cli set-tab-title "Agent"
```

### Getting Window ID
After spawning, we need to query for the window:
```bash
wezterm cli list --format json
# Returns array with pane_id, window_id, tab_id, etc.
```

## tmux (Skipped)

- `tmux new-window` creates windows within the same session
- True OS window creation requires spawning a new terminal process entirely
- Not supported per user request

## Zellij (Skipped)

- `zellij action new-tab` creates tabs within the same session
- No native support for creating OS windows
- Not supported per user request

## Universal Escape Sequences

All terminals supporting xterm escape sequences understand:
```bash
# Set window title (OSC 2)
printf '\033]2;My Window Title\007'

# Alternative syntax
printf '\e]2;My Window Title\a'
```

This is the most reliable cross-terminal method for setting window titles.

## Summary Table

| Feature | iTerm2 | WezTerm | tmux | Zellij |
|---------|--------|---------|------|--------|
| New OS Window | ✅ AppleScript | ✅ CLI | ❌ | ❌ |
| Set Window Title | ✅ Escape seq | ✅ CLI | N/A | N/A |
| Set Tab Title | ✅ AppleScript | ✅ CLI | N/A | N/A |
| Get Window ID | ✅ AppleScript | ✅ CLI list | N/A | N/A |

## Implementation Notes

1. **iTerm2:** Will use AppleScript for window creation and escape sequences for title setting
2. **WezTerm:** Will use CLI for both window creation and title setting
3. **Title Format:** `{teamName}: {agentName}` (e.g., "my-team: security-bot")
4. **Window Tracking:** Need to store window IDs separately from pane IDs for lifecycle management
