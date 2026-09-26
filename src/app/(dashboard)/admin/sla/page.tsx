"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { formatDuration } from "@/lib/utils";
import { Plus, Timer } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminSlaPage() {
  const [policies, setPolicies] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    priority: "high" as any,
    departmentId: "",
    firstResponseMinutes: 120,
    resolutionMinutes: 480,
    useBusinessHours: false,
  });

  const fetchPolicies = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/sla-policies");
      if (!res.ok) throw new Error("Gagal memuat kebijakan SLA");
      const data = await res.json();
      setPolicies(data || []);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPolicies();
    fetch("/api/departments")
      .then((r) => r.json())
      .then(setDepartments)
      .catch(() => {});
  }, [fetchPolicies]);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        priority: formData.priority,
        firstResponseMinutes: Number(formData.firstResponseMinutes),
        resolutionMinutes: Number(formData.resolutionMinutes),
        useBusinessHours: formData.useBusinessHours,
      };
      if (formData.departmentId && formData.departmentId !== "none") {
        payload.departmentId = formData.departmentId;
      }

      const res = await fetch("/api/sla-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal membuat kebijakan SLA");
      }

      toast.success("Kebijakan SLA berhasil dibuat");
      setModalOpen(false);
      setFormData({
        name: "",
        description: "",
        priority: "high",
        departmentId: "",
        firstResponseMinutes: 120,
        resolutionMinutes: 480,
        useBusinessHours: false,
      });
      fetchPolicies();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Timer className="h-5 w-5 text-zinc-900 dark:text-zinc-100" /> Kebijakan Target Waktu SLA
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Konfigurasi batas waktu respons awal dan target resolusi kendala tiket
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Tambah Kebijakan SLA
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-black">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : policies.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400">
            Belum ada kebijakan SLA yang dikonfigurasi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/50 border-b border-zinc-200 dark:bg-zinc-950/50 dark:border-zinc-800">
                <TableRow>
                  <TableHead className="w-48 text-[11px] font-medium text-zinc-500">Nama Kebijakan</TableHead>
                  <TableHead className="w-28 text-[11px] font-medium text-zinc-500">Prioritas</TableHead>
                  <TableHead className="w-36 text-[11px] font-medium text-zinc-500">Departemen</TableHead>
                  <TableHead className="w-36 text-[11px] font-medium text-zinc-500">Target Respons</TableHead>
                  <TableHead className="w-36 text-[11px] font-medium text-zinc-500">Target Resolusi</TableHead>
                  <TableHead className="w-28 text-[11px] font-medium text-zinc-500">Jam Kerja</TableHead>
                  <TableHead className="w-24 text-[11px] font-medium text-zinc-500">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
                      <div>
                        <p>{p.name}</p>
                        {p.description && (
                          <p className="text-[11px] text-zinc-400 font-normal mt-0.5">{p.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.priority ? <PriorityBadge priority={p.priority} /> : <span className="text-zinc-400 text-xs">Semua</span>}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                      {p.department?.name || "Semua"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      {formatDuration(p.firstResponseMinutes)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      {formatDuration(p.resolutionMinutes)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-zinc-500">
                        {p.useBusinessHours ? "9-17 WIB" : "24/7"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "success" : "default"} dot className="text-[10px]">
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Policy Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Tambah Kebijakan SLA Baru"
        description="Tetapkan target durasi waktu penanganan untuk setiap tingkat prioritas kendala"
      >
        <form onSubmit={handleCreatePolicy} className="space-y-3 pt-2">
          <Input
            label="Nama Kebijakan"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Contoh: SLA Server Down (Prioritas Kritis)"
            required
          />

          <Textarea
            label="Deskripsi"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Keterangan kebijakan target waktu..."
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tingkat Prioritas"
              value={formData.priority}
              onValueChange={(val: any) => setFormData({ ...formData, priority: val })}
              options={[
                { value: "critical", label: "Kritis" },
                { value: "high", label: "Tinggi" },
                { value: "medium", label: "Sedang" },
                { value: "low", label: "Rendah" },
              ]}
            />

            {departments.length > 0 && (
              <Select
                label="Departemen"
                value={formData.departmentId || "none"}
                onValueChange={(val) => setFormData({ ...formData, departmentId: val === "none" ? "" : val })}
                options={[
                  { value: "none", label: "Semua Departemen" },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Batas Respons Awal (Menit)"
              type="number"
              min={1}
              value={formData.firstResponseMinutes}
              onChange={(e) => setFormData({ ...formData, firstResponseMinutes: Number(e.target.value) })}
              helperText={`Setara dengan ${formatDuration(formData.firstResponseMinutes)}`}
              required
            />

            <Input
              label="Batas Resolusi (Menit)"
              type="number"
              min={1}
              value={formData.resolutionMinutes}
              onChange={(e) => setFormData({ ...formData, resolutionMinutes: Number(e.target.value) })}
              helperText={`Setara dengan ${formatDuration(formData.resolutionMinutes)}`}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSaving}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Simpan Kebijakan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
