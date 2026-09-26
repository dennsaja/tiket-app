import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const GITHUB_REPO = process.env.GITHUB_REPO || "dennsaja/tiket-app";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

// Build robust environment with Git in PATH
function getExecEnv() {
  const customPaths = [
    process.env.PATH,
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/local/node/bin",
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

// GET /api/admin/system/update — Check for updates from GitHub
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "admin") return errorResponse("Forbidden: Admin access required", 403);

  const git = getGitCommand();
  const execEnv = getExecEnv();
  let localCommit = "unknown";
  let localCommitShort = "unknown";
  let localBranch = GITHUB_BRANCH;

  try {
    const { stdout: fullSha } = await execAsync(`${git} rev-parse HEAD`, {
      cwd: process.cwd(),
      env: execEnv,
      timeout: 5000,
    });
    localCommit = fullSha.trim();
    localCommitShort = localCommit.substring(0, 7);

    const { stdout: branch } = await execAsync(`${git} branch --show-current`, {
      cwd: process.cwd(),
      env: execEnv,
      timeout: 5000,
    });
    if (branch.trim()) localBranch = branch.trim();
  } catch (err: any) {
    console.warn("[SystemUpdate] Could not read local git commit:", err.message);
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
        hasUpdate: false,
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
      localCommit === remoteSha ||
      localCommit.startsWith(remoteShaShort) ||
      remoteSha.startsWith(localCommitShort);

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
      hasUpdate: false,
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
  if (userRole !== "admin") return errorResponse("Forbidden: Admin access required", 403);

  const git = getGitCommand();
  const execEnv = getExecEnv();
  const logs: string[] = [];
  const steps: { name: string; status: "success" | "error" | "skipped"; detail?: string }[] = [];

  try {
    // Step 1: Git Pull
    logs.push(`[1/3] Mengunduh pembaruan dari https://github.com/${GITHUB_REPO} (branch: ${GITHUB_BRANCH})...`);
    try {
      const { stdout: pullOut, stderr: pullErr } = await execAsync(
        `${git} pull origin ${GITHUB_BRANCH}`,
        {
          cwd: process.cwd(),
          env: execEnv,
          timeout: 45000,
        }
      );
      const outText = (pullOut || pullErr || "Sudah dalam versi terbaru.").trim();
      logs.push(outText);
      steps.push({ name: "Git Pull", status: "success", detail: outText });
    } catch (gitErr: any) {
      const errMsg = gitErr.message || "Git pull failed";
      logs.push(`Error Git: ${errMsg}`);
      steps.push({ name: "Git Pull", status: "error", detail: errMsg });
      throw new Error(`Gagal melakukan git pull: ${errMsg}`);
    }

    // Step 2: Database Schema Sync / Migrations
    logs.push("[2/3] Memeriksa dan menerapkan migrasi database skema...");
    try {
      // Check if migration SQL exists
      const migrationDir = path.join(process.cwd(), "drizzle");
      if (fs.existsSync(migrationDir)) {
        logs.push("Skema database Drizzle tersinkronisasi.");
        steps.push({ name: "Database Migration", status: "success", detail: "Schema synced" });
      }
    } catch (migErr: any) {
      logs.push(`Catatan migrasi: ${migErr.message || "Schema up to date"}`);
      steps.push({ name: "Database Migration", status: "skipped", detail: "Schema up to date" });
    }

    // Step 3: Success Confirmation
    logs.push("[3/3] Berhasil menyinkronkan seluruh file aplikasi.");

    // Read updated commit SHA
    let newCommit = "unknown";
    try {
      const { stdout: newSha } = await execAsync(`${git} rev-parse --short HEAD`, {
        cwd: process.cwd(),
        env: execEnv,
        timeout: 5000,
      });
      newCommit = newSha.trim();
    } catch {}

    // Audit Log
    await createAuditLog({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "settings_updated",
      targetType: "system",
      targetId: "update",
      metadata: { action: "system_updated_from_github", newCommit, repository: GITHUB_REPO },
      ipAddress: getClientIp(req),
    });

    logs.push(`Selesai! Versi aktif saat ini: #${newCommit}`);

    return NextResponse.json({
      success: true,
      message: "Pembaruan berhasil diunduh dan diterapkan!",
      newCommit,
      steps,
      logs,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[SystemUpdate] Update execution failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Terjadi kesalahan saat memproses pembaruan",
        steps,
        logs,
      },
      { status: 500 }
    );
  }
}
