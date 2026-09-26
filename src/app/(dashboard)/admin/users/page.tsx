"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { Plus, Search, UserCheck, UserX, Shield, Users as UsersIcon } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [isLoading, setIsLoading] = React.useState(true);

  // New user modal
  const [modalOpen, setModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    password: "",
    role: "agent" as "admin" | "agent" | "user",
    departmentId: "",
  });

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "20",
      });
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.data || []);
      setTotal(data.meta?.total || 0);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, roleFilter]);

  React.useEffect(() => {
    fetchUsers();
    fetch("/api/departments")
      .then((r) => r.json())
      .then(setDepartments)
      .catch(() => {});
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      };
      if (formData.departmentId && formData.departmentId !== "none") {
        payload.departmentId = formData.departmentId;
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }

      toast.success("User created successfully");
      setModalOpen(false);
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "agent",
        departmentId: "",
      });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }

      toast.success(currentActive ? "User deactivated" : "User activated");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-indigo-600" /> Manajemen Pengguna
          </h1>
          <p className="text-xs text-gray-500">
            Kelola akun administrator, teknisi support, dan pengguna/pelapor
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Tambah Pengguna
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-xs flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari berdasarkan nama atau email..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={roleFilter}
            onValueChange={(val) => {
              setRoleFilter(val);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Semua Peran" },
              { value: "admin", label: "Administrator" },
              { value: "agent", label: "Teknisi" },
              { value: "user", label: "Pelapor" },
            ]}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            Tidak ada pengguna yang cocok dengan kriteria pencarian.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/75 border-b border-gray-200">
              <TableRow>
                <TableHead className="text-xs font-semibold text-gray-600">Pengguna</TableHead>
                <TableHead className="w-28 text-xs font-semibold text-gray-600">Peran</TableHead>
                <TableHead className="w-40 text-xs font-semibold text-gray-600">Departemen</TableHead>
                <TableHead className="w-24 text-xs font-semibold text-gray-600">Status</TableHead>
                <TableHead className="w-36 text-xs font-semibold text-gray-600">Login Terakhir</TableHead>
                <TableHead className="w-28 text-right text-xs font-semibold text-gray-600">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="hover:bg-gray-50/80">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={u.name}
                        src={u.avatarUrl}
                        size="sm"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{u.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        u.role === "admin"
                          ? "purple"
                          : u.role === "agent"
                          ? "indigo"
                          : "default"
                      }
                      className="capitalize text-[10px]"
                    >
                      {u.role === "admin" ? "Administrator" : u.role === "agent" ? "Teknisi" : "Pelapor"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-gray-600">
                    {u.department?.name || "—"}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={u.isActive ? "success" : "error"}
                      className="text-[10px]"
                    >
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-gray-400">
                    {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : "Belum pernah"}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(u.id, u.isActive)}
                      className={`text-xs h-7 px-2 ${
                        u.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > 20 && (
          <div className="border-t border-gray-200 px-4 py-3">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 20)}
              totalItems={total}
              itemsPerPage={20}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Tambah Pengguna Baru"
        description="Buat akun untuk administrator, teknisi support, atau pelapor"
      >
        <form onSubmit={handleCreateUser} className="space-y-3 pt-2">
          <Input
            label="Nama Lengkap"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Budi Santoso"
            required
          />

          <Input
            label="Alamat Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="nama@perusahaan.com"
            required
          />

          <Input
            label="Kata Sandi Awal"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Minimal 8 karakter dengan huruf & angka"
            required
          />

          <Select
            label="Peran / Role"
            value={formData.role}
            onValueChange={(val: any) => setFormData({ ...formData, role: val })}
            options={[
              { value: "user", label: "Pelapor (Pengguna)" },
              { value: "agent", label: "Teknisi (Support Staff)" },
              { value: "admin", label: "Administrator (Akses Penuh)" },
            ]}
          />

          {departments.length > 0 && (
            <Select
              label="Departemen"
              value={formData.departmentId || "none"}
              onValueChange={(val) => setFormData({ ...formData, departmentId: val === "none" ? "" : val })}
              options={[
                { value: "none", label: "Tidak Ada" },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}

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
              Buat Akun
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
