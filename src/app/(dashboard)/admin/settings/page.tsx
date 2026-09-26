"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
      <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Settings className="h-5 w-5 text-zinc-900 dark:text-zinc-100" /> Pengaturan Sistem
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Konfigurasi parameter global aplikasi, default sistem, dan kebijakan akses
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* General Settings */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2">
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
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2">
            Kontrol Akses
          </h2>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Izinkan Pendaftaran Publik</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Izinkan pengguna baru mendaftarkan akun support secara mandiri
              </p>
            </div>
            <input
              type="checkbox"
              checked={allowRegistration}
              onChange={(e) => setAllowRegistration(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-black"
            />
          </div>

          <div className="flex items-center justify-between py-1 border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Penugasan Agen Otomatis (Load-Balancing)</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Otomatis menugaskan tiket baru ke teknisi/agen dengan beban kerja aktif terendah
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-black"
            />
          </div>
        </div>

        {/* Environment Status (Vercel Style) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2">
            Status Lingkungan &amp; Infrastruktur
          </h2>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <dt className="text-zinc-500 flex items-center gap-1.5 font-medium dark:text-zinc-400">
                <Server className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" /> Sistem Operasi
              </dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">Ubuntu 24.04 LTS (LXC)</dd>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <dt className="text-zinc-500 flex items-center gap-1.5 font-medium dark:text-zinc-400">
                <Database className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" /> Mesin Database
              </dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 font-mono">PostgreSQL 16 (Lokal)</dd>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <dt className="text-zinc-500 flex items-center gap-1.5 font-medium dark:text-zinc-400">
                <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Autentikasi
              </dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">NextAuth v5 (Bcrypt + JWT)</dd>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <dt className="text-zinc-500 flex items-center gap-1.5 font-medium dark:text-zinc-400">
                <HardDrive className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" /> Penyimpanan Berkas
              </dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 font-mono">/var/helpdesk</dd>
            </div>
          </dl>
        </div>

        {/* Application Updates Link Card (Vercel Style) */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-5 shadow-xs space-y-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Pembaruan Aplikasi (GitHub Auto-Sync)
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Periksa commit dan versi terbaru langsung dari repositori GitHub resmi.
              </p>
            </div>
            <a
              href="/admin/updates"
              className="inline-flex items-center gap-1.5 rounded-md bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs dark:bg-white dark:text-black dark:hover:bg-zinc-200"
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
