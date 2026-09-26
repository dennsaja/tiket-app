"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Plus, X } from "lucide-react";
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
    return segments.map((seg, i) => ({
      label: seg
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      href:
        i < segments.length - 1
          ? "/" + segments.slice(0, i + 1).join("/")
          : undefined,
    }));
  }, [pathname, breadcrumbs]);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center border-b border-gray-200 bg-white px-4 gap-4">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <nav className="flex items-center gap-1 text-sm min-w-0">
          {autoBreadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="text-gray-300 select-none">/</span>
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-gray-900">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search */}
        {searchOpen ? (
          <form onSubmit={handleSearch} className="flex items-center gap-1">
            <Input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari tiket..."
              className="h-7 w-48 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Cari"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}

        {/* New ticket */}
        <Button
          size="sm"
          onClick={() => router.push("/tickets/new")}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          className="hidden sm:inline-flex"
        >
          Buat Tiket
        </Button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">
                Notifikasi
              </DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Tandai semua dibaca
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                Tidak ada notifikasi
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {notifications.slice(0, 10).map((notif) => (
                  <DropdownMenuItem
                    key={notif.id}
                    className="flex flex-col items-start gap-0.5 py-2"
                    onClick={() => {
                      markRead(notif.id);
                      if (notif.ticketId) {
                        router.push(`/tickets/${notif.ticketId}`);
                      }
                    }}
                  >
                    <div className="flex w-full items-start gap-2">
                      {!notif.isRead && (
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                      )}
                      <div className={!notif.isRead ? "" : "ml-3.5"}>
                        <p className="text-xs font-medium text-gray-900">
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-400">
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

        {/* User avatar */}
        <Avatar
          name={session?.user?.name || "User"}
          src={session?.user?.image}
          size="sm"
          className="cursor-pointer"
        />
      </div>
    </header>
  );
}
