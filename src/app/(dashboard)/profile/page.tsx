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
import { Spinner } from "@/components/ui/spinner";
import { User, Lock, Mail, Phone, Shield, Save } from "lucide-react";
import toast from "react-hot-toast";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
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
        })
        .catch(() => {});
    }
  }, [userId, resetProfile]);

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
        throw new Error(err.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully");
      await update();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
        throw new Error(err.error || "Failed to update password");
      }

      toast.success("Password changed successfully");
      resetPassword();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-gray-200 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Profil Pengguna</h1>
        <p className="text-xs text-gray-500">
          Kelola pengaturan akun, informasi kontak, dan kata sandi Anda
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs flex items-center gap-4">
        <Avatar
          name={user?.name || "User"}
          src={user?.image}
          size="lg"
          className="h-14 w-14 text-base"
        />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">{user?.name}</h2>
            <Badge
              variant={userRole === "admin" ? "purple" : userRole === "agent" ? "indigo" : "default"}
              className="capitalize"
            >
              {userRole === "admin" ? "Administrator" : userRole === "agent" ? "Teknisi" : "Pelapor"}
            </Badge>
          </div>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSubmitProfile(onProfileSubmit)}>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2 flex items-center gap-1.5">
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
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2 flex items-center gap-1.5">
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
