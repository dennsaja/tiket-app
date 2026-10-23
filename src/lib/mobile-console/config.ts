import { z } from "zod";

export const mobileConfigSchema = z.object({
  homeSubtitle: z.string().trim().min(1).max(140),
  announcementTitle: z.string().trim().max(80),
  announcementBody: z.string().trim().max(600),
  showActivityChart: z.boolean(),
  recentTicketLimit: z.number().int().min(1).max(8),
  refreshIntervalSeconds: z.number().int().min(15).max(120),
}).strict();

export type MobileConfig = z.infer<typeof mobileConfigSchema>;
export const defaultMobileConfig: MobileConfig = {
  homeSubtitle: "Ruang kerja kamu, lebih terhubung.",
  announcementTitle: "", announcementBody: "", showActivityChart: true,
  recentTicketLimit: 3, refreshIntervalSeconds: 15,
};
export interface MobileRelease {
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string;
  config: MobileConfig;
}
export interface MobileConsoleState {
  revision: number;
  draft: MobileConfig;
  published: MobileRelease | null;
  history: MobileRelease[];
  receipts?: MobileDeviceReceipt[];
}
export interface MobileDeviceReceipt {
  userId: string;
  name: string;
  appVersion: string;
  appVersionCode: number;
  version: number;
  appliedAt: string;
}
export const emptyConsoleState = (): MobileConsoleState => ({
  revision: 0, draft: { ...defaultMobileConfig }, published: null, history: [],
});
export const consoleActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), revision: z.number().int().nonnegative(), config: mobileConfigSchema }).strict(),
  z.object({ action: z.literal("publish"), revision: z.number().int().nonnegative(), note: z.string().trim().min(1).max(240) }).strict(),
  z.object({ action: z.literal("rollback"), revision: z.number().int().nonnegative(), version: z.number().int().positive() }).strict(),
]);
export type ConsoleAction = z.infer<typeof consoleActionSchema>;
