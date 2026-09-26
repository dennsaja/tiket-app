"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Building2, Pencil, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    color: "#000000",
  });
  const [editFormData, setEditFormData] = React.useState({
    id: "",
    name: "",
    description: "",
    color: "#000000",
    isActive: true,
  });

  const fetchDepartments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("Gagal memuat daftar departemen");
      const data = await res.json();
      setDepartments(data || []);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal membuat departemen");
      }

      toast.success("Departemen baru berhasil dibuat");
      setModalOpen(false);
      setFormData({ name: "", description: "", color: "#000000" });
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (dept: any) => {
    setEditFormData({
      id: dept.id,
      name: dept.name,
      description: dept.description || "",
      color: dept.color || "#000000",
      isActive: dept.isActive ?? true,
    });
    setEditModalOpen(true);
  };

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/departments/${editFormData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFormData.name,
          description: editFormData.description,
          color: editFormData.color,
          isActive: editFormData.isActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui departemen");
      }

      toast.success("Departemen berhasil diperbarui!");
      setEditModalOpen(false);
      fetchDepartments();
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
            <Building2 className="h-5 w-5 text-zinc-900 dark:text-zinc-100" /> Manajemen Departemen
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Kelola departemen kerja dan antrean pembagian tiket teknisi
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Tambah Departemen
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-black">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : departments.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400">
            Belum ada departemen yang dikonfigurasi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/50 border-b border-zinc-200 dark:bg-zinc-950/50 dark:border-zinc-800">
                <TableRow>
                  <TableHead className="w-56 text-[11px] font-medium text-zinc-500">Nama Departemen</TableHead>
                  <TableHead className="text-[11px] font-medium text-zinc-500">Deskripsi</TableHead>
                  <TableHead className="w-32 text-[11px] font-medium text-zinc-500">Warna Aksen</TableHead>
                  <TableHead className="w-28 text-[11px] font-medium text-zinc-500">Status</TableHead>
                  <TableHead className="w-24 text-right text-[11px] font-medium text-zinc-500">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-zinc-200/50 shrink-0"
                          style={{ backgroundColor: dept.color || "#000000" }}
                        />
                        <span>{dept.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">
                      {dept.description || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {dept.color || "#000000"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={dept.isActive ? "success" : "error"}
                        dot
                        className="text-[10px]"
                      >
                        {dept.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(dept)}
                        leftIcon={<Pencil className="h-3 w-3" />}
                        className="text-xs h-7 px-2"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Department Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Tambah Departemen Baru"
        description="Departemen digunakan untuk pengelompokan penugasan tiket dan obrolan teknisi"
      >
        <form onSubmit={handleCreateDepartment} className="space-y-3 pt-2">
          <Input
            label="Nama Departemen"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Contoh: IT Support, Jaringan, Hardware"
            required
          />

          <Textarea
            label="Deskripsi"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Tugas dan cakupan penanganan tiket departemen ini..."
            rows={3}
          />

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Warna Identitas
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-8 w-12 rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer p-0.5 bg-white dark:bg-black"
              />
              <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{formData.color}</span>
            </div>
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
              Simpan Departemen
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Department Modal */}
      <Modal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title="Edit Departemen"
        description="Perbarui informasi nama, deskripsi, warna aksen, atau status departemen"
      >
        <form onSubmit={handleUpdateDepartment} className="space-y-3 pt-2">
          <Input
            label="Nama Departemen"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            placeholder="Contoh: IT Support, Jaringan, Hardware"
            required
          />

          <Textarea
            label="Deskripsi"
            value={editFormData.description}
            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
            placeholder="Tugas dan cakupan penanganan tiket departemen ini..."
            rows={3}
          />

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Warna Identitas
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editFormData.color}
                onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                className="h-8 w-12 rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer p-0.5 bg-white dark:bg-black"
              />
              <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{editFormData.color}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="edit-dept-active"
              checked={editFormData.isActive}
              onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-black"
            />
            <label htmlFor="edit-dept-active" className="text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
              Departemen Aktif
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSaving}
              leftIcon={<Check className="h-3.5 w-3.5" />}
            >
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
