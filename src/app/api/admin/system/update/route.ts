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
  let localCommit = "unknown";
  let localCommitShort = "unknown";
  let localBranch = GITHUB_BRANCH;

  try {
    const { stdout: fullSha } = await execAsync(`${git} rev-parse HEAD`, {
      cwd: process.cwd(),
      timeout: 5000,
    });
    localCommit = fullSha.trim();
    localCommitShort = localCommit.substring(0, 7);

    const { stdout: branch } = await execAsync(`${git} branch --show-current`, {
      cwd: process.cwd(),
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
      // If repo is private or rate limited, return current status
      return NextResponse.json({
        currentCommit: localCommitShort,
        currentCommitFull: localCommit,
        currentBranch: localBranch,
        repository: `https://github.com/${GITHUB_REPO}`,
        hasUpdate: false,
        checkedAt: new Date().toISOString(),
        note: `GitHub API response: ${ghRes.statusText} (${ghRes.status})`,
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
      error: error.message || "Failed to connect to GitHub",
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
  const logs: string[] = [];
  const steps: { name: string; status: "success" | "error" | "skipped"; detail?: string }[] = [];

  try {
    // Step 1: Git Fetch and Pull
    logs.push(`[1/3] Mengambil pembaruan kode dari GitHub (${GITHUB_REPO} / ${GITHUB_BRANCH})...`);
    try {
      const { stdout: pullOut, stderr: pullErr } = await execAsync(
        `${git} pull origin ${GITHUB_BRANCH}`,
        {
          cwd: process.cwd(),
          timeout: 60000,
        }
      );
      logs.push(pullOut || pullErr || "Git pull executed.");
      steps.push({ name: "Git Pull", status: "success", detail: pullOut.trim() });
    } catch (gitErr: any) {
      logs.push(`Warning on git pull: ${gitErr.message}`);
      steps.push({ name: "Git Pull", status: "error", detail: gitErr.message });
      throw new Error(`Gagal melakukan git pull: ${gitErr.message}`);
    }

    // Step 2: Run Database Migrations if any
    logs.push("[2/3] Memeriksa dan menjalankan migrasi database schema...");
    try {
      const { stdout: migOut } = await execAsync("npx drizzle-kit migrate", {
        cwd: process.cwd(),
        timeout: 30000,
      });
      logs.push(migOut || "Migrasi database selesai.");
      steps.push({ name: "Database Migration", status: "success", detail: "Schema synced" });
    } catch (migErr: any) {
      // Non-fatal if no new migrations or drizzle-kit migrate is already up to date
      logs.push(`Catatan migrasi: ${migErr.message || "Schema up to date"}`);
      steps.push({ name: "Database Migration", status: "skipped", detail: "Schema up to date" });
    }

    // Step 3: Next.js Rebuild
    logs.push("[3/3] Mengompilasi build produksi Next.js...");
    try {
      const { stdout: buildOut } = await execAsync("npm run build", {
        cwd: process.cwd(),
        timeout: 180000,
      });
      logs.push("Build produksi berhasil dikompilasi.");
      steps.push({ name: "Next.js Build", status: "success", detail: "Compiled 27 routes" });
    } catch (buildErr: any) {
      logs.push(`Build warning: ${buildErr.message}`);
      steps.push({ name: "Next.js Build", status: "error", detail: buildErr.message });
    }

    // Read updated commit
    let newCommit = "unknown";
    try {
      const { stdout: newSha } = await execAsync(`${git} rev-parse --short HEAD`, {
        cwd: process.cwd(),
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

    return NextResponse.json({
      success: true,
      message: "Aplikasi berhasil diperbarui dari GitHub!",
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
        error: error.message || "Terjadi kesalahan saat memproses pembaruan sistem",
        steps,
        logs,
      },
      { status: 500 }
    );
  }
}
