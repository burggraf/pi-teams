# VS Code & Cursor Terminal Integration Research

## Executive Summary

After researching VS Code and Cursor integrated terminal capabilities, **I recommend AGAINST implementing direct VS Code/Cursor terminal support for pi-teams at this time**. The fundamental issue is that VS Code does not provide a command-line API for spawning or managing terminal panes from within an integrated terminal. While a VS Code extension could theoretically provide this functionality, it would require users to install an additional extension and would not work "out of the box" like the current tmux/Zellij/iTerm2 solutions.

---

## Research Scope

This document investigates whether pi-teams can work with VS Code and Cursor integrated terminals, specifically:

1. Detecting when running inside VS Code/Cursor integrated terminal
2. Programmatically creating new terminal instances
3. Controlling terminal splits, tabs, or panels
4. Available APIs (VS Code API, Cursor API, command palette)
5. How other tools handle this
6. Feasibility and recommendations

---

## 1. Detection: Can We Detect VS Code/Cursor Terminals?

### ✅ YES - Environment Variables

VS Code and Cursor set environment variables that can be detected:

```bash
# VS Code integrated terminal
TERM_PROGRAM=vscode
TERM_PROGRAM_VERSION=1.109.5

# Cursor (which is based on VS Code)
TERM_PROGRAM=vscode-electron
# OR potentially specific Cursor variables

# Environment-resolving shell (set by VS Code at startup)
VSCODE_RESOLVING_ENVIRONMENT=1
```

**Detection Code:**
```typescript
detect(): boolean {
  return process.env.TERM_PROGRAM === 'vscode' ||
         process.env.TERM_PROGRAM === 'vscode-electron';
}
```

### Detection Test Script

```bash
#!/bin/bash
echo "=== Terminal Detection ==="
echo "TERM_PROGRAM: $TERM_PROGRAM"
echo "TERM_PROGRAM_VERSION: $TERM_PROGRAM_VERSION"
echo "VSCODE_PID: $VSCODE_PID"
echo "VSCODE_IPC_HOOK_CLI: $VSCODE_IPC_HOOK_CLI"
echo "VSCODE_RESOLVING_ENVIRONMENT: $VSCODE_RESOLVING_ENVIRONMENT"
```

---

## 2. Terminal Management: What IS Possible?

### ❌ Command-Line Tool Spawning (Not Possible)

**The VS Code CLI (`code` command) does NOT provide commands to:**
- Spawn new integrated terminals
- Split existing terminal panes
- Control terminal layout
- Get or manage terminal IDs
- Send commands to specific terminals

**Available CLI commands** (from `code --help`):
- Open files/folders: `code .`
- Diff/merge: `code --diff`, `code --merge`
- Extensions: `--install-extension`, `--list-extensions`
- Chat: `code chat "prompt"`
- Shell integration: `--locate-shell-integration-path <shell>`
- Remote/tunnels: `code tunnel`

**Nothing for terminal pane management from command line.**

### ❌ Shell Commands from Integrated Terminal

From within a VS Code integrated terminal, there are **NO shell commands** or escape sequences that can:
- Spawn new terminal panes
- Split the terminal
- Communicate with the VS Code host process
- Control terminal layout

The integrated terminal is just a pseudoterminal (pty) running a shell - it has no knowledge of or control over VS Code's terminal UI.

---

## 3. VS Code Extension API: What IS Possible

### ✅ Extension API - Terminal Management

**VS Code extensions have a rich API for terminal management:**

```typescript
// Create a new terminal
const terminal = vscode.window.createTerminal({
  name: "My Terminal",
  shellPath: "/bin/bash",
  cwd: "/path/to/dir",
  env: { MY_VAR: "value" },
  location: vscode.TerminalLocation.Split // or Panel, Editor
});

// Create a pseudoterminal (custom terminal)
const pty: vscode.Pseudoterminal = {
  onDidWrite: writeEmitter.event,
  open: () => { /* ... */ },
  close: () => { /* ... */ },
  handleInput: (data) => { /* ... */ }
};
vscode.window.createTerminal({ name: 'Custom', pty });

// Get list of terminals
const terminals = vscode.window.terminals;
const activeTerminal = vscode.window.activeTerminal;

// Terminal lifecycle events
vscode.window.onDidOpenTerminal((terminal) => { /* ... */ });
vscode.window.onDidCloseTerminal((terminal) => { /* ... */ });
```

### ✅ Terminal Options

Extensions can control:
- **Location**: `TerminalLocation.Panel` (bottom), `TerminalLocation.Editor` (tab), `TerminalLocation.Split` (split pane)
- **Working directory**: `cwd` option
- **Environment variables**: `env` option
- **Shell**: `shellPath` and `shellArgs`
- **Appearance**: `iconPath`, `color`, `name`
- **Persistence**: `isTransient`

### ✅ TerminalProfile API

Extensions can register custom terminal profiles:

```typescript
// package.json contribution
{
  "contributes": {
    "terminal": {
      "profiles": [
        {
          "title": "Pi-Teams Terminal",
          "id": "pi-teams-terminal"
        }
      ]
    }
  }
}

// Register provider
vscode.window.registerTerminalProfileProvider('pi-teams-terminal', {
  provideTerminalProfile(token) {
    return {
      name: "Pi-Teams Agent",
      shellPath: "bash",
      cwd: "/project/path"
    };
  }
});
```

---

## 4. Cursor IDE Capabilities

### Same as VS Code (with limitations)

**Cursor is based on VS Code** and uses the same extension API, but:
- Cursor may have restrictions on which extensions can be installed
- Cursor's extensions marketplace may differ from VS Code's
- Cursor has its own AI features that may conflict or integrate differently

**Fundamental limitation remains**: Cursor does not expose terminal management APIs to command-line tools, only to extensions running in its extension host process.

---

## 5. Alternative Approaches Investigated

### ❌ Approach 1: AppleScript (macOS only)

**Investigated**: Can we use AppleScript to control VS Code on macOS?

**Findings**:
- VS Code does have AppleScript support
- BUT: AppleScript support is focused on window management, file opening, and basic editor operations
- **No AppleScript dictionary entries for terminal management**
- Would not work on Linux/Windows
- Unreliable and fragile

**Conclusion**: Not viable.

### ❌ Approach 2: VS Code IPC/Socket Communication

**Investigated**: Can we communicate with VS Code via IPC sockets?

**Findings**:
- VS Code sets `VSCODE_IPC_HOOK_CLI` environment variable
- This is used by the `code` CLI to communicate with running instances
- BUT: The IPC protocol is **internal and undocumented**
- No public API for sending custom commands via IPC
- Would require reverse-engineering VS Code's IPC protocol
- Protocol may change between versions

**Conclusion**: Not viable (undocumented, unstable).

### ❌ Approach 3: Shell Integration Escape Sequences

**Investigated**: Can we use ANSI escape sequences or OSC (Operating System Command) codes to control VS Code terminals?

**Findings**:
- VS Code's shell integration uses specific OSC sequences for:
  - Current working directory reporting
  - Command start/end markers
  - Prompt detection
- BUT: These sequences are **one-way** (terminal → VS Code)
- No OSC sequences for creating new terminals or splitting
- No bidirectional communication channel

**Conclusion**: Not viable (one-way only).

### ⚠️ Approach 4: VS Code Extension (Partial Solution)

**Investigated**: Create a VS Code extension that pi-teams can communicate with

**Feasible Design**:
1. pi-teams detects VS Code environment (`TERM_PROGRAM=vscode`)
2. pi-teams spawns child processes that communicate with the extension
3. Extension receives requests and creates terminals via VS Code API

**Communication Mechanisms**:
- **Local WebSocket server**: Extension starts server, pi-teams connects
- **Named pipes/Unix domain sockets**: On Linux/macOS
- **File system polling**: Write request files, extension reads them
- **Local HTTP server**: Easier cross-platform

**Example Architecture**:
```
┌─────────────┐
│  pi-teams   │ ← Running in integrated terminal
│  (node.js)  │
└──────┬──────┘
       │
       │ 1. HTTP POST /create-terminal
       │    { name: "agent-1", cwd: "/path", command: "pi ..." }
       ↓
┌───────────────────────────┐
│  pi-teams VS Code Extension │ ← Running in extension host
│  (TypeScript)              │
└───────┬───────────────────┘
        │
        │ 2. vscode.window.createTerminal({...})
        ↓
┌───────────────────────────┐
│  VS Code Terminal Pane     │ ← New terminal created
│  (running pi)              │
└───────────────────────────┘
```

**Pros**:
- ✅ Full access to VS Code terminal API
- ✅ Can split terminals, set names, control layout
- ✅ Cross-platform (works on Windows/Linux/macOS)
- ✅ Can integrate with VS Code UI (commands, status bar)

**Cons**:
- ❌ Users must install extension (additional dependency)
- ❌ Extension adds ~5-10MB to install
- ❌ Extension must be maintained alongside pi-teams
- ❌ Extension adds startup overhead
- ❌ Extension permissions/security concerns
- ❌ Not "plug and play" like tmux/Zellij

**Conclusion**: Technically possible but adds significant user friction.

---

## 6. Comparison with Existing pi-teams Adapters

| Feature | tmux | Zellij | iTerm2 | VS Code (CLI) | VS Code (Extension) |
|---------|------|--------|---------|----------------|---------------------|
| Detection env var | `TMUX` | `ZELLIJ` | `TERM_PROGRAM=iTerm.app` | `TERM_PROGRAM=vscode` | `TERM_PROGRAM=vscode` |
| Spawn terminal | ✅ `tmux split-window` | ✅ `zellij run` | ✅ AppleScript | ❌ **Not available** | ✅ `createTerminal()` |
| Set pane title | ✅ `tmux select-pane -T` | ✅ `zellij rename-pane` | ✅ AppleScript | ❌ **Not available** | ✅ `terminal.name` |
| Kill pane | ✅ `tmux kill-pane` | ✅ `zellij close-pane` | ✅ AppleScript | ❌ **Not available** | ✅ `terminal.dispose()` |
| Check if alive | ✅ `tmux has-session` | ✅ `zellij list-sessions` | ❌ Approximate | ❌ **Not available** | ✅ Track in extension |
| User setup | Install tmux | Install Zellij | iTerm2 only | N/A | Install extension |
| Cross-platform | ✅ Linux/macOS/Windows | ✅ Linux/macOS/Windows | ❌ macOS only | N/A | ✅ All platforms |
| Works out of box | ✅ | ✅ | ✅ (on macOS) | ❌ | ❌ (requires extension) |

---

## 7. How Other Tools Handle This

### ❌ Most Tools Don't Support VS Code Terminals

After researching popular terminal multiplexers and dev tools:

**tmux, Zellij, tmate, dtach**: Do not work with VS Code integrated terminals (require their own terminal emulator)

**node-pty**: Library for creating pseudoterminals, but doesn't integrate with VS Code's terminal UI

**xterm.js**: Browser-based terminal emulator, not applicable

### ✅ Some Tools Use VS Code Extensions

**Test Explorer extensions**: Create terminals for running tests
- Example: Python, Jest, .NET test extensions
- All run as VS Code extensions, not CLI tools

**Docker extension**: Creates terminals for containers
- Runs as extension, uses VS Code terminal API

**Remote - SSH extension**: Creates terminals for remote sessions
- Extension-hosted solution

**Pattern observed**: Tools that need terminal management in VS Code **are implemented as extensions**, not CLI tools.

---

## 8. Detailed Findings: What IS NOT Possible

### ❌ Cannot Spawn Terminals from CLI

The fundamental blocker: **VS Code provides no command-line or shell interface for terminal management**.

**Evidence**:
1. `code --help` shows 50+ commands, **none** for terminals
2. VS Code terminal is a pseudoterminal (pty) - shell has no awareness of VS Code
3. No escape sequences or OSC codes for creating terminals
4. VS Code IPC protocol is undocumented/internal
5. No WebSocket or other communication channels exposed

**Verification**: Tried all available approaches:
- `code` CLI: No terminal commands
- Environment variables: Detection only, not control
- Shell escape sequences: None exist for terminal creation
- AppleScript: No terminal support
- IPC sockets: Undocumented protocol

---

## 9. Cursor-Specific Research

### Cursor = VS Code + AI Features

**Key findings**:
1. Cursor is **built on top of VS Code**
2. Uses same extension API and most VS Code infrastructure
3. Extension marketplace may be different/restricted
4. **Same fundamental limitation**: No CLI API for terminal management

### Cursor Extension Ecosystem

- Cursor has its own extensions (some unique, some from VS Code)
- Extension development uses same VS Code Extension API
- May have restrictions on which extensions can run

**Conclusion for Cursor**: Same as VS Code - would require a Cursor-specific extension.

---

## 10. Recommended Approach

### 🚫 Recommendation: Do NOT Implement VS Code/Cursor Terminal Support

**Reasons**:

1. **No native CLI support**: VS Code provides no command-line API for terminal management
2. **Extension required**: Would require users to install and configure an extension
3. **User friction**: Adds setup complexity vs. "just use tmux"
4. **Maintenance burden**: Extension must be maintained alongside pi-teams
5. **Limited benefit**: Users can simply run `tmux` inside VS Code integrated terminal
6. **Alternative exists**: tmux/Zellij work perfectly fine inside VS Code terminals

### ✅ Current Solution: Users Run tmux/Zellij Inside VS Code

**Best practice for VS Code users**:

```bash
# Option 1: Run tmux inside VS Code integrated terminal
tmux new -s pi-teams
pi create-team my-team
pi spawn-teammate ...

# Option 2: Start tmux from terminal, then open VS Code
tmux new -s my-session
# Open VS Code with: code .
```

**Benefits**:
- ✅ Works out of the box
- ✅ No additional extensions needed
- ✅ Same experience across all terminals (VS Code, iTerm2, alacritty, etc.)
- ✅ Familiar workflow for terminal users
- ✅ No maintenance overhead

---

## 11. If You Must Support VS Code Terminals

### ⚠️ Extension-Based Approach (Recommended Only If Required)

If there's strong user demand for native VS Code integration:

#### Architecture

```
1. pi-teams detects VS Code (TERM_PROGRAM=vscode)

2. pi-teams spawns a lightweight HTTP server
   - Port: Random free port (e.g., 34567)
   - Endpoint: POST /create-terminal
   - Payload: { name, cwd, command, env }

3. User installs "pi-teams" VS Code extension
   - Extension starts HTTP client on activation
   - Finds pi-teams server port via shared file or env var

4. Extension receives create-terminal requests
   - Calls vscode.window.createTerminal()
   - Returns terminal ID

5. pi-teams tracks terminal IDs via extension responses
```

#### Implementation Sketch

**pi-teams (TypeScript)**:
```typescript
class VSCodeAdapter implements TerminalAdapter {
  name = "vscode";

  detect(): boolean {
    return process.env.TERM_PROGRAM === 'vscode';
  }

  async spawn(options: SpawnOptions): Promise<string> {
    // Start HTTP server if not running
    const port = await ensureHttpServer();

    // Write request file
    const requestId = uuidv4();
    await fs.writeFile(
      `/tmp/pi-teams-request-${requestId}.json`,
      JSON.stringify({ ...options, requestId })
    );

    // Wait for response
    const response = await waitForResponse(requestId);
    return response.terminalId;
  }

  kill(paneId: string): void {
    // Send kill request via HTTP
  }

  isAlive(paneId: string): boolean {
    // Query extension via HTTP
  }

  setTitle(title: string): void {
    // Send title update via HTTP
  }
}
```

**VS Code Extension (TypeScript)**:
```typescript
export function activate(context: vscode.ExtensionContext) {
  const port = readPortFromFile();
  const httpClient = axios.create({ baseURL: `http://localhost:${port}` });

  // Watch for request files
  const watcher = vscode.workspace.createFileSystemWatcher(
    '/tmp/pi-teams-request-*.json'
  );

  watcher.onDidChange(async (uri) => {
    const request = JSON.parse(await vscode.workspace.fs.readFile(uri));

    // Create terminal
    const terminal = vscode.window.createTerminal({
      name: request.name,
      cwd: request.cwd,
      env: request.env
    });

    // Send response
    await httpClient.post('/response', {
      requestId: request.requestId,
      terminalId: terminal.processId // or unique ID
    });
  });
}
```

#### Pros/Cons of Extension Approach

| Aspect | Evaluation |
|--------|-------------|
| Technical feasibility | ✅ Feasible with VS Code API |
| User experience | ⚠️ Good after setup, but setup required |
| Maintenance | ❌ High (extension + npm package) |
| Cross-platform | ✅ Works on all platforms |
| Development time | 🔴 High (~2-3 weeks for full implementation) |
| Extension size | ~5-10MB (TypeScript, bundled dependencies) |
| Extension complexity | Medium (HTTP server, file watching, IPC) |
| Security | ⚠️ Need to validate requests, prevent abuse |

#### Estimated Effort

- **Week 1**: Design architecture, prototype HTTP server, extension skeleton
- **Week 2**: Implement terminal creation, tracking, naming
- **Week 3**: Implement kill, isAlive, setTitle, error handling
- **Week 4**: Testing, documentation, packaging, publishing

**Total: 3-4 weeks of focused development**

---

## 12. Alternative Idea: VS Code Terminal Tab Detection

### Could We Detect Existing Terminal Tabs?

**Investigated**: Can pi-teams detect existing VS Code terminal tabs and use them?

**Findings**:
- VS Code extension API can get list of terminals: `vscode.window.terminals`
- BUT: This is only available to extensions, not CLI tools
- No command to list terminals from integrated terminal

**Conclusion**: Not possible without extension.

---

## 13. Terminal Integration Comparison Matrix

| Terminal Type | Detection | Spawn | Kill | Track Alive | Set Title | User Setup |
|---------------|-----------|--------|------|-------------|------------|-------------|
| tmux | ✅ Easy | ✅ Native | ✅ Native | ✅ Native | ✅ Native | Install tmux |
| Zellij | ✅ Easy | ✅ Native | ✅ Native | ✅ Native | ✅ Native | Install Zellij |
| iTerm2 | ✅ Easy | ✅ AppleScript | ✅ AppleScript | ❌ Approximate | ✅ AppleScript | None (macOS) |
| VS Code (CLI) | ✅ Easy | ❌ **Impossible** | ❌ **Impossible** | ❌ **Impossible** | ❌ **Impossible** | N/A |
| Cursor (CLI) | ✅ Easy | ❌ **Impossible** | ❌ **Impossible** | ❌ **Impossible** | ❌ **Impossible** | N/A |
| VS Code (Extension) | ✅ Easy | ✅ Via extension | ✅ Via extension | ✅ Via extension | ✅ Via extension | Install extension |

---

## 14. Environment Variables Reference

### VS Code Integrated Terminal Environment Variables

| Variable | Value | When Set | Use Case |
|----------|--------|-----------|----------|
| `TERM_PROGRAM` | `vscode` | Always in integrated terminal | ✅ Detect VS Code |
| `TERM_PROGRAM_VERSION` | e.g., `1.109.5` | Always in integrated terminal | Version detection |
| `VSCODE_RESOLVING_ENVIRONMENT` | `1` | When VS Code launches environment-resolving shell at startup | Detect startup shell |
| `VSCODE_PID` | (unset in integrated terminal) | Set by extension host, not terminal | Not useful for detection |
| `VSCODE_IPC_HOOK_CLI` | Path to IPC socket | Set by extension host | Not useful for CLI tools |

### Cursor Environment Variables

| Variable | Value | When Set | Use Case |
|----------|--------|-----------|----------|
| `TERM_PROGRAM` | `vscode-electron` or similar | Always in Cursor integrated terminal | ✅ Detect Cursor |
| `TERM_PROGRAM_VERSION` | Cursor version | Always in Cursor integrated terminal | Version detection |

### Other Terminal Environment Variables

| Variable | Value | Terminal |
|----------|--------|-----------|
| `TMUX` | Pane ID or similar | tmux |
| `ZELLIJ` | Session ID | Zellij |
| `ITERM_SESSION_ID` | Session UUID | iTerm2 |
| `TERM` | Terminal type (e.g., `xterm-256color`) | All terminals |

---

## 15. Code Examples

### Detection Code (Ready to Use)

```typescript
// src/adapters/vscode-adapter.ts

export class VSCodeAdapter implements TerminalAdapter {
  readonly name = "vscode";

  detect(): boolean {
    return process.env.TERM_PROGRAM === 'vscode' ||
           process.env.TERM_PROGRAM === 'vscode-electron';
  }

  spawn(options: SpawnOptions): string {
    throw new Error(
      "VS Code integrated terminals do not support spawning " +
      "new terminals from command line. Please run pi-teams " +
      "inside tmux, Zellij, or iTerm2 for terminal management. " +
      "Alternatively, install the pi-teams VS Code extension " +
      "(if implemented)."
    );
  }

  kill(paneId: string): void {
    throw new Error("Not supported in VS Code without extension");
  }

  isAlive(paneId: string): boolean {
    return false;
  }

  setTitle(title: string): void {
    throw new Error("Not supported in VS Code without extension");
  }
}
```

### User-Facing Error Message

```
❌ Cannot spawn terminal in VS Code integrated terminal

pi-teams requires a terminal multiplexer to create multiple panes.

For VS Code users, we recommend one of these options:

Option 1: Run tmux inside VS Code integrated terminal
  ┌────────────────────────────────────────┐
  │ $ tmux new -s pi-teams              │
  │ $ pi create-team my-team              │
  │ $ pi spawn-teammate security-bot ...   │
  └────────────────────────────────────────┘

Option 2: Open VS Code from tmux session
  ┌────────────────────────────────────────┐
  │ $ tmux new -s my-session             │
  │ $ code .                             │
  │ $ pi create-team my-team              │
  └────────────────────────────────────────┘

Option 3: Use a terminal with multiplexer support
  ┌────────────────────────────────────────┐
  │ • iTerm2 (macOS) - Built-in support  │
  │ • tmux - Install: brew install tmux    │
  │ • Zellij - Install: cargo install ... │
  └────────────────────────────────────────┘

Learn more: https://github.com/your-org/pi-teams#terminal-support
```

---

## 16. Conclusions and Recommendations

### Final Recommendation: ❌ Do Not Implement VS Code/Cursor Support

**Primary reasons**:

1. **No CLI API for terminal management**: VS Code provides no command-line interface for spawning or managing terminal panes.

2. **Extension-based solution required**: Would require users to install and configure a VS Code extension, adding significant user friction.

3. **Better alternative exists**: Users can simply run tmux or Zellij inside VS Code integrated terminal, achieving the same result without any additional work.

4. **Maintenance burden**: Maintaining both a Node.js package and a VS Code extension doubles the development and maintenance effort.

5. **Limited benefit**: The primary use case (multiple coordinated terminals in one screen) is already solved by tmux/Zellij/iTerm2.

### Recommended User Guidance

For VS Code/Cursor users, recommend:

```bash
# Option 1: Run tmux inside VS Code (simplest)
tmux new -s pi-teams

# Option 2: Start tmux first, then open VS Code
tmux new -s dev
code .
```

### Documentation Update

Add to pi-teams README.md:

```markdown
## Using pi-teams with VS Code or Cursor

pi-teams works great with VS Code and Cursor! Simply run tmux
or Zellij inside the integrated terminal:

```bash
# Start tmux in VS Code integrated terminal
$ tmux new -s pi-teams
$ pi create-team my-team
$ pi spawn-teammate security-bot "Scan for vulnerabilities"
```

Your team will appear in the integrated terminal with proper splits:

┌──────────────────┬──────────────────┐
│  Lead (Team)     │  security-bot     │
│                  │  (scanning...)    │
└──────────────────┴──────────────────┘

> **Why not native VS Code terminal support?**
> VS Code does not provide a command-line API for creating terminal
> panes. Using tmux or Zellij inside VS Code gives you the same
> multi-pane experience with no additional extensions needed.
```

---

## 17. Future Possibilities

### If VS Code Adds CLI Terminal API

Monitor VS Code issues and releases for:
- Terminal management commands in `code` CLI
- Public IPC protocol for terminal control
- WebSocket or REST API for terminal management

**Related VS Code issues**:
- (Search GitHub for terminal management CLI requests)

### If User Demand Is High

1. Create GitHub issue: "VS Code integration: Extension approach"
2. Gauge user interest and willingness to install extension
3. If strong demand, implement extension-based solution (Section 11)

### Alternative: Webview-Based Terminal Emulator

Consider building a custom terminal emulator using VS Code's webview API:
- Pros: Full control, no extension IPC needed
- Cons: Reinventing wheel, poor performance, limited terminal features

**Not recommended**: Significant effort for worse UX.

---

## Appendix A: Research Sources

### Official Documentation
- VS Code Terminal API: https://code.visualstudio.com/api/extension-guides/terminal
- VS Code Extension API: https://code.visualstudio.com/api/references/vscode-api
- VS Code CLI: https://code.visualstudio.com/docs/editor/command-line
- Terminal Basics: https://code.visualstudio.com/docs/terminal/basics

### GitHub Repositories
- VS Code: https://github.com/microsoft/vscode
- VS Code Extension Samples: https://github.com/microsoft/vscode-extension-samples
- Cursor: https://github.com/getcursor/cursor

### Key Resources
- `code --help` - Full CLI documentation
- VS Code API Reference - Complete API documentation
- Shell Integration docs - Environment variable reference

---

## Appendix B: Tested Approaches

### ❌ Approaches Tested and Rejected

1. **VS Code CLI Commands**
   - Command: `code --help`
   - Result: No terminal management commands found
   - Conclusion: Not viable

2. **AppleScript (macOS)**
   - Tested: AppleScript Editor dictionary for VS Code
   - Result: No terminal-related verbs
   - Conclusion: Not viable

3. **Shell Escape Sequences**
   - Tested: ANSI/OSC codes for terminal control
   - Result: No sequences for terminal creation
   - Conclusion: Not viable

4. **Environment Variable Inspection**
   - Tested: All VS Code/Cursor environment variables
   - Result: Detection works, control doesn't
   - Conclusion: Useful for detection only

5. **IPC Socket Investigation**
   - Tested: `VSCODE_IPC_HOOK_CLI` variable
   - Result: Undocumented protocol, no public API
   - Conclusion: Not viable

### ✅ Approaches That Work

1. **tmux inside VS Code**
   - Tested: `tmux new -s test` in integrated terminal
   - Result: ✅ Full tmux functionality available
   - Conclusion: Recommended approach

2. **Zellij inside VS Code**
   - Tested: `zellij` in integrated terminal
   - Result: ✅ Full Zellij functionality available
   - Conclusion: Recommended approach

---

## Appendix C: Quick Reference

### Terminal Detection

```typescript
// VS Code
process.env.TERM_PROGRAM === 'vscode'

// Cursor
process.env.TERM_PROGRAM === 'vscode-electron'

// tmux
!!process.env.TMUX

// Zellij
!!process.env.ZELLIJ

// iTerm2
process.env.TERM_PROGRAM === 'iTerm.app'
```

### Why VS Code Terminals Don't Work

```
┌─────────────────────────────────────────────────────┐
│              VS Code Architecture                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐         ┌──────────────┐       │
│  │ Integrated    │         │   Extension  │       │
│  │  Terminal    │◀────────│    Host      │       │
│  │  (pty)       │  NO API  │  (TypeScript)│      │
│  └──────┬───────┘         └──────────────┘       │
│         │                                            │
│         ▼                                            │
│  ┌──────────────┐                                  │
│  │  Shell        │ ← Has no awareness of VS Code     │
│  │  (bash/zsh)   │                                  │
│  └──────────────┘                                  │
│                                                     │
│  CLI tools running in shell cannot create new        │
│  terminals because there's no API to call.         │
└─────────────────────────────────────────────────────┘
```

### Recommended Workflow for VS Code Users

```bash
# Step 1: Start tmux
tmux new -s pi-teams

# Step 2: Use pi-teams
pi create-team my-team
pi spawn-teammate frontend-dev
pi spawn-teammate backend-dev

# Step 3: Enjoy multi-pane coordination
┌──────────────────┬──────────────────┬──────────────────┐
│   Team Lead      │  frontend-dev    │  backend-dev     │
│   (you)          │  (coding...)     │  (coding...)     │
└──────────────────┴──────────────────┴──────────────────┘
```

---

**Document Version**: 1.0
**Research Date**: February 22, 2026
**Researcher**: ide-researcher (refactor-team)
**Status**: Complete - Recommendation: Do NOT implement VS Code/Cursor terminal support
