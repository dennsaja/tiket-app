"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Lock, Save, Camera, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";

const profileSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi"),
    newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const user = session?.user;
  const userRole = (user as any)?.role || "user";
  const userId = user?.id;

  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null | undefined>(user?.image);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Load user data
  React.useEffect(() => {
    if (userId) {
      fetch(`/api/users/${userId}`)
        .then((r) => r.json())
        .then((data) => {
          resetProfile({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
          });
          if (data.avatarUrl) {
            setAvatarUrl(data.avatarUrl);
          }
        })
        .catch(() => {});
    }
  }, [userId, resetProfile]);

  React.useEffect(() => {
    if (user?.image) {
      setAvatarUrl(user.image);
    }
  }, [user?.image]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5MB");
      return;
    }

    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengunggah foto profil");
      }

      const data = await res.json();
      setAvatarUrl(data.avatarUrl);
      await update({ image: data.avatarUrl });
      toast.success("Foto profil berhasil diperbarui!");
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat mengunggah foto");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      const res = await fetch("/api/users/avatar", {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus foto profil");
      }

      setAvatarUrl(null);
      await update({ image: null });
      toast.success("Foto profil berhasil dihapus");
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (!userId) return;
    setIsUpdatingProfile(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui profil");
      }

      toast.success("Profil berhasil diperbarui");
      await update({ name: data.name });
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (!userId) return;
    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui kata sandi");
      }

      toast.success("Kata sandi berhasil diperbarui");
      resetPassword();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "noc":
        return <Badge variant="purple" className="text-[10px]">NOC Admin</Badge>;
      case "owner":
        return <Badge variant="indigo" className="text-[10px]">Owner</Badge>;
      case "admin":
        return <Badge variant="info" className="text-[10px]">Administrator</Badge>;
      case "agent":
        return <Badge variant="assigned" className="text-[10px]">Teknisi</Badge>;
      default:
        return <Badge variant="default" className="text-[10px]">Pelapor</Badge>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Profil Pengguna</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Kelola foto profil, pengaturan akun, informasi kontak, dan kata sandi Anda
        </p>
      </div>

      {/* Profile Overview & Avatar Upload Card (Vercel Style) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:border-zinc-800 dark:bg-black">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Avatar
              name={user?.name || "User"}
              src={avatarUrl}
              size="2xl"
              className="h-16 w-16 text-base border-2 border-zinc-200 dark:border-zinc-800 shadow-xs"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              title="Ganti Foto Profil"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{user?.name}</h2>
              {getRoleBadge(userRole)}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{user?.email}</p>
            <p className="text-[11px] text-zinc-400 mt-1">Format: JPG, PNG, WEBP (Maks 5MB)</p>
          </div>
        </div>

        {/* Avatar Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto pl-20 sm:pl-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isUploadingAvatar}
            leftIcon={<Upload className="h-3.5 w-3.5" />}
            className="text-xs"
          >
            Unggah Foto
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={isUploadingAvatar}
              leftIcon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
              className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Hapus
            </Button>
          )}
        </div>
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSubmitProfile(onProfileSubmit)}>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4 dark:border-zinc-800 dark:bg-black">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Data Pribadi
          </h2>

          <Input
            label="Nama Lengkap"
            {...registerProfile("name")}
            error={profileErrors.name?.message}
            required
          />

          <Input
            label="Alamat Email"
            type="email"
            {...registerProfile("email")}
            error={profileErrors.email?.message}
            required
          />

          <Input
            label="Nomor Telepon / WhatsApp"
            placeholder="+62 812 3456 7890"
            {...registerProfile("phone")}
            error={profileErrors.phone?.message}
          />

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              isLoading={isUpdatingProfile}
              leftIcon={<Save className="h-3.5 w-3.5" />}
            >
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </form>

      {/* Change Password Form */}
      <form onSubmit={handleSubmitPassword(onPasswordSubmit)}>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4 dark:border-zinc-800 dark:bg-black">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Keamanan &amp; Kata Sandi
          </h2>

          <Input
            label="Kata Sandi Saat Ini"
            type="password"
            {...registerPassword("currentPassword")}
            error={passwordErrors.currentPassword?.message}
            required
          />

          <Input
            label="Kata Sandi Baru"
            type="password"
            placeholder="Minimal 8 karakter dengan huruf besar, kecil, & angka"
            {...registerPassword("newPassword")}
            error={passwordErrors.newPassword?.message}
            required
          />

          <Input
            label="Konfirmasi Kata Sandi Baru"
            type="password"
            {...registerPassword("confirmPassword")}
            error={passwordErrors.confirmPassword?.message}
            required
          />

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              variant="outline"
              isLoading={isUpdatingPassword}
              leftIcon={<Lock className="h-3.5 w-3.5" />}
            >
              Perbarui Kata Sandi
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
