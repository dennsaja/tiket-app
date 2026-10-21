"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "@/components/ui/brand-mark";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { ChartPie, Ticket, BookOpen, Users, Building2, FolderOpen, Timer, ScrollText, Settings, LogOut, User, ChevronsRight, ChevronsLeft, ClipboardList, Shield, X, ArrowUpCircle, MessagesSquare, MapPin, Archive, Plus } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  staffOnly?: boolean;
  mapOnly?: boolean;
}
const mainItems: NavItem[] = [
  { href: "/dashboard", label: "Ringkasan", icon: ChartPie },
  { href: "/tickets", label: "Semua tiket", icon: Ticket },
  { href: "/tickets?mine=true", label: "Tiket saya", icon: ClipboardList, staffOnly: true },
  { href: "/admin/map", label: "Peta teknisi", icon: MapPin, mapOnly: true },
  { href: "/chat", label: "Chat tim", icon: MessagesSquare, staffOnly: true },
  { href: "/knowledge-base", label: "Pusat bantuan", icon: BookOpen },
];
const adminItems: NavItem[] = [
  { href: "/admin/users", label: "Pengguna", icon: Users },
  { href: "/admin/departments", label: "Departemen", icon: Building2 },
  { href: "/admin/categories", label: "Kategori", icon: FolderOpen },
  { href: "/admin/sla", label: "Kebijakan SLA", icon: Timer },
  { href: "/admin/audit", label: "Log aktivitas", icon: ScrollText },
  { href: "/admin/backup", label: "Backup & restore", icon: Archive },
  { href: "/admin/updates", label: "Pembaruan sistem", icon: ArrowUpCircle },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
];

function NavLink({ item, compact, onClick }: { item: NavItem; compact: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const path = item.href.split("?")[0];
  const active = path === "/tickets"
    ? pathname.startsWith(path) && (item.href.includes("mine=true") === (search.get("mine") === "true"))
    : pathname === path || pathname.startsWith(path + "/");
  return (
    <Link href={item.href} onClick={onClick} aria-label={item.label} aria-current={active ? "page" : undefined}
      title={compact ? item.label : undefined} className={cn("rail-link", active && "is-active", compact && "is-compact")}>
      <item.icon className="h-5 w-5 shrink-0" />
      {!compact && <span>{item.label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role || "user";
  const isStaff = ["noc", "owner", "admin", "agent"].includes(role);
  const management = ["noc", "owner"].includes(role);
  const canCreate = ["noc", "owner", "admin"].includes(role);
  const [compact, setCompact] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  React.useEffect(() => {
    try { setCompact(localStorage.getItem("helpdesk-sidebar") !== "expanded"); } catch {}
    const toggle = () => setMobileOpen((open) => !open);
    window.addEventListener("toggle-mobile-sidebar", toggle);
    return () => window.removeEventListener("toggle-mobile-sidebar", toggle);
  }, []);
  function toggleCompact() {
    setCompact((current) => {
      try { localStorage.setItem("helpdesk-sidebar", current ? "expanded" : "compact"); } catch {}
      return !current;
    });
  }
  const content = (small: boolean, close?: () => void) => (
    <div className={cn("rail-content", small && "rail-content-compact")}>
      <div className="rail-brand">
        <Link href="/dashboard" onClick={close} aria-label="HelpDesk — Beranda"><BrandMark /></Link>
        {!small && <span className="rail-brand-name">HelpDesk<span>SUPPORT WORKSPACE</span></span>}
      </div>
      {canCreate && <Link href="/tickets/new" onClick={close} className={cn("rail-create", small && "is-compact")} aria-label="Buat tiket baru" title="Buat tiket baru">
        <Plus className="h-5 w-5" />{!small && <span>Buat tiket baru</span>}
      </Link>}
      <nav aria-label="Navigasi utama" className="rail-navigation">
        {mainItems.filter((item) => (!item.staffOnly || isStaff) && (!item.mapOnly || canCreate)).map((item) =>
          <NavLink key={item.href} item={item} compact={small} onClick={close} />
        )}
        {management && <>
          <div className="rail-divider">{!small && <span>{role === "noc" ? "ADMINISTRASI" : "MANAJEMEN"}</span>}</div>
          {adminItems.filter((item) => item.href !== "/admin/updates" || role === "noc").map((item) =>
            <NavLink key={item.href} item={item} compact={small} onClick={close} />
          )}
        </>}
      </nav>
      <div className="rail-footer">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn("rail-user", small && "is-compact")} aria-label="Menu akun" title="Menu akun">
              <Avatar name={session?.user?.name || "User"} src={session?.user?.image} size="sm" />
              {!small && <span className="min-w-0 text-left"><span className="block truncate font-medium">{session?.user?.name || "Akun saya"}</span><span className="block text-xs text-[var(--text-muted)] capitalize">{role === "agent" ? "Teknisi" : role === "user" ? "Pelapor" : role}</span></span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{session?.user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/profile" onClick={close}><User className="h-4 w-4" />Profil saya</Link></DropdownMenuItem>
            {management && <DropdownMenuItem asChild><Link href="/admin/users" onClick={close}><Shield className="h-4 w-4" />Panel manajemen</Link></DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={() => signOut({ callbackUrl: "/login" })}><LogOut className="h-4 w-4" />Keluar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!close && <button type="button" onClick={toggleCompact} className="rail-collapse" aria-label={small ? "Perluas sidebar" : "Ringkas sidebar"} title={small ? "Perluas sidebar" : "Ringkas sidebar"}>
          {small ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /><span>Ringkas menu</span></>}
        </button>}
      </div>
    </div>
  );
  return <>
    <a href="#main-content" className="skip-link">Lewati ke konten</a>
    <aside className={cn("desktop-rail", !compact && "is-expanded")}>{content(compact)}</aside>
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden" />
        <Dialog.Content className="mobile-rail fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] lg:hidden">
          <Dialog.Title className="sr-only">Menu navigasi HelpDesk</Dialog.Title>
          <Dialog.Description className="sr-only">Pilih halaman atau kelola akun Anda.</Dialog.Description>
          <Dialog.Close className="mobile-rail-close" aria-label="Tutup menu"><X className="h-4 w-4" /></Dialog.Close>
          {content(false, () => setMobileOpen(false))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
