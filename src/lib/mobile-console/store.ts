import { eq, sql, like, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { ConsoleAction, MobileConsoleState, MobileDeviceReceipt, emptyConsoleState } from "./config";
import { notificationBus } from "@/lib/notifications/bus";

const key = "android_remote_config_v1";
export class ConsoleConflict extends Error {}
export async function readMobileReceipts(): Promise<MobileDeviceReceipt[]> {
  const rows = await db.select({ value: systemSettings.value }).from(systemSettings)
    .where(like(systemSettings.key, "android_config_receipt:%")).orderBy(desc(systemSettings.updatedAt)).limit(250);
  return rows.flatMap(row => { try { return row.value ? [JSON.parse(row.value) as MobileDeviceReceipt] : []; } catch { return []; } });
}
export async function readMobileConsole(): Promise<MobileConsoleState> {
  const row = await db.query.systemSettings.findFirst({ where: eq(systemSettings.key, key) });
  return row?.value ? JSON.parse(row.value) : emptyConsoleState();
}

export async function changeMobileConsole(action: ConsoleAction, actorName: string) {
  const updated = await db.transaction(async tx => {
    // Serialize publish/rollback and reject editors holding an outdated draft.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    const [row] = await tx.select().from(systemSettings).where(eq(systemSettings.key, key));
    const state: MobileConsoleState = row?.value ? JSON.parse(row.value) : emptyConsoleState();
    if (state.revision !== action.revision) throw new ConsoleConflict("Console telah diubah pengguna lain. Muat ulang sebelum menyimpan.");
    const revision = state.revision + 1;
    if (action.action === "save") state.draft = action.config;
    else {
      const restore = action.action === "rollback" ? state.history.find(item => item.version === action.version) : null;
      if (action.action === "rollback" && !restore) throw new ConsoleConflict("Versi pemulihan tidak tersedia. Muat ulang console.");
      const release = {
        version: revision, publishedAt: new Date().toISOString(), publishedBy: actorName,
        note: action.action === "publish" ? action.note : `Pulihkan konfigurasi versi ${restore!.version}`,
        config: { ...(restore?.config ?? state.draft) },
      };
      state.published = release;
      state.draft = { ...release.config };
      state.history = [release, ...state.history].slice(0, 20);
    }
    state.revision = revision;
    await tx.insert(systemSettings).values({ key, value: JSON.stringify(state), description: "Android remote configuration and release history" })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(state), updatedAt: new Date() } });
    return state;
  });
  // Wake connected APKs only after publication is committed. Heartbeats cover other workers.
  if (action.action !== "save" && updated.published) notificationBus.emitMobileConfig(updated.published.version);
  return updated;
}
