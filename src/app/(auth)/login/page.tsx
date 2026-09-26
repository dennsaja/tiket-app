"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email("Format alamat email tidak valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

const errorMessages: Record<string, string> = {
  CredentialsSignin:
    "Email atau kata sandi salah. Silakan periksa kembali data login Anda.",
  AccountLocked:
    "Akun Anda terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi nanti.",
  AccountInactive: "Akun Anda telah dinonaktifkan. Hubungi administrator.",
  default: "Terjadi kesalahan saat masuk. Silakan coba lagi.",
};

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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(
    errorParam ? errorMessages[errorParam] || errorMessages.default : null
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError(
          errorMessages[result.error] || errorMessages.default
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setServerError(errorMessages.default);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-black px-4 font-sans">
      <div className="w-full max-w-sm">
        {/* Logo (Vercel Style) */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black shadow-xs">
            <VercelLogo className="h-5 w-5" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Masuk ke HelpDesk
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Platform layanan tiket &amp; dukungan teknis terpadu
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
              label="Alamat Email"
              type="email"
              placeholder="nama@perusahaan.com"
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
                autoComplete="current-password"
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
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-black"
                  {...register("rememberMe")}
                />
                <label htmlFor="rememberMe" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Ingat saya
                </label>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full text-xs h-9"
              isLoading={isSubmitting}
            >
              Masuk
            </Button>
          </form>
        </div>

        {/* Register link */}
        <p className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Belum memiliki akun?{" "}
          <Link
            href="/register"
            className="font-medium text-black hover:underline dark:text-white"
          >
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
