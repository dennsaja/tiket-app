"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const registerSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter"),
    email: z.string().email("Format email tidak valid"),
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Harus mengandung huruf besar, huruf kecil, dan angka"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

function VercelLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 76 65"
      fill="currentColor"
      className={className}
    >
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    { label: "8+ karakter", ok: password.length >= 8 },
    { label: "Huruf besar", ok: /[A-Z]/.test(password) },
    { label: "Huruf kecil", ok: /[a-z]/.test(password) },
    { label: "Angka", ok: /\d/.test(password) },
  ];
  const strength = checks.filter((c) => c.ok).length;
  const strengthColors = ["", "bg-red-500", "bg-amber-500", "bg-yellow-500", "bg-emerald-500"];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= strength ? strengthColors[strength] : "bg-zinc-200 dark:bg-zinc-800"
            )}
          />
        ))}
      </div>
      {password && (
        <div className="flex flex-wrap gap-2">
          {checks.map((check) => (
            <span
              key={check.label}
              className={cn(
                "flex items-center gap-0.5 text-[10px]",
                check.ok ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"
              )}
            >
              <CheckCircle className="h-2.5 w-2.5" />
              {check.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch("password", "");

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(json.error || "Pendaftaran gagal. Silakan coba lagi.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setServerError("Kesalahan jaringan. Silakan coba lagi.");
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-black px-4 font-sans">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
              <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Akun berhasil dibuat!</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Mengalihkan Anda ke halaman login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-black px-4 py-8 font-sans">
      <div className="w-full max-w-sm">
        {/* Logo (Vercel Style) */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black shadow-xs">
            <VercelLogo className="h-5 w-5" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Buat Akun Baru</h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Daftar untuk mengakses layanan helpdesk &amp; tiket
            </p>
          </div>
        </div>

        {/* Form card (Vercel Style) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-black">
          {serverError && (
            <Alert variant="error" className="mb-4 text-xs" onClose={() => setServerError(null)}>
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Nama Lengkap"
              placeholder="Budi Pratama"
              autoComplete="name"
              error={errors.name?.message}
              required
              {...register("name")}
            />

            <Input
              label="Alamat Email"
              type="email"
              placeholder="budi@perusahaan.com"
              autoComplete="email"
              error={errors.email?.message}
              required
              {...register("email")}
            />

            <div>
              <Input
                label="Kata Sandi"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.password?.message}
                required
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="pointer-events-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                }
                {...register("password")}
              />
              <PasswordStrengthBar password={password} />
            </div>

            <Input
              label="Konfirmasi Kata Sandi"
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="pointer-events-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              }
              {...register("confirmPassword")}
            />

            <Button
              type="submit"
              className="w-full text-xs h-9"
              isLoading={isSubmitting}
            >
              Daftar Akun
            </Button>
          </form>
        </div>

        {/* Login link */}
        <p className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Sudah memiliki akun?{" "}
          <Link
            href="/login"
            className="font-medium text-black hover:underline dark:text-white"
          >
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
