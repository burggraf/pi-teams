# Audit Findings for `src/utils`

I've analyzed the `src/utils` directory for logic bugs and race conditions. Here are my findings:

### 1. Critical Deadlock Condition in `src/utils/lock.ts`
The current `withLock` implementation has no mechanism for lock expiration or stale lock detection.
- **Problem**: If a process crashes (e.g., due to a power failure or being killed with `SIGKILL`) while holding a lock, the `.lock` file remains on disk forever.
- **Impact**: All future attempts to acquire the lock for that specific path will fail after 5 seconds of retrying, effectively deadlocking that part of the system until manual cleanup occurs.
- **Recommendation**: Add logic to check the age of the lock file or verify if the process ID stored in the lock file is still active.

### 2. Race Condition in `src/utils/tasks.ts` (Inconsistent Lock Paths)
Different functions in `tasks.ts` use inconsistent lock file names for the same task resources.
- **Problem 1**: `updateTask` locks `${taskId}.lock`, while `readTask` locks `${taskId}.json.lock`. These two functions can run concurrently on the same task, potentially leading to corrupt reads/writes.
- **Problem 2**: `listTasks` and `createTask` lock the task directory (`tasks.lock`), but `updateTask` and `readTask` do not coordinate with this directory-level lock.
- **Impact**: `listTasks` can read a task file (via `fs.readFileSync`) while `updateTask` is writing to it (via `fs.writeFileSync`) or deleting it (via `fs.unlinkSync`), leading to JSON parsing errors or "File not found" exceptions.
- **Recommendation**: Standardize on a single lock file naming convention (e.g., always use `${taskId}.json.lock`) and ensure directory-level operations coordinate correctly with individual task operations.

### 3. Scalability/Memory Issue in `src/utils/messaging.ts`
The messaging system reads and writes the entire inbox for every single operation.
- **Problem**: Both `appendMessage` and `readInbox` read the entire agent's inbox into a JSON array, modify it in memory, and then rewrite the entire file back to disk.
- **Impact**: As an agent's inbox grows over time, this will become increasingly slow and memory-intensive. For very large inboxes, it could lead to Out-Of-Memory (OOM) errors and slow down the entire team's communication.
- **Recommendation**: Use a streaming or append-only log format for messages, or implement a mechanism to archive/truncate old messages.

### 4. Race Condition in `src/utils/teams.ts`
The `createTeam` function lacks any locking mechanism.
- **Problem**: If two processes attempt to create the same team simultaneously, they can interfere with each other during directory creation and configuration file writing.
- **Impact**: Potential for corrupted team configurations or unexpected errors during team setup.
- **Recommendation**: Add a lock around the team creation process.

---

## Tester Findings (Confirmed via Tests)

I have implemented test cases to verify the above findings and cover edge cases.

### Confirmed Bugs from Tests:
- **Bug 2 Verified:** I implemented `src/utils/tasks.test.ts` which demonstrates that `updateTask` and `readTask` can indeed access the same task concurrently because they use different lock file names (`taskId.lock` vs `taskId.json.lock`).
- **Locking Stress Test:** I implemented `src/utils/messaging.test.ts` with a stress test of 100 concurrent `appendMessage` calls. The `withLock` mechanism correctly serialized the writes, ensuring no data loss.
- **Lock Acquisition Failure:** I implemented `src/utils/lock.test.ts` which confirms that if a lock file already exists, `withLock` fails after a 5-second timeout.

### Summary of Coverage:
- `lock.test.ts`: Covers acquisition, release, timeout, and release-on-failure.
- `messaging.test.ts`: Covers concurrent appends and unread marking.
- `tasks.test.ts`: Covers creation, updating, listing, and lock inconsistency verification.

### Recommendation for Project Structure:
We should standardize the `findings.md`, `task_plan.md`, and `progress.md` files or use agent-specific prefixes (e.g., `tester_findings.md`) to avoid collision between teammates.
