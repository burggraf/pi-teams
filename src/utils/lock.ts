import fs from "node:fs";
import path from "node:path";

export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const lockFile = `${lockPath}.lock`;
  let retries = 50;
  while (retries > 0) {
    try {
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
