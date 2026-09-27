"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Plus,
  FolderOpen,
  Tag,
  CornerDownRight,
  Pencil,
  Trash2,
  PlusCircle,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";

type Subcategory = {
  id: string;
  name: string;
  isActive: boolean;
  categoryId: string;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  subcategories: Subcategory[];
};

const EMPTY_CAT_FORM = { name: "", description: "", departmentId: "" };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Create Category Modal
  const [catModalOpen, setCatModalOpen] = React.useState(false);
  const [isSavingCat, setIsSavingCat] = React.useState(false);
  const [catForm, setCatForm] = React.useState(EMPTY_CAT_FORM);

  // Edit Category Modal
  const [editCatTarget, setEditCatTarget] = React.useState<Category | null>(null);
  const [editCatForm, setEditCatForm] = React.useState(EMPTY_CAT_FORM);
  const [isSavingEditCat, setIsSavingEditCat] = React.useState(false);

  // Delete Category Confirm
  const [deleteCatTarget, setDeleteCatTarget] = React.useState<Category | null>(null);
  const [isDeletingCat, setIsDeletingCat] = React.useState(false);

  // Add Subcategory Modal
  const [addSubTarget, setAddSubTarget] = React.useState<Category | null>(null);
  const [subName, setSubName] = React.useState("");
  const [isSavingSub, setIsSavingSub] = React.useState(false);

  // Edit Subcategory Modal
  const [editSubTarget, setEditSubTarget] = React.useState<{ cat: Category; sub: Subcategory } | null>(null);
  const [editSubName, setEditSubName] = React.useState("");
  const [isSavingEditSub, setIsSavingEditSub] = React.useState(false);

  // Delete Subcategory Confirm
  const [deleteSubTarget, setDeleteSubTarget] = React.useState<{ cat: Category; sub: Subcategory } | null>(null);
  const [isDeletingSub, setIsDeletingSub] = React.useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchAll = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [catRes, deptRes] = await Promise.all([
        fetch("/api/categories?all=true"),
        fetch("/api/departments"),
      ]);
      const catData = await catRes.json();
      const deptData = await deptRes.json();
      setCategories(catData || []);
      setDepartments(deptData || []);
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Create Category ───────────────────────────────────────────────────────────

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCat(true);
    try {
      const payload: any = { name: catForm.name, description: catForm.description };
      if (catForm.departmentId && catForm.departmentId !== "none") {
        payload.departmentId = catForm.departmentId;
      }
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal membuat kategori");
      toast.success("Kategori berhasil dibuat");
      setCatModalOpen(false);
      setCatForm(EMPTY_CAT_FORM);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingCat(false);
    }
  };

  // ── Edit Category ─────────────────────────────────────────────────────────────

  const openEditCat = (cat: Category) => {
    setEditCatTarget(cat);
    setEditCatForm({
      name: cat.name,
      description: cat.description || "",
      departmentId: cat.departmentId || "",
    });
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatTarget) return;
    setIsSavingEditCat(true);
    try {
      const payload: any = {
        name: editCatForm.name,
        description: editCatForm.description,
        departmentId: editCatForm.departmentId && editCatForm.departmentId !== "none"
          ? editCatForm.departmentId
          : null,
      };
      const res = await fetch(`/api/categories/${editCatTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal mengupdate kategori");
      toast.success("Kategori berhasil diperbarui");
      setEditCatTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingEditCat(false);
    }
  };

  // ── Delete Category ───────────────────────────────────────────────────────────

  const handleDeleteCategory = async () => {
    if (!deleteCatTarget) return;
    setIsDeletingCat(true);
    try {
      const res = await fetch(`/api/categories/${deleteCatTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal menghapus kategori");
      toast.success("Kategori berhasil dinonaktifkan");
      setDeleteCatTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeletingCat(false);
    }
  };

  // ── Add Subcategory ───────────────────────────────────────────────────────────

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSubTarget) return;
    setIsSavingSub(true);
    try {
      const res = await fetch(`/api/categories/${addSubTarget.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subName }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal menambah subkategori");
      toast.success("Subkategori berhasil ditambahkan");
      setAddSubTarget(null);
      setSubName("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingSub(false);
    }
  };

  // ── Edit Subcategory ──────────────────────────────────────────────────────────

  const openEditSub = (cat: Category, sub: Subcategory) => {
    setEditSubTarget({ cat, sub });
    setEditSubName(sub.name);
  };

  const handleEditSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubTarget) return;
    setIsSavingEditSub(true);
    try {
      const res = await fetch(
        `/api/categories/${editSubTarget.cat.id}/subcategories/${editSubTarget.sub.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editSubName }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Gagal mengupdate subkategori");
      toast.success("Subkategori berhasil diperbarui");
      setEditSubTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingEditSub(false);
    }
  };

  // ── Delete Subcategory ────────────────────────────────────────────────────────

  const handleDeleteSubcategory = async () => {
    if (!deleteSubTarget) return;
    setIsDeletingSub(true);
    try {
      const res = await fetch(
        `/api/categories/${deleteSubTarget.cat.id}/subcategories/${deleteSubTarget.sub.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Gagal menghapus subkategori");
      toast.success("Subkategori berhasil dinonaktifkan");
      setDeleteSubTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeletingSub(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FolderOpen className="h-5 w-5" /> Kategori &amp; Subkategori
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Kelola taksonomi klasifikasi tiket — {categories.length} kategori terdaftar
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

      {/* Category List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
            <Spinner />
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:bg-black">
            Belum ada kategori yang dikonfigurasi.
          </div>
        ) : (
          categories.map((cat) => {
            const isExpanded = expandedIds.has(cat.id);
            const activeSubs = cat.subcategories?.filter((s) => s.isActive) ?? [];

            return (
              <div
                key={cat.id}
                className={`rounded-xl border bg-white dark:bg-black shadow-xs transition-all ${
                  cat.isActive
                    ? "border-zinc-200 dark:border-zinc-800"
                    : "border-zinc-100 dark:border-zinc-900 opacity-60"
                }`}
              >
                {/* Category Row */}
                <div className="flex items-center gap-3 p-3 sm:p-4">
                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(cat.id)}
                    className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    aria-label="Toggle subcategories"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {cat.name}
                      </span>
                      <Badge variant={cat.isActive ? "success" : "default"} dot className="text-[10px]">
                        {cat.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                      {cat.department && (
                        <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 rounded px-1.5 py-0.5 border border-zinc-200/60 dark:border-zinc-700">
                          {cat.department.name}
                        </span>
                      )}
                      {activeSubs.length > 0 && (
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                          <Tag className="h-3 w-3" /> {activeSubs.length} subkategori
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        {cat.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setAddSubTarget(cat); setSubName(""); }}
                      className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      title="Tambah subkategori"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditCat(cat)}
                      className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      title="Edit kategori"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {cat.isActive && (
                      <button
                        type="button"
                        onClick={() => setDeleteCatTarget(cat)}
                        className="rounded-md p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Hapus kategori"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subcategories (expanded) */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-1.5">
                    {activeSubs.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">
                        Belum ada subkategori.{" "}
                        <button
                          type="button"
                          className="text-zinc-600 dark:text-zinc-300 underline font-medium"
                          onClick={() => { setAddSubTarget(cat); setSubName(""); }}
                        >
                          Tambah sekarang
                        </button>
                      </p>
                    ) : (
                      activeSubs.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-2 group"
                        >
                          <CornerDownRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600 shrink-0" />
                          <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                            {sub.name}
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openEditSub(cat, sub)}
                              className="rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Edit subkategori"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteSubTarget({ cat, sub })}
                              className="rounded p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="Hapus subkategori"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => { setAddSubTarget(cat); setSubName(""); }}
                      className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-medium transition-colors"
                    >
                      <PlusCircle className="h-3 w-3" /> Tambah Subkategori
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}

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
            placeholder="Contoh: Masalah Jaringan, CCTV, Internet"
            required
          />
          <Textarea
            label="Deskripsi"
            value={catForm.description}
            onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
            placeholder="Panduan singkat tentang kategori ini..."
            rows={3}
          />
          {departments.length > 0 && (
            <Select
              label="Departemen Terkait"
              value={catForm.departmentId || "none"}
              onValueChange={(val) =>
                setCatForm({ ...catForm, departmentId: val === "none" ? "" : val })
              }
              options={[
                { value: "none", label: "Semua Departemen (Umum)" },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setCatModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" size="sm" isLoading={isSavingCat} leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Simpan Kategori
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        open={!!editCatTarget}
        onOpenChange={(open) => !open && setEditCatTarget(null)}
        title="Edit Kategori"
        description={`Perbarui informasi kategori "${editCatTarget?.name}"`}
      >
        <form onSubmit={handleEditCategory} className="space-y-3 pt-2">
          <Input
            label="Nama Kategori"
            value={editCatForm.name}
            onChange={(e) => setEditCatForm({ ...editCatForm, name: e.target.value })}
            required
          />
          <Textarea
            label="Deskripsi"
            value={editCatForm.description}
            onChange={(e) => setEditCatForm({ ...editCatForm, description: e.target.value })}
            rows={3}
          />
          {departments.length > 0 && (
            <Select
              label="Departemen Terkait"
              value={editCatForm.departmentId || "none"}
              onValueChange={(val) =>
                setEditCatForm({ ...editCatForm, departmentId: val === "none" ? "" : val })
              }
              options={[
                { value: "none", label: "Semua Departemen (Umum)" },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditCatTarget(null)}>
              Batal
            </Button>
            <Button type="submit" size="sm" isLoading={isSavingEditCat} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Category Confirm Modal */}
      <Modal
        open={!!deleteCatTarget}
        onOpenChange={(open) => !open && setDeleteCatTarget(null)}
        title="Hapus Kategori"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Yakin ingin menonaktifkan kategori{" "}
            <strong className="text-zinc-900 dark:text-zinc-100">
              &quot;{deleteCatTarget?.name}&quot;
            </strong>
            ?{" "}
            {deleteCatTarget?.subcategories?.filter((s) => s.isActive).length
              ? `Semua ${deleteCatTarget.subcategories.filter((s) => s.isActive).length} subkategorinya juga akan dinonaktifkan. `
              : ""}
            Tiket yang sudah ada tidak akan terpengaruh.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteCatTarget(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteCategory}
              isLoading={isDeletingCat}
              className="bg-red-600 hover:bg-red-700 text-white"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Ya, Nonaktifkan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Subcategory Modal */}
      <Modal
        open={!!addSubTarget}
        onOpenChange={(open) => !open && setAddSubTarget(null)}
        title={`Tambah Subkategori`}
        description={`Tambah subkategori ke dalam kategori "${addSubTarget?.name}"`}
      >
        <form onSubmit={handleAddSubcategory} className="space-y-3 pt-2">
          <Input
            label="Nama Subkategori"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="Contoh: Kabel Putus, Slow Connection, ONT Rusak"
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddSubTarget(null)}>
              Batal
            </Button>
            <Button type="submit" size="sm" isLoading={isSavingSub} leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Tambah Subkategori
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Subcategory Modal */}
      <Modal
        open={!!editSubTarget}
        onOpenChange={(open) => !open && setEditSubTarget(null)}
        title="Edit Subkategori"
        description={`Ubah nama subkategori "${editSubTarget?.sub.name}"`}
      >
        <form onSubmit={handleEditSubcategory} className="space-y-3 pt-2">
          <Input
            label="Nama Subkategori"
            value={editSubName}
            onChange={(e) => setEditSubName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditSubTarget(null)}>
              Batal
            </Button>
            <Button type="submit" size="sm" isLoading={isSavingEditSub} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Subcategory Confirm Modal */}
      <Modal
        open={!!deleteSubTarget}
        onOpenChange={(open) => !open && setDeleteSubTarget(null)}
        title="Hapus Subkategori"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Yakin ingin menghapus subkategori{" "}
            <strong className="text-zinc-900 dark:text-zinc-100">
              &quot;{deleteSubTarget?.sub.name}&quot;
            </strong>{" "}
            dari kategori <strong>{deleteSubTarget?.cat.name}</strong>? Tiket yang sudah ada tidak akan terpengaruh.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteSubTarget(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteSubcategory}
              isLoading={isDeletingSub}
              className="bg-red-600 hover:bg-red-700 text-white"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
