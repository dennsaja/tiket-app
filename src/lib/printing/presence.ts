import type { PrinterTransport } from "./types";

export const PRINTER_ROLES = ["admin", "noc", "owner"];
const LEASE_MS = 90_000;
type Lease = { userId: string; role: string; expires: number; transport: PrinterTransport };

// Presence is ephemeral. The HelpDesk server runs one Node process.
export class PrinterPresence {
  private hosts = new Map<string, Lease>();

  roles(now = Date.now(), transport: PrinterTransport = "USB") {
    const roles = new Set<string>();
    for (const [id, lease] of this.hosts) {
      if (lease.expires <= now) this.hosts.delete(id);
      else if (lease.transport === transport) roles.add(lease.role);
    }
    return [...roles].sort();
  }

  update(id: string, userId: string, role: string, connected: boolean, now = Date.now(), transport: PrinterTransport = "USB") {
    this.roles(now);
    const previous = this.hosts.get(id);
    if (previous && previous.userId !== userId) return false;
    if (!connected) this.hosts.delete(id);
    else {
      if (!previous && [...this.hosts.values()].filter(lease => lease.userId === userId).length >= 12) return false;
      this.hosts.set(id, { userId, role, expires: now + LEASE_MS, transport });
    }
    return true;
  }
}
