import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { db } from "@/lib/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const GITHUB_REPO = process.env.GITHUB_REPO || "dennsaja/tiket-app";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

// Build robust environment with Git & Node in PATH
function getExecEnv() {
  const customPaths = [
    process.env.PATH,
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/local/node/bin",
    "/usr/sbin",
    "/sbin",
  ];

  if (process.env.LOCALAPPDATA) {
    customPaths.push(
      path.join(process.env.LOCALAPPDATA, "Programs", "Git", "cmd"),
      path.join(process.env.LOCALAPPDATA, "Programs", "Git", "bin")
    );
  }

  return {
    ...process.env,
    PATH: customPaths.filter(Boolean).join(path.delimiter),
    GIT_TERMINAL_PROMPT: "0",
    CI: "1",
  };
}

// Find available git binary
function getGitCommand(): string {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const minGit = path.join(localAppData, "Programs", "Git", "cmd", "git.exe");
    if (fs.existsSync(minGit)) {
      return `"${minGit}"`;
    }
  }
  return "git";
}

// Quick async exec helper for queries
async function runCmd(cmd: string, cwd: string, timeoutMs = 60000): Promise<{ stdout: string; stderr: string }> {
  const env = getExecEnv();
  return execAsync(cmd, { cwd, env, timeout: timeoutMs });
}

// Streaming spawn helper that yields output lines in realtime
function spawnStreamingCmd(
  cmdString: string,
  cwd: string,
  onLine: (line: string, isErr?: boolean) => void,
  timeoutMs = 300000
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? (process.env.ComSpec || "cmd.exe") : "/bin/bash";
    const shellArgs = isWindows ? ["/d", "/s", "/c", cmdString] : ["-c", cmdString];

    let fullStdout = "";
    let fullStderr = "";

    const proc = spawn(shell, shellArgs, {
      cwd,
      env: getExecEnv(),
      windowsVerbatimArguments: isWindows,
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`Command timed out after ${timeoutMs / 1000}s: ${cmdString}`));
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      const str = chunk.toString();
      fullStdout += str;
      const lines = str.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim().length > 0) onLine(line, false);
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const str = chunk.toString();
      fullStderr += str;
      const lines = str.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim().length > 0) onLine(line, true);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 0, stdout: fullStdout, stderr: fullStderr });
    });
  });
}

// GET /api/admin/system/update — Check for updates from GitHub
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc") {
    return errorResponse("Forbidden: Hanya NOC Administrator yang dapat mengakses pembaruan sistem", 403);
  }

  const git = getGitCommand();
  const cwd = process.cwd();
  let localCommit = "unknown";
  let localCommitShort = "unknown";
  let localBranch = GITHUB_BRANCH;

  // Configure safe directory first
  try {
    await runCmd(`${git} config --global --add safe.directory "*"`, cwd, 5000);
    await runCmd(`${git} config --global --add safe.directory "${cwd.replace(/\\/g, "/")}"`, cwd, 5000);
  } catch {}

  try {
    const { stdout: fullSha } = await runCmd(`${git} rev-parse HEAD`, cwd, 5000);
    localCommit = fullSha.trim();
    localCommitShort = localCommit.substring(0, 7);

    const { stdout: branch } = await runCmd(`${git} branch --show-current`, cwd, 5000);
    if (branch.trim()) localBranch = branch.trim();
  } catch (err: any) {
    console.warn("[SystemUpdate] Local git info not accessible:", err.message);
  }

  // Fetch latest commit from GitHub API
  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`;
    const ghRes = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "HelpDesk-App-Updater",
      },
      next: { revalidate: 0 },
    });

    if (!ghRes.ok) {
      return NextResponse.json({
        currentCommit: localCommitShort,
        currentCommitFull: localCommit,
        currentBranch: localBranch,
        repository: `https://github.com/${GITHUB_REPO}`,
        hasUpdate: localCommit === "unknown",
        checkedAt: new Date().toISOString(),
        note: `GitHub API: ${ghRes.statusText} (${ghRes.status})`,
      });
    }

    const commitData = await ghRes.json();
    const remoteSha = commitData.sha || "";
    const remoteShaShort = remoteSha.substring(0, 7);
    const commitMessage = commitData.commit?.message || "No commit message";
    const commitAuthor = commitData.commit?.author?.name || "Unknown";
    const commitDate = commitData.commit?.author?.date || new Date().toISOString();
    const htmlUrl = commitData.html_url || `https://github.com/${GITHUB_REPO}/commit/${remoteSha}`;

    const isUpToDate =
      localCommit !== "unknown" &&
      (localCommit === remoteSha ||
        localCommit.startsWith(remoteShaShort) ||
        remoteSha.startsWith(localCommitShort));

    return NextResponse.json({
      currentCommit: localCommitShort,
      currentCommitFull: localCommit,
      currentBranch: localBranch,
      latestCommit: remoteShaShort,
      latestCommitFull: remoteSha,
      hasUpdate: !isUpToDate,
      commitMessage,
      commitAuthor,
      commitDate,
      commitUrl: htmlUrl,
      repository: `https://github.com/${GITHUB_REPO}`,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[SystemUpdate] Failed to check GitHub updates:", error);
    return NextResponse.json({
      currentCommit: localCommitShort,
      currentCommitFull: localCommit,
      currentBranch: localBranch,
      repository: `https://github.com/${GITHUB_REPO}`,
      hasUpdate: localCommit === "unknown",
      checkedAt: new Date().toISOString(),
      error: error.message || "Gagal menghubungi GitHub",
    });
  }
}

// POST /api/admin/system/update — Real-time Streaming System Update Execution
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc") {
    return errorResponse("Forbidden: Hanya NOC Administrator yang dapat melakukan pembaruan sistem", 403);
  }

  const clientIp = getClientIp(req);
  const git = getGitCommand();
  const cwd = process.cwd();
  const startTime = Date.now();

  // Create real-time ReadableStream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: {
        type: "log" | "status" | "complete" | "error" | "restart";
        prefix?: string;
        message?: string;
        progress?: number;
        newCommit?: string;
        durationSec?: number;
        error?: string;
      }) => {
        try {
          const chunk = encoder.encode(JSON.stringify(data) + "\n");
          controller.enqueue(chunk);
        } catch {}
      };

      const log = (prefix: string, message: string) => {
        send({ type: "log", prefix, message });
      };

      try {
        log("INIT", "=========================================================");
        log("INIT", "  MEMULAI PROSES PEMBARUAN SISTEM HELPDESK (REALTIME)");
        log("INIT", "=========================================================");
        log("INIT", `Direktori Kerja: ${cwd}`);
        log("INIT", `Target Repositori: https://github.com/${GITHUB_REPO}.git (branch: ${GITHUB_BRANCH})`);

        // Step 0: Git Safe Directory
        log("GIT", "Mengonfigurasi Git safe.directory...");
        try {
          await runCmd(`${git} config --global --add safe.directory "*"`, cwd, 5000);
          await runCmd(`${git} config --global --add safe.directory "${cwd.replace(/\\/g, "/")}"`, cwd, 5000);
          log("GIT", "Safe directory berhasil dikonfigurasi.");
        } catch (e: any) {
          log("GIT_WARN", `Konfigurasi safe.directory: ${e.message}`);
        }

        // Step 1: Ensure .git directory exists
        const gitDir = path.join(cwd, ".git");
        if (!fs.existsSync(gitDir)) {
          log("GIT", "Direktori .git belum ditemukan. Melakukan inisialisasi Git repository...");
          await spawnStreamingCmd(`${git} init`, cwd, (line) => log("GIT", line));
        }

        // Step 2: Configure remote origin
        try {
          await runCmd(`${git} remote set-url origin https://github.com/${GITHUB_REPO}.git`, cwd, 5000);
          log("GIT", `Remote origin diatur ke: https://github.com/${GITHUB_REPO}.git`);
        } catch {
          try {
            await runCmd(`${git} remote add origin https://github.com/${GITHUB_REPO}.git`, cwd, 5000);
            log("GIT", `Remote origin ditambahkan: https://github.com/${GITHUB_REPO}.git`);
          } catch {}
        }

        // Step 3: Fetch latest commits from origin
        log("GIT", `Mengambil perubahan terbaru dari origin/${GITHUB_BRANCH}...`);
        send({ type: "status", message: "Mengunduh kode terbaru dari GitHub...", progress: 20 });
        const fetchRes = await spawnStreamingCmd(
          `${git} fetch origin ${GITHUB_BRANCH}`,
          cwd,
          (line) => log("GIT_FETCH", line),
          90000
        );
        if (fetchRes.exitCode !== 0) {
          throw new Error(`Git fetch gagal dengan exit code ${fetchRes.exitCode}`);
        }

        // Step 4: Reset hard to origin/branch
        log("GIT", `Menyesuaikan kode lokal dengan origin/${GITHUB_BRANCH}...`);
        send({ type: "status", message: "Menerapkan commit terbaru...", progress: 35 });
        const resetRes = await spawnStreamingCmd(
          `${git} reset --hard origin/${GITHUB_BRANCH}`,
          cwd,
          (line) => log("GIT_RESET", line),
          60000
        );
        if (resetRes.exitCode !== 0) {
          throw new Error(`Git reset gagal dengan exit code ${resetRes.exitCode}`);
        }

        // Step 5: Read active commit
        let newCommit = "unknown";
        try {
          const { stdout: shaOut } = await runCmd(`${git} rev-parse --short HEAD`, cwd, 5000);
          newCommit = shaOut.trim();
          log("GIT", `Commit aktif saat ini: #${newCommit}`);
        } catch {}

        // Step 6: Database Schema & Enum Sync
        log("DB", "Sinkronisasi tipe enum dan skema database PostgreSQL...");
        send({ type: "status", message: "Sinkronisasi database...", progress: 45 });
        try {
          const { Pool } = await import("pg");
          const pool = new Pool({ connectionString: process.env.DATABASE_URL });
          await pool.query(`
            DO $$
            BEGIN
              ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'noc';
              ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
            EXCEPTION
              WHEN duplicate_object THEN null;
            END $$;
          `);
          await pool.end();
          log("DB", "Tipe enum role (noc, owner, admin, agent, user) terverifikasi.");
        } catch (dbErr: any) {
          log("DB_WARN", `Sinkronisasi enum: ${dbErr.message || "Lewati enum sync"}`);
        }

        // Run Drizzle Migrations if exists
        try {
          const migrationDir = path.join(cwd, "drizzle");
          if (fs.existsSync(migrationDir)) {
            log("DB", "Menjalankan migrasi Drizzle dari folder /drizzle...");
            await migrate(db, { migrationsFolder: migrationDir });
            log("DB", "Migrasi database Drizzle selesai.");
          }
        } catch (migErr: any) {
          log("DB_WARN", `Pemberitahuan migrasi: ${migErr.message}`);
        }

        // Step 7: Dynamic Update Hooks & Custom Commands Support
        // Supports: update-hooks.json, update.json, or scripts/update-hook.sh
        send({ type: "status", message: "Memeriksa custom hook pembaruan...", progress: 55 });
        
        let customCommands: string[] = [];
        const hookJsonPaths = [
          path.join(cwd, "update-hooks.json"),
          path.join(cwd, "update.json"),
          path.join(cwd, ".update-commands.json"),
        ];

        for (const hookPath of hookJsonPaths) {
          if (fs.existsSync(hookPath)) {
            try {
              const fileContent = fs.readFileSync(hookPath, "utf-8");
              const parsed = JSON.parse(fileContent);
              if (Array.isArray(parsed.commands)) {
                customCommands = parsed.commands;
                log("HOOK", `Ditemukan ${customCommands.length} perintah kustom dari ${path.basename(hookPath)}`);
              } else if (Array.isArray(parsed.preBuildCommands)) {
                customCommands = parsed.preBuildCommands;
                log("HOOK", `Ditemukan ${customCommands.length} perintah pre-build dari ${path.basename(hookPath)}`);
              }
              break;
            } catch (hErr: any) {
              log("HOOK_WARN", `Gagal membaca ${path.basename(hookPath)}: ${hErr.message}`);
            }
          }
        }

        // Execute custom commands if found
        if (customCommands.length > 0) {
          for (const cmd of customCommands) {
            log("HOOK_EXEC", `Menjalankan perintah kustom: ${cmd}`);
            const hookRes = await spawnStreamingCmd(cmd, cwd, (line) => log("HOOK_OUTPUT", line), 180000);
            if (hookRes.exitCode !== 0) {
              log("HOOK_WARN", `Perintah "${cmd}" selesai dengan exit code ${hookRes.exitCode}`);
            }
          }
        }

        // Execute bash script hook if present (scripts/update-hook.sh or scripts/post-update.sh)
        const hookScriptPaths = [
          path.join(cwd, "scripts", "update-hook.sh"),
          path.join(cwd, "scripts", "post-update.sh"),
        ];

        for (const scriptPath of hookScriptPaths) {
          if (fs.existsSync(scriptPath)) {
            log("HOOK", `Menjalankan script hook: ${path.relative(cwd, scriptPath)}`);
            const scriptRes = await spawnStreamingCmd(
              `bash "${scriptPath}"`,
              cwd,
              (line) => log("SCRIPT_HOOK", line),
              180000
            );
            if (scriptRes.exitCode !== 0) {
              log("HOOK_WARN", `Script hook selesai dengan exit code ${scriptRes.exitCode}`);
            }
            break;
          }
        }

        // Step 8: Next.js Production Build
        log("BUILD", "Memulai kompilasi Next.js (npm run build)...");
        send({ type: "status", message: "Mengompilasi Next.js bundle...", progress: 70 });

        const buildRes = await spawnStreamingCmd(
          "npm run build",
          cwd,
          (line) => log("BUILD", line),
          300000 // 5 minutes max
        );

        if (buildRes.exitCode !== 0) {
          log("BUILD_ERR", `Kompilasi Next.js gagal dengan exit code ${buildRes.exitCode}`);
          throw new Error("Gagal mengompilasi Next.js (npm run build). Periksa error di atas.");
        }

        log("BUILD", "Kompilasi Next.js berhasil 100%!");
        send({ type: "status", message: "Pembaruan berhasil diterapkan!", progress: 100 });

        const durationSec = Math.round((Date.now() - startTime) / 1000);
        log("SUCCESS", `=========================================================`);
        log("SUCCESS", `  PEMBARUAN BERHASIL SELESAI DALAM ${durationSec} DETIK!`);
        log("SUCCESS", `  Versi Aktif: #${newCommit}`);
        log("SUCCESS", `=========================================================`);

        // Create Audit Log
        if (session?.user?.id && session?.user?.email) {
          await createAuditLog({
            actorId: session.user.id,
            actorEmail: session.user.email,
            action: "settings_updated",
            targetType: "system",
            targetId: "update",
            metadata: { action: "system_updated_from_github", newCommit, repository: GITHUB_REPO, durationSec },
            ipAddress: clientIp,
          }).catch(() => {});
        }

        // Step 9: Automatic Service Restart Trigger
        log("RESTART", "Memicu restart service otomatis agar aplikasi berjalan dengan kode baru...");
        send({
          type: "restart",
          message: "Service sedang di-restart otomatis. Halaman akan dimuat ulang...",
        });

        // Trigger detached background restart for systemd / PM2
        try {
          if (process.platform === "linux") {
            const restartCmd = "sleep 3 && (systemctl restart helpdesk 2>/dev/null || pm2 restart helpdesk 2>/dev/null || pm2 reload all 2>/dev/null || kill -SIGUSR2 1 2>/dev/null || true)";
            const restartProc = spawn("sh", ["-c", restartCmd], {
              detached: true,
              stdio: "ignore",
            });
            restartProc.unref();
            log("RESTART", "Sinyal restart service systemd/PM2 terkirim.");
          }
        } catch (rErr: any) {
          log("RESTART_WARN", `Sinyal restart: ${rErr.message}`);
        }

        // Complete the stream
        send({
          type: "complete",
          newCommit,
          durationSec,
          message: `Sistem berhasil diperbarui ke versi #${newCommit}!`,
        });

        // Optional graceful exit to let systemd restart on exit if configured
        setTimeout(() => {
          if (process.env.NODE_ENV === "production") {
            process.exit(0);
          }
        }, 4000);

      } catch (error: any) {
        const durationSec = Math.round((Date.now() - startTime) / 1000);
        log("FAILED", `ERROR: ${error.message || "Terjadi kesalahan internal saat pembaruan"}`);
        console.error("[SystemUpdate] Update failed:", error);

        send({
          type: "error",
          error: error.message || "Gagal memperbarui aplikasi",
          durationSec,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
