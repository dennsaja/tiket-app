"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, Server, Database, Shield, HardDrive } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminSettingsPage() {
  const [appName, setAppName] = React.useState("HelpDesk");
  const [timezone, setTimezone] = React.useState("Asia/Jakarta");
  const [allowRegistration, setAllowRegistration] = React.useState(true);
  const [autoAssign, setAutoAssign] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("System settings updated successfully");
    }, 400);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-gray-200 pb-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-5 w-5 text-indigo-600" /> System Settings
        </h1>
        <p className="text-xs text-gray-500">
          Configure global application parameters, defaults, and security policies
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* General Settings */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
            General Configuration
          </h2>

          <Input
            label="Application Name"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            required
          />

          <Select
            label="System Timezone"
            value={timezone}
            onValueChange={setTimezone}
            options={[
              { value: "Asia/Jakarta", label: "Asia/Jakarta (UTC+7)" },
              { value: "Asia/Singapore", label: "Asia/Singapore (UTC+8)" },
              { value: "UTC", label: "UTC (Coordinated Universal Time)" },
              { value: "America/New_York", label: "America/New_York (EST/EDT)" },
            ]}
          />
        </div>

        {/* Security & Access */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
            Access Control
          </h2>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-semibold text-gray-900">Allow Public Registration</p>
              <p className="text-[11px] text-gray-500">
                Allow new customers to create support accounts self-service
              </p>
            </div>
            <input
              type="checkbox"
              checked={allowRegistration}
              onChange={(e) => setAllowRegistration(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between py-1 border-t border-gray-100 pt-3">
            <div>
              <p className="text-xs font-semibold text-gray-900">Automated Agent Load-Balancing</p>
              <p className="text-[11px] text-gray-500">
                Automatically assign newly created tickets to agents with lowest active workload
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Environment Status */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
            Environment & Infrastructure Status
          </h2>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-gray-100 bg-gray-50 p-2.5">
              <dt className="text-gray-500 flex items-center gap-1.5 font-medium">
                <Server className="h-3.5 w-3.5 text-indigo-600" /> Operating System
              </dt>
              <dd className="mt-1 font-semibold text-gray-900">Ubuntu 24.04 LTS (LXC)</dd>
            </div>

            <div className="rounded border border-gray-100 bg-gray-50 p-2.5">
              <dt className="text-gray-500 flex items-center gap-1.5 font-medium">
                <Database className="h-3.5 w-3.5 text-indigo-600" /> Database Engine
              </dt>
              <dd className="mt-1 font-semibold text-gray-900">PostgreSQL 16 (Local)</dd>
            </div>

            <div className="rounded border border-gray-100 bg-gray-50 p-2.5">
              <dt className="text-gray-500 flex items-center gap-1.5 font-medium">
                <Shield className="h-3.5 w-3.5 text-green-600" /> Authentication
              </dt>
              <dd className="mt-1 font-semibold text-gray-900">NextAuth v5 (Bcrypt + JWT)</dd>
            </div>

            <div className="rounded border border-gray-100 bg-gray-50 p-2.5">
              <dt className="text-gray-500 flex items-center gap-1.5 font-medium">
                <HardDrive className="h-3.5 w-3.5 text-indigo-600" /> File Storage
              </dt>
              <dd className="mt-1 font-semibold text-gray-900">Local Filesystem (/var/helpdesk)</dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="md"
            isLoading={isSaving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
