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
import { Plus, Timer, Clock, ShieldCheck } from "lucide-react";
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
      if (!res.ok) throw new Error("Failed to load SLA policies");
      const data = await res.json();
      setPolicies(data || []);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
        throw new Error(err.error || "Failed to create policy");
      }

      toast.success("SLA policy created successfully");
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
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Timer className="h-5 w-5 text-indigo-600" /> Kebijakan SLA (Service Level Agreement)
          </h1>
          <p className="text-xs text-gray-500">
            Atur target waktu respons pertama dan batas waktu penyelesaian tiket berdasarkan prioritas
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Tambah Kebijakan SLA
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : policies.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            Belum ada kebijakan SLA yang dikonfigurasi.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/75 border-b border-gray-200">
              <TableRow>
                <TableHead className="text-xs font-semibold text-gray-600">Nama Kebijakan</TableHead>
                <TableHead className="w-28 text-xs font-semibold text-gray-600">Prioritas</TableHead>
                <TableHead className="w-36 text-xs font-semibold text-gray-600">Respons Pertama</TableHead>
                <TableHead className="w-36 text-xs font-semibold text-gray-600">Resolusi</TableHead>
                <TableHead className="w-32 text-xs font-semibold text-gray-600">Jam Operasional</TableHead>
                <TableHead className="w-24 text-xs font-semibold text-gray-600">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={p.id} className="hover:bg-gray-50/80">
                  <TableCell>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{p.name}</p>
                      <p className="text-[11px] text-gray-500">{p.description || "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={p.priority} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-700">
                    {formatDuration(p.firstResponseMinutes)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-700">
                    {formatDuration(p.resolutionMinutes)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.useBusinessHours ? "indigo" : "default"} className="text-[10px]">
                      {p.useBusinessHours ? "Jam Kerja (Sen-Jum)" : "24/7 Non-Stop"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "success" : "error"} className="text-[10px]">
                      {p.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Tambah Kebijakan SLA"
        description="Konfigurasi target waktu penanganan tiket"
      >
        <form onSubmit={handleCreatePolicy} className="space-y-3 pt-2">
          <Input
            label="Nama Kebijakan"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Contoh: SLA Kritis 4 Jam"
            required
          />

          <Select
            label="Target Prioritas"
            value={formData.priority}
            onValueChange={(val: any) => setFormData({ ...formData, priority: val })}
            options={[
              { value: "critical", label: "Kritis" },
              { value: "high", label: "Tinggi" },
              { value: "medium", label: "Sedang" },
              { value: "low", label: "Rendah" },
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Respons Pertama (menit)"
              type="number"
              value={formData.firstResponseMinutes}
              onChange={(e) => setFormData({ ...formData, firstResponseMinutes: parseInt(e.target.value) || 0 })}
              required
            />
            <Input
              label="Resolusi Selesai (menit)"
              type="number"
              value={formData.resolutionMinutes}
              onChange={(e) => setFormData({ ...formData, resolutionMinutes: parseInt(e.target.value) || 0 })}
              required
            />
          </div>

          <Textarea
            label="Deskripsi"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Keterangan kebijakan SLA..."
            rows={2}
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="use-business-hours"
              checked={formData.useBusinessHours}
              onChange={(e) => setFormData({ ...formData, useBusinessHours: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="use-business-hours" className="text-xs text-gray-700 cursor-pointer">
              Hitung durasi hanya pada jam kerja operasional (09:00 - 17:00 Senin - Jumat)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
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
