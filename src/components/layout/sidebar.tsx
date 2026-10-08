"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Ticket,
  BookOpen,
  Users,
  Building2,
  FolderOpen,
  Timer,
  ScrollText,
  Settings,
  LogOut,
  User,
  ChevronDown,
  ClipboardList,
  Shield,
  Menu,
  X,
  ArrowUpCircle,
  MessagesSquare,
  MapPin,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  agentOnly?: boolean;
  adminStaffOnly?: boolean;
  exact?: boolean;
}

const mainNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Beranda",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: "/tickets", label: "Semua Tiket", icon: Ticket },
  { href: "/tickets?mine=true", label: "Tiket Saya", icon: ClipboardList, agentOnly: true },
  { href: "/admin/map", label: "Peta Teknisi Live", icon: MapPin, adminStaffOnly: true },
  { href: "/chat", label: "Chat Tim", icon: MessagesSquare, agentOnly: true },
  { href: "/knowledge-base", label: "Pusat Bantuan", icon: BookOpen },
];

const adminNavItems: NavItem[] = [
  { href: "/admin/map", label: "Peta Teknisi Live", icon: MapPin },
  { href: "/admin/users", label: "Pengguna", icon: Users },
  { href: "/admin/departments", label: "Departemen", icon: Building2 },
  { href: "/admin/categories", label: "Kategori", icon: FolderOpen },
  { href: "/admin/sla", label: "Kebijakan SLA", icon: Timer },
  { href: "/admin/audit", label: "Log Aktivitas", icon: ScrollText },
  { href: "/admin/updates", label: "Pembaruan Sistem", icon: ArrowUpCircle },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
];

function NavLink({
  item,
  collapsed,
  onClick,
}: {
  item: NavItem;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href.split("?")[0]);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "sidebar-item",
        isActive && "active"
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

// Vercel Triangle Icon
function VercelLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 76 65"
      fill="currentColor"
      className={cn("h-4 w-4", className)}
    >
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const isNoc = role === "noc";
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isAgent = role === "agent";
  const isStaff = isNoc || isOwner || isAdmin || isAgent;
  const canAccessAdmin = isNoc || isOwner;
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const roleLabel =
    role === "noc"
      ? "NOC Administrator"
      : role === "owner"
      ? "Owner"
      : role === "admin"
      ? "Administrator"
      : role === "agent"
      ? "Teknisi"
      : "Pelapor";

  const canViewMap = isNoc || isOwner || isAdmin;

  const filteredMain = mainNavItems.filter((item) => {
    if (item.agentOnly && !isStaff) return false;
    if (item.adminStaffOnly && !canViewMap) return false;
    return true;
  });

  const filteredAdmin = adminNavItems.filter((item) => {
    if (item.href === "/admin/updates" && !isNoc) return false;
    return true;
  });

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex h-full flex-col bg-white dark:bg-black">
      {/* Logo Header (Vercel Style) */}
      <div className="flex h-13 items-center gap-2.5 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-black text-white dark:bg-white dark:text-black shadow-xs">
          <VercelLogo className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-xs tracking-tight text-zinc-900 dark:text-zinc-100">HelpDesk</span>
          <span className="text-[10px] font-mono rounded bg-zinc-100 px-1 py-0.2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            PRO
          </span>
        </div>
      </div>

      {/* Quick Create Ticket Action (NOC, Owner, Admin only) */}
      {canAccessAdmin || isAdmin ? (
        <div className="p-2.5 pb-0">
          <Link
            href="/tickets/new"
            onClick={onLinkClick}
            className="flex items-center justify-center gap-1.5 w-full rounded-md bg-black text-white py-1.5 px-3 text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            <span>+ Buat Tiket Baru</span>
          </Link>
        </div>
      ) : null}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
        <div className="space-y-0.5">
          {filteredMain.map((item) => (
            <NavLink key={item.href} item={item} onClick={onLinkClick} />
          ))}
        </div>

        {canAccessAdmin && (
          <div className="pt-4">
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {isNoc ? "NOC Admin" : "Owner Panel"}
            </p>
            <div className="space-y-0.5">
              {filteredAdmin.map((item) => (
                <NavLink key={item.href} item={item} onClick={onLinkClick} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              <Avatar
                name={session?.user?.name || "User"}
                src={session?.user?.image}
                size="sm"
                className="border border-zinc-200 dark:border-zinc-800"
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {session?.user?.name}
                </p>
                <p className="truncate text-[10px] text-zinc-500 capitalize">
                  {roleLabel}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>
              {session?.user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                Profil Saya
              </Link>
            </DropdownMenuItem>
            {canAccessAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin/users" className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" />
                  Panel Manajemen
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  React.useEffect(() => {
    const handleToggle = () => setMobileOpen((prev) => !prev);
    window.addEventListener("toggle-mobile-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-mobile-sidebar", handleToggle);
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-64 max-w-[80vw] flex-col bg-white dark:bg-black z-10 border-r border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <SidebarContent onLinkClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
