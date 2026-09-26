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
import { HeadphonesIcon, Eye, EyeOff, Lock } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
            <HeadphonesIcon className="h-5 w-5 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">HelpDesk</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Masuk ke akun HelpDesk Anda
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
          {serverError && (
            <Alert variant="error" className="mb-4" onClose={() => setServerError(null)}>
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
                    className="pointer-events-auto"
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
              <div className="mt-1.5 flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Lupa kata sandi?
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                {...register("rememberMe")}
              />
              <label htmlFor="rememberMe" className="text-xs text-gray-600">
                Ingat saya selama 30 hari
              </label>
            </div>

            <Button
              type="submit"
              className="w-full"
              loading={isSubmitting}
              size="lg"
            >
              {isSubmitting ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </div>

        {/* Register link */}
        <p className="mt-4 text-center text-xs text-gray-500">
          Belum memiliki akun?{" "}
          <Link href="/register" className="text-indigo-600 hover:underline font-medium">
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
