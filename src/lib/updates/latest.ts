import { execFile } from "node:child_process";
import { promisify } from "node:util";

const git = promisify(execFile);
export const isCommit = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);

export async function latestRelease(repo: string, branch: string, cwd: string, env: NodeJS.ProcessEnv) {
  const repository = `https://github.com/${repo}`;
  const ref = `refs/heads/${branch}`;
  let revision: string | undefined;
  try {
    const { stdout } = await git("git", ["ls-remote", "--exit-code", "--refs", repository + ".git", ref], { cwd, env, timeout: 12000, windowsHide: true });
    const [sha, returnedRef] = stdout.trim().split(/\s+/);
    if (returnedRef === ref && isCommit(sha)) revision = sha;
  } catch { /* The GitHub API can still resolve the branch if Git is unavailable. */ }
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(revision ?? branch)}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "HelpDesk-App-Updater" },
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      if (isCommit(data.sha) && (!revision || revision === data.sha)) return {
        sha: data.sha as string, commitMessage: data.commit?.message, commitAuthor: data.commit?.author?.name,
        commitDate: data.commit?.author?.date, commitUrl: `${repository}/commit/${data.sha}`,
      };
    }
  } catch { /* Metadata is optional when Git already supplied the branch tip. */ }
  if (revision) return { sha: revision, commitUrl: `${repository}/commit/${revision}` };
  return null;
}
