import path from "node:path";
import { spawn } from "node:child_process";

export type PythonRunnerResult<T> = {
  payload: T | null;
  warnings: string[];
};

function resolvePythonBin(): string {
  return process.env.PYTHON_BIN || "python3";
}

export async function runPythonJson<T>(input: {
  scriptRelativePath: string;
  payload: Record<string, unknown>;
  timeoutMs: number;
}): Promise<PythonRunnerResult<T>> {
  const pythonBin = resolvePythonBin();
  const scriptPath = path.join(process.cwd(), input.scriptRelativePath);

  return new Promise((resolve) => {
    const warnings: string[] = [];
    const child = spawn(pythonBin, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    });

    const timer = setTimeout(() => {
      warnings.push(`Python runner timed out after ${input.timeoutMs}ms (${input.scriptRelativePath}).`);
      child.kill("SIGKILL");
    }, input.timeoutMs);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      warnings.push(`Failed to execute Python runner (${input.scriptRelativePath}): ${error.message}`);
      resolve({ payload: null, warnings });
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (stderr.trim()) {
        warnings.push(stderr.trim().split("\n")[0].slice(0, 300));
      }

      if (code !== 0) {
        warnings.push(`Python runner exited with code ${code} (${input.scriptRelativePath}).`);
        resolve({ payload: null, warnings });
        return;
      }

      if (!stdout.trim()) {
        warnings.push(`Python runner returned empty output (${input.scriptRelativePath}).`);
        resolve({ payload: null, warnings });
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as T;
        resolve({ payload: parsed, warnings });
      } catch (error) {
        warnings.push(
          `Python runner returned non-JSON output (${input.scriptRelativePath}): ${
            error instanceof Error ? error.message : "unknown parse error"
          }`
        );
        resolve({ payload: null, warnings });
      }
    });

    try {
      child.stdin.write(JSON.stringify(input.payload));
      child.stdin.end();
    } catch (error) {
      clearTimeout(timer);
      warnings.push(
        `Failed writing payload to Python runner (${input.scriptRelativePath}): ${
          error instanceof Error ? error.message : "unknown stdin error"
        }`
      );
      child.kill("SIGKILL");
      resolve({ payload: null, warnings });
    }
  });
}
