"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTicketSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import {
  ArrowLeft,
  Paperclip,
  X,
  Send,
  HelpCircle,
  AlertCircle,
  FileText,
  User,
  MapPin,
  Map,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

type TicketFormData = {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  departmentId?: string;
  categoryId?: string;
  subcategoryId?: string;
  reporterName?: string;
  reporterAddress?: string;
  reporterMapUrl?: string;
};

export default function NewTicketPage() {
  const router = useRouter();
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [files, setFiles] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TicketFormData>({
    resolver: zodResolver(createTicketSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      reporterName: "",
      reporterAddress: "",
      reporterMapUrl: "",
    },
  });

  const selectedDepartmentId = watch("departmentId");
  const selectedCategoryId = watch("categoryId");
  const currentPriority = watch("priority") || "medium";

  // Fetch departments & categories
  React.useEffect(() => {
    async function loadMeta() {
      try {
        const [deptRes, catRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/categories"),
        ]);
        if (deptRes.ok) setDepartments(await deptRes.json());
        if (catRes.ok) setCategories(await catRes.json());
      } catch {
        toast.error("Failed to load departments/categories");
      }
    }
    loadMeta();
  }, []);

  // Filter categories by selected department if any
  const filteredCategories = React.useMemo(() => {
    if (!selectedDepartmentId || selectedDepartmentId === "none") return categories;
    return categories.filter(
      (c) => !c.departmentId || c.departmentId === selectedDepartmentId
    );
  }, [categories, selectedDepartmentId]);

  // Find subcategories for selected category
  const currentCategory = categories.find((c) => c.id === selectedCategoryId);
  const subcategories = currentCategory?.subcategories || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const valid = selected.filter((f) => f.size <= 10 * 1024 * 1024);
      if (valid.length < selected.length) {
        toast.error("Some files exceed 10MB limit and were excluded");
      }
      setFiles((prev) => [...prev, ...valid]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (data: TicketFormData) => {
    setIsSubmitting(true);
    try {
      const payload: any = {
        title: data.title,
        description: data.description,
        priority: data.priority,
      };
      if (data.departmentId && data.departmentId !== "none") {
        payload.departmentId = data.departmentId;
      }
      if (data.categoryId && data.categoryId !== "none") {
        payload.categoryId = data.categoryId;
      }
      if (data.subcategoryId && data.subcategoryId !== "none") {
        payload.subcategoryId = data.subcategoryId;
      }
      if (data.reporterName && data.reporterName.trim()) {
        payload.reporterName = data.reporterName.trim();
      }
      if (data.reporterAddress && data.reporterAddress.trim()) {
        payload.reporterAddress = data.reporterAddress.trim();
      }
      if (data.reporterMapUrl && data.reporterMapUrl.trim()) {
        payload.reporterMapUrl = data.reporterMapUrl.trim();
      }

      // 1. Create ticket
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create ticket");
      }

      const newTicket = await res.json();

      // 2. Upload attachments if any
      if (files.length > 0 && newTicket?.id) {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          await fetch(`/api/tickets/${newTicket.id}/attachments`, {
            method: "POST",
            body: formData,
          });
        }
      }

      toast.success("Ticket submitted successfully!");
      router.push(`/tickets/${newTicket.id}`);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <Link href="/tickets">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
        </Link>
        <div className="h-4 w-px bg-gray-300" />
        <div>
          <h1 className="text-lg font-bold text-gray-900">Create Support Ticket</h1>
          <p className="text-xs text-gray-500">
            Submit an inquiry or report an incident to our technical support team
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
            Ticket Details
          </h2>

          {/* Title */}
          <Input
            label="Subject"
            placeholder="Brief summary of the issue..."
            {...register("title")}
            error={errors.title?.message}
            required
          />

          {/* Description */}
          <Textarea
            label="Description"
            placeholder="Please provide detailed information, error messages, steps to reproduce, or relevant background..."
            rows={6}
            {...register("description")}
            error={errors.description?.message}
            required
          />

          {/* Priority selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              Priority <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer items-center justify-between rounded border p-2.5 transition-all ${
                    currentPriority === p
                      ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      value={p}
                      {...register("priority")}
                      className="sr-only"
                    />
                    <PriorityBadge priority={p} />
                  </div>
                </label>
              ))}
            </div>
            {errors.priority && (
              <p className="text-xs text-red-600">{errors.priority.message}</p>
            )}
          </div>
        </div>

        {/* Categorization & Department */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
            Routing & Categorization
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {departments.length > 0 && (
              <Controller
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <Select
                    label="Department"
                    value={field.value || "none"}
                    onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                    options={[
                      { value: "none", label: "Select Department (Optional)" },
                      ...departments.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                  />
                )}
              />
            )}

            {filteredCategories.length > 0 && (
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    label="Category"
                    value={field.value || "none"}
                    onValueChange={(val) => {
                      field.onChange(val === "none" ? "" : val);
                      setValue("subcategoryId", "");
                    }}
                    options={[
                      { value: "none", label: "Select Category (Optional)" },
                      ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                )}
              />
            )}
          </div>

          {subcategories.length > 0 && (
            <Controller
              control={control}
              name="subcategoryId"
              render={({ field }) => (
                <Select
                  label="Subcategory"
                  value={field.value || "none"}
                  onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                  options={[
                    { value: "none", label: "Select Subcategory (Optional)" },
                    ...subcategories.map((s: any) => ({ value: s.id, label: s.name })),
                  ]}
                />
              )}
            />
          )}
        </div>

        {/* Informasi Pelapor (Opsional) */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Informasi Pelapor & Lokasi (Opsional)
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Lengkapi data kontak PIC dan lokasi on-site untuk mempermudah koordinasi teknisi di lapangan.
            </p>
          </div>

          <div className="space-y-4">
            {/* Nama Pelapor */}
            <Input
              label="Nama Pelapor"
              placeholder="Contoh: Budi Santoso / PT Maju Jaya"
              leftElement={<User className="h-3.5 w-3.5" />}
              {...register("reporterName")}
              error={errors.reporterName?.message}
              helperText="Nama individu atau kontak PIC pelapor"
            />

            {/* Alamat Tertulis */}
            <Textarea
              label="Alamat Tertulis"
              placeholder="Contoh: Gedung Graha Lantai 3, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan"
              rows={3}
              {...register("reporterAddress")}
              error={errors.reporterAddress?.message}
              helperText="Alamat fisik, nomor ruangan/lantai, atau patokan lokasi"
            />

            {/* Lokasi Google Maps */}
            <Input
              label="Lokasi Google Maps"
              placeholder="Contoh: https://maps.app.goo.gl/... atau https://goo.gl/maps/..."
              leftElement={<MapPin className="h-3.5 w-3.5" />}
              {...register("reporterMapUrl")}
              error={errors.reporterMapUrl?.message}
              helperText="Tautan Google Maps agar teknisi dapat membuka rute langsung ke titik lokasi"
            />
          </div>
        </div>

        {/* Attachments Upload Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Attachments (Optional)
            </h2>
            <span className="text-[11px] text-gray-400">Max 10MB per file</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700"
              >
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium truncate max-w-[160px]">{file.name}</span>
                <span className="text-gray-400 text-[10px]">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="ml-1 text-gray-400 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="new-ticket-file"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Paperclip className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Choose Files
            </Button>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/tickets">
            <Button type="button" variant="outline" size="md">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            size="md"
            isLoading={isSubmitting}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Submit Ticket
          </Button>
        </div>
      </form>
    </div>
  );
}
