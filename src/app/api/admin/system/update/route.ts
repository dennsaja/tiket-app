import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { db } from "@/lib/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { exec } from "child_process";
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

// Helper to execute command with timeout and return stdout/stderr
async function runCmd(cmd: string, cwd: string, timeoutMs = 60000): Promise<{ stdout: string; stderr: string }> {
  const env = getExecEnv();
  return execAsync(cmd, { cwd, env, timeout: timeoutMs });
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

// POST /api/admin/system/update — Perform system update
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc") {
    return errorResponse("Forbidden: Hanya NOC Administrator yang dapat melakukan pembaruan sistem", 403);
  }

  const git = getGitCommand();
  const cwd = process.cwd();
  const logs: string[] = [];
  const startTime = Date.now();

  const addLog = (prefix: string, msg: string) => {
    const lines = msg.split(/\r?\n/).filter((l) => l.trim().length > 0);
    lines.forEach((line) => {
      logs.push(`[${prefix}] ${line}`);
    });
  };

  try {
    addLog("INIT", `Memulai sinkronisasi pembaruan HelpDesk...`);
    addLog("INIT", `Direktori aplikasi: ${cwd}`);
    addLog("INIT", `Target repositori: https://github.com/${GITHUB_REPO}.git (branch: ${GITHUB_BRANCH})`);

    // Step 0: Fix Git permissions & Safe Directory
    try {
      await runCmd(`${git} config --global --add safe.directory "*"`, cwd, 5000);
      await runCmd(`${git} config --global --add safe.directory "${cwd.replace(/\\/g, "/")}"`, cwd, 5000);
      addLog("INIT", "Konfigurasi safe.directory Git siap.");
    } catch (e: any) {
      addLog("WARN", `Konfigurasi safe.directory: ${e.message}`);
    }

    // Step 1: Ensure .git directory exists
    const gitDir = path.join(cwd, ".git");
    if (!fs.existsSync(gitDir)) {
      addLog("GIT", "Direktori .git belum ada. Melakukan inisialisasi git repository baru...");
      const { stdout: initOut, stderr: initErr } = await runCmd(`${git} init`, cwd, 10000);
      if (initOut) addLog("GIT", initOut);
      if (initErr) addLog("GIT", initErr);
    }

    // Step 2: Configure remote origin
    try {
      await runCmd(`${git} remote set-url origin https://github.com/${GITHUB_REPO}.git`, cwd, 5000);
      addLog("GIT", `Remote origin diatur ke https://github.com/${GITHUB_REPO}.git`);
    } catch {
      try {
        await runCmd(`${git} remote add origin https://github.com/${GITHUB_REPO}.git`, cwd, 5000);
        addLog("GIT", `Remote origin ditambahkan: https://github.com/${GITHUB_REPO}.git`);
      } catch (remErr: any) {
        addLog("GIT", `Info remote: ${remErr.message}`);
      }
    }

    // Step 3: Fetch latest commits from origin
    addLog("GIT", `Menjalankan: git fetch origin ${GITHUB_BRANCH}...`);
    try {
      const { stdout: fetchOut, stderr: fetchErr } = await runCmd(
        `${git} fetch origin ${GITHUB_BRANCH}`,
        cwd,
        60000
      );
      if (fetchOut) addLog("GIT", fetchOut);
      if (fetchErr) addLog("GIT", fetchErr);
    } catch (fetchErr: any) {
      addLog("GIT_ERR", fetchErr.message || "Fetch gagal");
      throw new Error(`Gagal fetch dari GitHub: ${fetchErr.message}`);
    }

    // Step 4: Reset hard to origin/branch
    addLog("GIT", `Menjalankan: git reset --hard origin/${GITHUB_BRANCH}...`);
    try {
      const { stdout: resetOut, stderr: resetErr } = await runCmd(
        `${git} reset --hard origin/${GITHUB_BRANCH}`,
        cwd,
        30000
      );
      if (resetOut) addLog("GIT", resetOut);
      if (resetErr) addLog("GIT", resetErr);
    } catch (resetErr: any) {
      addLog("GIT_ERR", resetErr.message || "Reset gagal");
      throw new Error(`Gagal reset ke origin/${GITHUB_BRANCH}: ${resetErr.message}`);
    }

    // Step 5: Read new active commit
    let newCommit = "unknown";
    try {
      const { stdout: newSha } = await runCmd(`${git} rev-parse --short HEAD`, cwd, 5000);
      newCommit = newSha.trim();
      addLog("GIT", `Commit aktif saat ini: #${newCommit}`);
    } catch {}

    // Step 6: Database Schema Migrations
    addLog("DB", "Memeriksa dan mengeksekusi migrasi skema database Drizzle...");
    try {
      const migrationDir = path.join(cwd, "drizzle");
      if (fs.existsSync(migrationDir)) {
        await migrate(db, { migrationsFolder: migrationDir });
        addLog("DB", "Migrasi database Drizzle berhasil diverifikasi dan disinkronkan.");
      } else {
        addLog("DB", "Folder migrasi /drizzle tidak ditemukan, melewati langkah ini.");
      }
    } catch (migErr: any) {
      addLog("DB_WARN", `Pemberitahuan migrasi: ${migErr.message || "Skema sudah up-to-date."}`);
    }

    // Step 7: Build Next.js
    addLog("BUILD", "Memulai kompilasi aset & TypeScript Next.js (npm run build)...");
    try {
      const { stdout: buildOut, stderr: buildErr } = await runCmd("npm run build", cwd, 180000);
      if (buildOut) addLog("BUILD", buildOut);
      if (buildErr) addLog("BUILD", buildErr);
      addLog("BUILD", "Kompilasi Next.js berhasil diselesaikan!");
    } catch (buildErr: any) {
      addLog("BUILD_WARN", `Kompilasi Next.js: ${buildErr.message}`);
      addLog("BUILD_WARN", "Jika proses runtime membutuhkan restart, jalankan 'systemctl restart helpdesk' di terminal.");
    }

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    addLog("SUCCESS", `Proses pembaruan selesai dalam ${durationSec} detik! Versi aktif: #${newCommit}`);

    // Create Audit Log
    await createAuditLog({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "settings_updated",
      targetType: "system",
      targetId: "update",
      metadata: { action: "system_updated_from_github", newCommit, repository: GITHUB_REPO, durationSec },
      ipAddress: getClientIp(req),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Pembaruan sistem berhasil diterapkan ke versi #${newCommit}!`,
      newCommit,
      logs,
      durationSec,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const durationSec = Math.round((Date.now() - startTime) / 1000);
    addLog("FAILED", error.message || "Terjadi kesalahan internal saat pembaruan");
    console.error("[SystemUpdate] Update execution failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Terjadi kesalahan saat memproses pembaruan",
        logs,
        durationSec,
      },
      { status: 500 }
    );
  }
}

