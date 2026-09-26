"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Plus, FolderOpen, Tag, CornerDownRight } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Category Modal
  const [catModalOpen, setCatModalOpen] = React.useState(false);
  const [isSavingCat, setIsSavingCat] = React.useState(false);
  const [catForm, setCatForm] = React.useState({
    name: "",
    description: "",
    departmentId: "",
  });

  const fetchCategories = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Gagal memuat daftar kategori");
      const data = await res.json();
      setCategories(data || []);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCategories();
    fetch("/api/departments")
      .then((r) => r.json())
      .then(setDepartments)
      .catch(() => {});
  }, [fetchCategories]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCat(true);
    try {
      const payload: any = {
        name: catForm.name,
        description: catForm.description,
      };
      if (catForm.departmentId && catForm.departmentId !== "none") {
        payload.departmentId = catForm.departmentId;
      }

      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal membuat kategori");
      }

      toast.success("Kategori baru berhasil dibuat");
      setCatModalOpen(false);
      setCatForm({ name: "", description: "", departmentId: "" });
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSavingCat(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-zinc-900 dark:text-zinc-100" /> Kategori &amp; Subkategori
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Kelola taksonomi klasifikasi tiket untuk pengelompokan kendala
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCatModalOpen(true)}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Tambah Kategori
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
            <Spinner />
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:bg-black">
            Belum ada kategori yang dikonfigurasi.
          </div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-black space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{cat.name}</h3>
                    <Badge variant={cat.isActive ? "success" : "default"} dot className="text-[10px]">
                      {cat.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {cat.description || "Tidak ada deskripsi"}
                  </p>
                </div>

                {cat.department && (
                  <span className="text-[11px] font-medium text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 rounded-md px-2 py-0.5 border border-zinc-200/60 dark:border-zinc-700 self-start sm:self-auto">
                    Departemen: {cat.department.name}
                  </span>
                )}
              </div>

              {/* Subcategories */}
              {cat.subcategories && cat.subcategories.length > 0 && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2 items-center">
                  <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Subkategori:
                  </span>
                  {cat.subcategories.map((sub: any) => (
                    <span
                      key={sub.id}
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-50 border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      <CornerDownRight className="h-2.5 w-2.5 text-zinc-400" />
                      {sub.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Category Modal */}
      <Modal
        open={catModalOpen}
        onOpenChange={setCatModalOpen}
        title="Tambah Kategori Baru"
        description="Kategori mengelompokkan jenis kendala atau keluhan tiket"
      >
        <form onSubmit={handleCreateCategory} className="space-y-3 pt-2">
          <Input
            label="Nama Kategori"
            value={catForm.name}
            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            placeholder="Contoh: Masalah Jaringan, Software, Akun"
            required
          />

          <Textarea
            label="Deskripsi"
            value={catForm.description}
            onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
            placeholder="Panduan kategori ini..."
            rows={3}
          />

          {departments.length > 0 && (
            <Select
              label="Departemen Terkait"
              value={catForm.departmentId || "none"}
              onValueChange={(val) => setCatForm({ ...catForm, departmentId: val === "none" ? "" : val })}
              options={[
                { value: "none", label: "Semua Departemen (Umum)" },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCatModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSavingCat}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Simpan Kategori
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
