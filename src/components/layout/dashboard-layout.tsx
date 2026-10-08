import * as React from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { TechnicianNotificationManager } from "@/components/notifications/technician-notification-manager";
import { TechnicianGpsBar } from "@/components/technician/technician-gps-bar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  title?: string;
}

export function DashboardLayout({
  children,
  breadcrumbs,
  title,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#fafafa] dark:bg-black font-sans text-zinc-900 dark:text-zinc-100 flex-col">
      <TechnicianNotificationManager />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopNav breadcrumbs={breadcrumbs} title={title} />
          <TechnicianGpsBar />
          <main className="flex-1 p-3 sm:p-5 lg:p-7 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
