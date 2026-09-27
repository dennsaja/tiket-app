"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Plus, X, Command, Menu } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/hooks/use-notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopNavProps {
  breadcrumbs?: BreadcrumbItem[];
  title?: string;
}

export function TopNav({ breadcrumbs, title }: TopNavProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { notifications, unreadCount, markAllRead, markRead } =
    useNotifications();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/tickets?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  // Auto-generate breadcrumbs from pathname if not provided
  const autoBreadcrumbs = React.useMemo(() => {
    if (breadcrumbs) return breadcrumbs;
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((seg, i) => {
      let label = seg
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      
      // Indonesian label mapping for common path segments
      if (seg === "dashboard") label = "Beranda";
      else if (seg === "tickets") label = "Tiket";
      else if (seg === "new") label = "Baru";
      else if (seg === "chat") label = "Chat";
      else if (seg === "knowledge-base") label = "Pusat Bantuan";
      else if (seg === "profile") label = "Profil";
      else if (seg === "admin") label = "Admin";
      else if (seg === "users") label = "Pengguna";
      else if (seg === "departments") label = "Departemen";
      else if (seg === "categories") label = "Kategori";
      else if (seg === "sla") label = "SLA";
      else if (seg === "audit") label = "Audit";
      else if (seg === "updates") label = "Pembaruan";
      else if (seg === "settings") label = "Pengaturan";

      return {
        label,
        href:
          i < segments.length - 1
            ? "/" + segments.slice(0, i + 1).join("/")
            : undefined,
      };
    });
  }, [pathname, breadcrumbs]);

  return (
    <header className="sticky top-0 z-30 flex h-13 items-center border-b border-zinc-200 bg-white/80 backdrop-blur-md px-3 sm:px-6 gap-2 sm:gap-3 dark:border-zinc-800 dark:bg-black/80">
      {/* Mobile Hamburger Menu Toggle */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"))}
        className="flex lg:hidden h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 shrink-0"
        aria-label="Buka Menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Left: Breadcrumbs (Vercel Style) */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
        <nav className="flex items-center gap-1.5 text-xs min-w-0 truncate">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 shrink-0 hidden xs:inline">
            HelpDesk
          </span>
          {autoBreadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <span className="text-zinc-300 dark:text-zinc-700 select-none shrink-0">/</span>
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate text-zinc-500 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search / Command trigger */}
        {searchOpen ? (
          <form onSubmit={handleSearch} className="flex items-center gap-1">
            <Input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari tiket..."
              className="h-7 w-44 sm:w-60 text-xs font-normal"
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              className="rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-zinc-200 bg-zinc-50/70 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-700 transition-colors dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
            aria-label="Cari tiket"
          >
            <Search className="h-3 w-3 text-zinc-400" />
            <span className="hidden sm:inline text-[11px]">Cari tiket...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-zinc-200 bg-white px-1 font-mono text-[9px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
              ⌘K
            </kbd>
          </button>
        )}

        {/* New ticket (NOC, Owner, Admin only) */}
        {["noc", "owner", "admin"].includes((session?.user as any)?.role) && (
          <Button
            size="sm"
            onClick={() => router.push("/tickets/new")}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            className="text-xs shrink-0"
          >
            <span className="hidden sm:inline">Buat Tiket</span>
            <span className="sm:hidden">Tiket</span>
          </Button>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200/80 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100">
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
              <DropdownMenuLabel className="p-0 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Notifikasi
              </DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                >
                  Tandai semua dibaca
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                Tidak ada notifikasi baru
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {notifications.slice(0, 10).map((notif) => (
                  <DropdownMenuItem
                    key={notif.id}
                    className="flex flex-col items-start gap-0.5 py-2.5 px-3 cursor-pointer"
                    onClick={() => {
                      markRead(notif.id);
                      if (notif.ticketId) {
                        router.push(`/tickets/${notif.ticketId}`);
                      }
                    }}
                  >
                    <div className="flex w-full items-start gap-2">
                      {!notif.isRead && (
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-black dark:bg-white" />
                      )}
                      <div className={!notif.isRead ? "" : "ml-3.5"}>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 dark:text-zinc-400">
                          {notif.message}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-400 font-mono">
                          {formatRelativeTime(notif.createdAt)}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
