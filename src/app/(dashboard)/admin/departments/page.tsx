"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Building2 } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    color: "#4f46e5",
  });

  const fetchDepartments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("Failed to load departments");
      const data = await res.json();
      setDepartments(data || []);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
        throw new Error(err.error || "Failed to create department");
      }

      toast.success("Department created successfully");
      setModalOpen(false);
      setFormData({ name: "", description: "", color: "#4f46e5" });
      fetchDepartments();
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
            <Building2 className="h-5 w-5 text-indigo-600" /> Departments
          </h1>
          <p className="text-xs text-gray-500">
            Organize support queues and routing by organizational departments
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add Department
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : departments.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No departments configured.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/75 border-b border-gray-200">
              <TableRow>
                <TableHead className="text-xs font-semibold text-gray-600">Department</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Description</TableHead>
                <TableHead className="w-24 text-xs font-semibold text-gray-600">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id} className="hover:bg-gray-50/80">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: d.color || "#4f46e5" }}
                      />
                      <span className="text-xs font-semibold text-gray-900">{d.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {d.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.isActive ? "success" : "error"} className="text-[10px]">
                      {d.isActive ? "Active" : "Inactive"}
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
        title="Add Department"
        description="Create a new support routing department"
      >
        <form onSubmit={handleCreateDepartment} className="space-y-3 pt-2">
          <Input
            label="Department Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Network Operations"
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Area of responsibility..."
            rows={3}
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Badge Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-8 w-14 rounded border border-gray-300 cursor-pointer"
              />
              <span className="font-mono text-xs text-gray-500">{formData.color}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSaving}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Save Department
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
