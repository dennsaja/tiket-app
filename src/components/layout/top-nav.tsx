"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, X, Menu, Settings, User, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut, useSession } from "next-auth/react";
import { useNotifications } from "@/hooks/use-notifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatRelativeTime, cn } from "@/lib/utils";

interface TopNavProps { breadcrumbs?: Array<{ label: string; href?: string }>; title?: string }
const labels: Record<string, string> = { dashboard: "Ringkasan", tickets: "Tiket", new: "Buat tiket", chat: "Chat tim", "knowledge-base": "Pusat bantuan", profile: "Profil", admin: "Admin", users: "Pengguna", departments: "Departemen", categories: "Kategori", sla: "Kebijakan SLA", audit: "Log aktivitas", updates: "Pembaruan", settings: "Pengaturan", map: "Peta teknisi", backup: "Backup & restore" };

export function TopNav({ breadcrumbs, title }: TopNavProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { notifications, unreadCount, markAllRead, markRead, marking } = useNotifications();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mobileSearch, setMobileSearch] = React.useState(false);
  const [today, setToday] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = breadcrumbs || segments.map((part, index) => ({
    label: labels[part] || "Detail",
    href: index < segments.length - 1 ? "/" + segments.slice(0, index + 1).join("/") : undefined,
  }));

  React.useEffect(() => {
    const update = () => setToday(new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault(); setMobileSearch(true); searchRef.current?.focus();
      }
      if (event.key === "Escape") { setMobileSearch(false); searchRef.current?.blur(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => { window.clearInterval(timer); window.removeEventListener("keydown", shortcut); };
  }, []);
  React.useEffect(() => { if (mobileSearch) searchRef.current?.focus(); }, [mobileSearch]);

  return <>
    <header className="workspace-header">
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"))} className="header-icon lg:hidden" aria-label="Buka menu"><Menu className="h-5 w-5" /></button>
      <form role="search" className={cn("header-search", mobileSearch && "is-open")} onSubmit={(event) => {
        event.preventDefault();
        if (searchQuery.trim()) { router.push("/tickets?search=" + encodeURIComponent(searchQuery.trim())); setMobileSearch(false); }
      }}>
        <Search className="h-[18px] w-[18px] shrink-0" />
        <input ref={searchRef} aria-label="Cari tiket" placeholder="Cari judul atau nomor tiket..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        <kbd>Ctrl K</kbd>
        {mobileSearch && <button type="button" className="sm:hidden" onClick={() => setMobileSearch(false)} aria-label="Tutup pencarian"><X className="h-4 w-4" /></button>}
      </form>
      <button type="button" className="header-icon sm:hidden" aria-label="Buka pencarian" onClick={() => setMobileSearch(true)}><Search className="h-[18px] w-[18px]" /></button>
      <span className="header-date"><span>Hari ini,</span> {today}</span>
      <div className="header-actions">
        <nav className="header-tabs" aria-label="Tampilan workspace">
          <Link href="/dashboard" className={cn(pathname === "/dashboard" && "is-active")} aria-current={pathname === "/dashboard" ? "page" : undefined}>Ringkasan</Link>
          <Link href="/tickets" className={cn(pathname.startsWith("/tickets") && "is-active")} aria-current={pathname.startsWith("/tickets") ? "page" : undefined}>Daftar tiket</Link>
        </nav>
        <ThemeToggle />
        {["noc", "owner"].includes(role || "") && <Link href="/admin/settings" className="header-icon hidden xl:flex" aria-label="Pengaturan" title="Pengaturan"><Settings className="h-[18px] w-[18px]" /></Link>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="header-icon relative" aria-label={"Notifikasi, " + unreadCount + " belum dibaca"} title="Notifikasi">
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && <span className="notification-dot">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-24px))]">
            <div className="flex items-center justify-between gap-3 p-3">
              <DropdownMenuLabel className="p-0">Notifikasi</DropdownMenuLabel>
              {unreadCount > 0 && <button type="button" disabled={marking} onClick={markAllRead} className="text-xs text-[var(--accent)] disabled:opacity-50">{marking ? "Menyimpan..." : "Tandai semua dibaca"}</button>}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Belum ada notifikasi baru.</div> :
              <div className="max-h-80 overflow-y-auto">{notifications.slice(0, 10).map((notification) =>
                <DropdownMenuItem key={notification.id} className="items-start gap-3 px-3 py-3" onClick={() => { markRead(notification.id); if (notification.ticketId) router.push("/tickets/" + notification.ticketId); }}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", notification.isRead ? "bg-transparent" : "bg-[var(--accent)]")} />
                  <span className="min-w-0"><span className="block text-sm font-medium">{notification.title}</span><span className="mt-1 block text-xs text-[var(--text-muted)] line-clamp-2">{notification.message}</span><span className="mt-2 block text-[11px] text-[var(--text-muted)]">{formatRelativeTime(notification.createdAt)}</span></span>
                </DropdownMenuItem>
              )}</div>}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="header-avatar" aria-label="Profil dan akun"><Avatar name={session?.user?.name || "User"} src={session?.user?.image} size="sm" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{session?.user?.name || "Akun saya"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/profile"><User className="h-4 w-4" />Profil saya</Link></DropdownMenuItem>
            <DropdownMenuItem destructive onClick={() => signOut({ callbackUrl: "/login" })}><LogOut className="h-4 w-4" />Keluar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    {pathname !== "/dashboard" && <nav aria-label="Breadcrumb" className="workspace-breadcrumb"><Link href="/dashboard">Workspace</Link>{crumbs.map((crumb, index) => <React.Fragment key={index}><span aria-hidden="true">/</span>{crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current={index === crumbs.length - 1 ? "page" : undefined}>{title && index === crumbs.length - 1 ? title : crumb.label}</span>}</React.Fragment>)}</nav>}
  </>;
}
