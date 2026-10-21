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
    <div className="app-shell flex min-h-screen flex-col font-sans">
      <TechnicianNotificationManager />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopNav breadcrumbs={breadcrumbs} title={title} />
          <TechnicianGpsBar />
          <main id="main-content" className="workspace-main flex-1 min-w-0 w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
