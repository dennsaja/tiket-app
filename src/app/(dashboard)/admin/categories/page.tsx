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
            <FolderOpen className="h-5 w-5 text-indigo-600" /> Categories & Subcategories
          </h1>
          <p className="text-xs text-gray-500">
            Configure ticket classification taxonomies for automated routing
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCatModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-xs text-gray-400">
          No categories configured.
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
                  <p className="text-xs text-gray-500">{cat.description || "No description"}</p>
                </div>
                <Badge variant={cat.isActive ? "success" : "error"} className="text-[10px]">
                  {cat.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Subcategories list */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Subcategories ({cat.subcategories?.length || 0})
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
                  <p className="text-xs text-gray-400 italic">No subcategories</p>
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
        title="Add Category"
        description="Create a primary ticket classification category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-3 pt-2">
          <Input
            label="Category Name"
            value={catForm.name}
            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            placeholder="e.g. Network Connectivity"
            required
          />

          <Textarea
            label="Description"
            value={catForm.description}
            onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
            placeholder="Types of issues covered..."
            rows={3}
          />

          {departments.length > 0 && (
            <Select
              label="Assigned Department"
              value={catForm.departmentId || "none"}
              onValueChange={(val) => setCatForm({ ...catForm, departmentId: val === "none" ? "" : val })}
              options={[
                { value: "none", label: "None (General)" },
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
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSavingCat}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Save Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
