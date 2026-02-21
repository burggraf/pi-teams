import fs from "node:fs";
import path from "node:path";

export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const lockFile = `${lockPath}.lock`;
  const LOCK_TIMEOUT = 5000; // 5 seconds of retrying
  const STALE_LOCK_TIMEOUT = 30000; // 30 seconds for a lock to be considered stale
  
  let retries = 50;
  while (retries > 0) {
    try {
      // Check if lock exists and is stale
      if (fs.existsSync(lockFile)) {
        const stats = fs.statSync(lockFile);
        const age = Date.now() - stats.mtimeMs;
        if (age > STALE_LOCK_TIMEOUT) {
          // Attempt to remove stale lock
          try {
            fs.unlinkSync(lockFile);
          } catch (e) {
            // ignore, another process might have already removed it
          }
        }
      }
      
      fs.writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });
      break;
    } catch (e) {
      retries--;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  if (retries === 0) {
    throw new Error("Could not acquire lock");
  }

  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(lockFile);
    } catch (e) {
      // ignore
    }
  }
}
