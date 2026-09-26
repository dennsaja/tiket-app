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
      toast.success("Pengaturan sistem berhasil disimpan");
    }, 400);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-gray-200 pb-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-5 w-5 text-indigo-600" /> Pengaturan Sistem
        </h1>
        <p className="text-xs text-gray-500">
          Konfigurasi parameter global aplikasi, default sistem, dan kebijakan akses
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* General Settings */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
            Konfigurasi Umum
          </h2>

          <Input
            label="Nama Aplikasi"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            required
          />

          <Select
            label="Zona Waktu Sistem"
            value={timezone}
            onValueChange={setTimezone}
            options={[
              { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB - UTC+7)" },
              { value: "Asia/Makassar", label: "Asia/Makassar (WITA - UTC+8)" },
              { value: "Asia/Jayapura", label: "Asia/Jayapura (WIT - UTC+9)" },
              { value: "UTC", label: "UTC (Coordinated Universal Time)" },
            ]}
          />
        </div>

        {/* Security & Access */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
            Kontrol Akses
          </h2>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-semibold text-gray-900">Izinkan Pendaftaran Publik</p>
              <p className="text-[11px] text-gray-500">
                Izinkan pengguna baru mendaftarkan akun support secara mandiri
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
              <p className="text-xs font-semibold text-gray-900">Penugasan Agen Otomatis (Load-Balancing)</p>
              <p className="text-[11px] text-gray-500">
                Otomatis menugaskan tiket baru ke teknisi/agen dengan beban kerja aktif terendah
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
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2 dark:border-slate-800">
            Status Lingkungan &amp; Infrastruktur
          </h2>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-gray-100 bg-gray-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <dt className="text-gray-500 flex items-center gap-1.5 font-medium dark:text-gray-400">
                <Server className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Sistem Operasi
              </dt>
              <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">Ubuntu 24.04 LTS (LXC)</dd>
            </div>

            <div className="rounded border border-gray-100 bg-gray-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <dt className="text-gray-500 flex items-center gap-1.5 font-medium dark:text-gray-400">
                <Database className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Mesin Database
              </dt>
              <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">PostgreSQL 16 (Lokal)</dd>
            </div>

            <div className="rounded border border-gray-100 bg-gray-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <dt className="text-gray-500 flex items-center gap-1.5 font-medium dark:text-gray-400">
                <Shield className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> Autentikasi
              </dt>
              <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">NextAuth v5 (Bcrypt + JWT)</dd>
            </div>

            <div className="rounded border border-gray-100 bg-gray-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <dt className="text-gray-500 flex items-center gap-1.5 font-medium dark:text-gray-400">
                <HardDrive className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Penyimpanan Berkas
              </dt>
              <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">Filesystem Lokal (/var/helpdesk)</dd>
            </div>
          </dl>
        </div>

        {/* Application Updates (GitHub Sync) */}
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-5 shadow-xs space-y-3 dark:border-indigo-900/40 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                Pembaruan Aplikasi (GitHub Auto-Sync)
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Periksa commit dan versi terbaru langsung dari repositori GitHub resmi.
              </p>
            </div>
            <a
              href="/admin/updates"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              Buka Pembaruan Sistem &rarr;
            </a>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="md"
            isLoading={isSaving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Simpan Pengaturan
          </Button>
        </div>
      </form>
    </div>
  );
}
