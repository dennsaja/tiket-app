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
  BarChart3,
  ScrollText,
  Settings,
  LogOut,
  User,
  ChevronDown,
  HeadphonesIcon,
  ClipboardList,
  Shield,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  agentOnly?: boolean;
  exact?: boolean;
}

const mainNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: "/tickets", label: "All Tickets", icon: Ticket },
  { href: "/tickets?mine=true", label: "My Tickets", icon: ClipboardList, agentOnly: true },
  { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
];

const adminNavItems: NavItem[] = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/categories", label: "Categories", icon: FolderOpen },
  { href: "/admin/sla", label: "SLA Policies", icon: Timer },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
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

export function Sidebar() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const isAdmin = role === "admin";
  const isAgent = role === "agent" || role === "admin";
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const filteredMain = mainNavItems.filter((item) => {
    if (item.agentOnly && !isAgent) return false;
    return true;
  });

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-12 items-center gap-2 border-b border-gray-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
          <HeadphonesIcon className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900">HelpDesk</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="space-y-0.5">
          {filteredMain.map((item) => (
            <NavLink key={item.href} item={item} onClick={onLinkClick} />
          ))}
        </div>

        {isAdmin && (
          <div className="pt-4">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Admin
            </p>
            <div className="space-y-0.5">
              {adminNavItems.map((item) => (
                <NavLink key={item.href} item={item} onClick={onLinkClick} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-200 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-gray-100 transition-colors">
              <Avatar
                name={session?.user?.name || "User"}
                src={session?.user?.image}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-gray-900">
                  {session?.user?.name}
                </p>
                <p className="truncate text-[10px] text-gray-500 capitalize">
                  {role}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>
              {session?.user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                Profile
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" />
                  Admin Panel
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed left-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white shadow-sm"
        >
          <Menu className="h-4 w-4 text-gray-600" />
        </button>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-50 flex w-52 flex-col bg-white shadow-xl">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent onLinkClick={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
