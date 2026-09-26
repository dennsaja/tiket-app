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
      if (!res.ok) throw new Error("Failed to load categories");
      const data = await res.json();
      setCategories(data || []);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
        throw new Error(err.error || "Failed to create category");
      }

      toast.success("Category created successfully");
      setCatModalOpen(false);
      setCatForm({ name: "", description: "", departmentId: "" });
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSavingCat(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-indigo-600" /> Kategori &amp; Subkategori
          </h1>
          <p className="text-xs text-gray-500">
            Kelola taksonomi klasifikasi tiket untuk pengelompokan kendala
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCatModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Tambah Kategori
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-xs text-gray-400">
          Belum ada kategori yang dikonfigurasi.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between border-b border-gray-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{cat.name}</h3>
                  <p className="text-xs text-gray-500">{cat.description || "Tanpa deskripsi"}</p>
                </div>
                <Badge variant={cat.isActive ? "success" : "error"} className="text-[10px]">
                  {cat.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>

              {/* Subcategories list */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Subkategori ({cat.subcategories?.length || 0})
                </span>
                {cat.subcategories && cat.subcategories.length > 0 ? (
                  <div className="space-y-1">
                    {cat.subcategories.map((sub: any) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded px-2 py-1"
                      >
                        <CornerDownRight className="h-3 w-3 text-gray-400" />
                        <span>{sub.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Belum ada subkategori</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
      <Modal
        open={catModalOpen}
        onOpenChange={setCatModalOpen}
        title="Tambah Kategori"
        description="Buat kategori klasifikasi tiket baru"
      >
        <form onSubmit={handleCreateCategory} className="space-y-3 pt-2">
          <Input
            label="Nama Kategori"
            value={catForm.name}
            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            placeholder="Contoh: Hardware / Software / Jaringan"
            required
          />

          <Textarea
            label="Deskripsi"
            value={catForm.description}
            onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
            placeholder="Cakupan masalah yang masuk kategori ini..."
            rows={3}
          />

          {departments.length > 0 && (
            <Select
              label="Departemen Terkait"
              value={catForm.departmentId || "none"}
              onValueChange={(val) => setCatForm({ ...catForm, departmentId: val === "none" ? "" : val })}
              options={[
                { value: "none", label: "Tidak Ada (Umum)" },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
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
