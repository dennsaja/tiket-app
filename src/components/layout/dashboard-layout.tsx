import * as React from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";

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
    <div className="flex min-h-screen bg-[#fafafa] dark:bg-black font-sans text-zinc-900 dark:text-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <TopNav breadcrumbs={breadcrumbs} title={title} />
        <main className="flex-1 p-4 lg:p-7 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
