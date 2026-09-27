"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTicketSchema, ticketTypes } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  Paperclip,
  X,
  Send,
  FileText,
  User,
  Phone,
  MapPin,
  Globe,
  Wrench,
  Video,
  ShieldAlert,
  ClipboardCheck,
  CheckCircle2,
  Users,
  Star,
  Info,
  Layers,
  Sparkles,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

type TicketType = "psb" | "perbaikan_infrastruktur" | "pemasangan_cctv" | "perbaikan_cctv" | "maintenance";

const TICKET_TYPE_OPTIONS = [
  {
    id: "psb",
    title: "PSB (Pemasangan Baru)",
    description: "Instalasi jaringan internet baru ke lokasi pelanggan / kantor",
    icon: Globe,
    color: "blue",
    badge: "Internet",
  },
  {
    id: "perbaikan_infrastruktur",
    title: "Perbaikan Infrastruktur",
    description: "Troubleshooting kabel putus, redaman tinggi, LOS, atau ONT rusak",
    icon: Wrench,
    color: "amber",
    badge: "Troubleshoot",
  },
  {
    id: "pemasangan_cctv",
    title: "Pemasangan CCTV",
    description: "Instalasi kamera CCTV baru, NVR/DVR, dan infrastruktur kabel",
    icon: Video,
    color: "purple",
    badge: "CCTV Baru",
  },
  {
    id: "perbaikan_cctv",
    title: "Perbaikan CCTV",
    description: "Penanganan kamera mati, rekaman harddisk error, atau NVR offline",
    icon: ShieldAlert,
    color: "rose",
    badge: "Troubleshoot",
  },
  {
    id: "maintenance",
    title: "Maintenance Berkala",
    description: "Pembersihan rack, audit redaman, health check UPS & perangkat",
    icon: ClipboardCheck,
    color: "emerald",
    badge: "Pemeliharaan",
  },
];

export default function NewTicketPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const userRole = (session?.user as any)?.role;

  const [selectedType, setSelectedType] = React.useState<TicketType>("psb");
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [technicians, setTechnicians] = React.useState<any[]>([]);
  const [selectedTechIds, setSelectedTechIds] = React.useState<string[]>([]);
  const [leadTechId, setLeadTechId] = React.useState<string>("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Dynamic spec states for each type
  const [psbData, setPsbData] = React.useState({
    bandwidth: "50 Mbps",
    ontModel: "ZTE F609",
    odpCode: "",
    odpPort: "",
    cableLength: "75m",
    scheduledAt: "",
    ontSerialNumber: "",
    notes: "",
  });

  const [infraData, setInfraData] = React.useState({
    issueType: "Redaman Tinggi / LOS",
    rxPower: "-32 dBm",
    affectedLocation: "",
    pppoeAccount: "",
    affectedDevice: "ONT / Dropcore",
    notes: "",
  });

  const [cctvInstallData, setCctvInstallData] = React.useState({
    cameraCount: "4 Titik",
    cameraType: "IP Camera 2MP Full HD (PoE)",
    recorderType: "NVR 8 Channel + HDD 2TB",
    cableType: "Kabel LAN Cat6 + PoE Switch",
    locationScope: "Indoor & Outdoor",
    scheduledAt: "",
    notes: "",
  });

  const [cctvRepairData, setCctvRepairData] = React.useState({
    symptom: "Kamera Mati / Blank",
    troubledCameras: "Kamera 2 (Pintu Utama)",
    deviceModel: "Hikvision / Dahua",
    notes: "",
  });

  const [maintenanceData, setMaintenanceData] = React.useState({
    scope: "Pembersihan Rack & Audit Redaman OTB/ODP",
    period: "Rutin Bulanan",
    targetLocations: "Data Center & ODC Utama",
    notes: "",
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(createTicketSchema) as any,
    defaultValues: {
      ticketType: "psb",
      title: "",
      description: "",
      priority: "medium",
      reporterName: "",
      reporterPhone: "",
      reporterAddress: "",
      reporterMapUrl: "",
    },
  });

  const selectedDepartmentId = watch("departmentId");
  const selectedCategoryId = watch("categoryId");
  const currentPriority = watch("priority") || "medium";
  const reporterNameVal = watch("reporterName");

  // Load departments, categories, and active technicians
  React.useEffect(() => {
    async function loadMeta() {
      try {
        const [deptRes, catRes, techRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/categories"),
          fetch("/api/users?role=agent&perPage=100"),
        ]);
        if (deptRes.ok) setDepartments(await deptRes.json());
        if (catRes.ok) setCategories(await catRes.json());
        if (techRes.ok) {
          const techData = await techRes.json();
          setTechnicians(techData.data || []);
        }
      } catch {
        toast.error("Gagal memuat data pendukung formulir");
      }
    }
    if (authStatus === "authenticated") {
      loadMeta();
    }
  }, [authStatus]);

  // Auto-fill suggested title when type or reporterName changes (if title not custom edited)
  React.useEffect(() => {
    setValue("ticketType", selectedType);
    let typePrefix = "PSB";
    if (selectedType === "perbaikan_infrastruktur") typePrefix = "Perbaikan Internet";
    else if (selectedType === "pemasangan_cctv") typePrefix = "Pasang CCTV";
    else if (selectedType === "perbaikan_cctv") typePrefix = "Perbaikan CCTV";
    else if (selectedType === "maintenance") typePrefix = "Maintenance";

    const name = reporterNameVal?.trim() ? ` - ${reporterNameVal.trim()}` : "";
    setValue("title", `[${typePrefix}]${name}`);
  }, [selectedType, reporterNameVal, setValue]);

  // Filter categories by selected department if any
  const filteredCategories = React.useMemo(() => {
    if (!selectedDepartmentId || selectedDepartmentId === "none") return categories;
    return categories.filter(
      (c) => !c.departmentId || c.departmentId === selectedDepartmentId
    );
  }, [categories, selectedDepartmentId]);

  const currentCategory = categories.find((c) => c.id === selectedCategoryId);
  const subcategories = currentCategory?.subcategories || [];

  const handleTechToggle = (techId: string) => {
    setSelectedTechIds((prev) => {
      if (prev.includes(techId)) {
        const next = prev.filter((id) => id !== techId);
        if (leadTechId === techId) {
          setLeadTechId(next[0] || "");
        }
        return next;
      } else {
        const next = [...prev, techId];
        if (!leadTechId) setLeadTechId(techId);
        return next;
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const valid = selected.filter((f) => f.size <= 10 * 1024 * 1024);
      if (valid.length < selected.length) {
        toast.error("Beberapa berkas melebihi batas 10MB.");
      }
      setFiles((prev) => [...prev, ...valid]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Compile dynamic specData
  const getCompiledSpecData = () => {
    if (selectedType === "psb") return psbData;
    if (selectedType === "perbaikan_infrastruktur") return infraData;
    if (selectedType === "pemasangan_cctv") return cctvInstallData;
    if (selectedType === "perbaikan_cctv") return cctvRepairData;
    if (selectedType === "maintenance") return maintenanceData;
    return {};
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const specData = getCompiledSpecData();
      
      // Auto-populate description if left empty
      let description = data.description?.trim();
      if (!description) {
        description = `Penugasan tiket ${selectedType.toUpperCase()}.\nSpesifikasi: ${JSON.stringify(
          specData,
          null,
          2
        )}`;
      }

      const payload: any = {
        ticketType: selectedType,
        title: data.title.trim(),
        description,
        priority: data.priority,
        assigneeIds: selectedTechIds,
        leadAssigneeId: leadTechId || selectedTechIds[0] || undefined,
        specData,
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
      if (data.reporterPhone && data.reporterPhone.trim()) {
        payload.reporterPhone = data.reporterPhone.trim();
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
        throw new Error(err.error || "Gagal membuat tiket");
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

      toast.success("Tiket dan penugasan teknisi berhasil dibuat!");
      router.push(`/tickets/${newTicket.id}`);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
      setIsSubmitting(false);
    }
  };

  // Auth protection banner for non-creators
  if (authStatus === "loading") {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const canCreate = ["noc", "owner", "admin"].includes(userRole);
  if (!canCreate) {
    return (
      <div className="max-w-xl mx-auto mt-12 rounded-xl border border-red-200 bg-red-50/50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/30">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-red-900 dark:text-red-300">
          Akses Pembuatan Tiket Dibatasi (1 Arah)
        </h2>
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
          Pembuatan tiket baru hanya dapat dilakukan oleh NOC Administrator, Owner, atau Admin.
          Teknisi bertugas menerima penugasan, mengerjakan, dan mengirimkan laporan kerja.
        </p>
        <div className="mt-5">
          <Link href="/tickets">
            <Button size="sm" variant="outline">
              Kembali ke Daftar Tiket
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Link href="/tickets">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
            Kembali
          </Button>
        </Link>
        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>Buat &amp; Tugaskan Tiket Baru</span>
            <span className="text-[10px] font-mono rounded bg-black text-white px-2 py-0.5 dark:bg-white dark:text-black">
              DISPATCHER
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pilih jenis tiket, lengkapi data spesifikasi, tentukan prioritas, dan tugaskan tim teknisi lapangan.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1: Visual Ticket Type Selector */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <div>
              <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                LANGKAH 1
              </span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Pilih Jenis Pekerjaan / Tiket
              </h2>
            </div>
            <span className="text-[11px] text-zinc-500 font-medium">
              Wajib dipilih pertama
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {TICKET_TYPE_OPTIONS.map((opt) => {
              const isSelected = selectedType === opt.id;
              const IconComponent = opt.icon;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setSelectedType(opt.id as TicketType)}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? "border-black bg-zinc-50/90 ring-2 ring-black/5 dark:border-white dark:bg-zinc-900 dark:ring-white/10 shadow-xs"
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between w-full mb-2">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {opt.title}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Dynamic Specification Form Fields */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                LANGKAH 2
              </span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Spesifikasi Teknis &amp; Data Pekerjaan
              </h2>
            </div>
            <span className="text-[10px] font-mono uppercase bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-0.5 rounded">
              {selectedType.replace("_", " ")}
            </span>
          </div>

          {/* DYNAMIC FIELDS: PSB */}
          {selectedType === "psb" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Paket / Bandwidth Internet
                </label>
                <input
                  type="text"
                  value={psbData.bandwidth}
                  onChange={(e) => setPsbData({ ...psbData, bandwidth: e.target.value })}
                  placeholder="Contoh: 20 Mbps, 50 Mbps, 100 Mbps..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Model Perangkat ONT / Modem
                </label>
                <input
                  type="text"
                  value={psbData.ontModel}
                  onChange={(e) => setPsbData({ ...psbData, ontModel: e.target.value })}
                  placeholder="Contoh: ZTE F609, Huawei HG8245H, Fiberhome..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Kode ODP / No Port
                </label>
                <input
                  type="text"
                  value={psbData.odpCode}
                  onChange={(e) => setPsbData({ ...psbData, odpCode: e.target.value })}
                  placeholder="Contoh: ODP-CLG-02 / Port 04"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Estimasi Panjang Kabel Dropcore
                </label>
                <input
                  type="text"
                  value={psbData.cableLength}
                  onChange={(e) => setPsbData({ ...psbData, cableLength: e.target.value })}
                  placeholder="Contoh: 75 meter, 100 meter..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Jadwal Waktu Pemasangan (Opsional)
                </label>
                <input
                  type="datetime-local"
                  value={psbData.scheduledAt}
                  onChange={(e) => setPsbData({ ...psbData, scheduledAt: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Serial Number ONT / MAC (Opsional)
                </label>
                <input
                  type="text"
                  value={psbData.ontSerialNumber}
                  onChange={(e) => setPsbData({ ...psbData, ontSerialNumber: e.target.value })}
                  placeholder="Contoh: ZTEG12345678 / 48:8D:36..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC FIELDS: PERBAIKAN INFRASTRUKTUR */}
          {selectedType === "perbaikan_infrastruktur" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Jenis Gangguan Jaringan
                </label>
                <input
                  type="text"
                  value={infraData.issueType}
                  onChange={(e) => setInfraData({ ...infraData, issueType: e.target.value })}
                  placeholder="Contoh: Redaman Tinggi, Kabel Putus (Cut), ONT Rusak, LOS Merah..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Indikasi Redaman / RX Power (dBm)
                </label>
                <input
                  type="text"
                  value={infraData.rxPower}
                  onChange={(e) => setInfraData({ ...infraData, rxPower: e.target.value })}
                  placeholder="Contoh: -32 dBm, LOS / No Signal, -19 dBm (Normal)..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Titik Lokasi Tiang / ODP Terdampak
                </label>
                <input
                  type="text"
                  value={infraData.affectedLocation}
                  onChange={(e) => setInfraData({ ...infraData, affectedLocation: e.target.value })}
                  placeholder="Contoh: Tiang 14 Jl. Melati / ODP-CLG-01"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  User PPPoE / No Pelanggan
                </label>
                <input
                  type="text"
                  value={infraData.pppoeAccount}
                  onChange={(e) => setInfraData({ ...infraData, pppoeAccount: e.target.value })}
                  placeholder="Contoh: user_budi_01 / CUST-9821"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC FIELDS: PEMASANGAN CCTV */}
          {selectedType === "pemasangan_cctv" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Jumlah Titik Kamera
                </label>
                <input
                  type="text"
                  value={cctvInstallData.cameraCount}
                  onChange={(e) => setCctvInstallData({ ...cctvInstallData, cameraCount: e.target.value })}
                  placeholder="Contoh: 4 Titik, 8 Titik, 16 Titik..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Tipe / Resolusi Kamera
                </label>
                <input
                  type="text"
                  value={cctvInstallData.cameraType}
                  onChange={(e) => setCctvInstallData({ ...cctvInstallData, cameraType: e.target.value })}
                  placeholder="Contoh: IP Camera PoE 2MP / 4MP, Analog HD, PTZ..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Perekam (NVR/DVR) &amp; Kapasitas Harddisk
                </label>
                <input
                  type="text"
                  value={cctvInstallData.recorderType}
                  onChange={(e) => setCctvInstallData({ ...cctvInstallData, recorderType: e.target.value })}
                  placeholder="Contoh: NVR 8 Channel + HDD Surveillance 2TB"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Media Kabel &amp; Transmisi
                </label>
                <input
                  type="text"
                  value={cctvInstallData.cableType}
                  onChange={(e) => setCctvInstallData({ ...cctvInstallData, cableType: e.target.value })}
                  placeholder="Contoh: UTP Cat6 + PoE Switch, Coaxial RG59..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Jadwal Waktu Pemasangan CCTV
                </label>
                <input
                  type="datetime-local"
                  value={cctvInstallData.scheduledAt}
                  onChange={(e) => setCctvInstallData({ ...cctvInstallData, scheduledAt: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Lingkup Area Penempatan
                </label>
                <input
                  type="text"
                  value={cctvInstallData.locationScope}
                  onChange={(e) => setCctvInstallData({ ...cctvInstallData, locationScope: e.target.value })}
                  placeholder="Contoh: Indoor 2 titik, Outdoor tahan cuaca 2 titik"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC FIELDS: PERBAIKAN CCTV */}
          {selectedType === "perbaikan_cctv" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Gejala Kerusakan CCTV
                </label>
                <input
                  type="text"
                  value={cctvRepairData.symptom}
                  onChange={(e) => setCctvRepairData({ ...cctvRepairData, symptom: e.target.value })}
                  placeholder="Contoh: Gambar Mati/Blank, Harddisk Error, NVR Offline..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Titik Kamera Bermasalah
                </label>
                <input
                  type="text"
                  value={cctvRepairData.troubledCameras}
                  onChange={(e) => setCctvRepairData({ ...cctvRepairData, troubledCameras: e.target.value })}
                  placeholder="Contoh: Cam 2 Gerbang Utama, Cam 4 Area Parkir..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Merk / Model Perangkat CCTV
                </label>
                <input
                  type="text"
                  value={cctvRepairData.deviceModel}
                  onChange={(e) => setCctvRepairData({ ...cctvRepairData, deviceModel: e.target.value })}
                  placeholder="Contoh: Hikvision DS-7208HQHI, Dahua NVR4108, dll"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC FIELDS: MAINTENANCE */}
          {selectedType === "maintenance" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Ruang Lingkup Pemeliharaan
                </label>
                <input
                  type="text"
                  value={maintenanceData.scope}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, scope: e.target.value })}
                  placeholder="Contoh: Audit Redaman ODP, Cleaning Rack Server, Health check UPS..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Periode Maintenance
                </label>
                <input
                  type="text"
                  value={maintenanceData.period}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, period: e.target.value })}
                  placeholder="Contoh: Rutin Bulanan, Triwulan, Semesteran, Insidentil..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Target Lokasi / Perangkat
                </label>
                <input
                  type="text"
                  value={maintenanceData.targetLocations}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, targetLocations: e.target.value })}
                  placeholder="Contoh: Data Center Server Lt 2 & ODC Area Cluster B..."
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-black focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Multi-Technician Assignment */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                LANGKAH 3
              </span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Penugasan Tim Teknisi (Bisa Lebih Dari 1 Orang)
              </h2>
            </div>
            <span className="text-xs font-medium text-zinc-500">
              {selectedTechIds.length} Teknisi Dipilih
            </span>
          </div>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Pilih teknisi yang akan bertugas. Anda dapat memilih 2 atau 3 teknisi untuk pengerjaan tim.
            Hanya teknisi yang ditugaskan yang dapat melihat tiket dan mengakses chat tim untuk tiket ini.
          </p>

          {technicians.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-400 italic">
              Belum ada data akun teknisi terdaftar.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {technicians.map((tech) => {
                const isSelected = selectedTechIds.includes(tech.id);
                const isLead = leadTechId === tech.id;
                return (
                  <div
                    key={tech.id}
                    onClick={() => handleTechToggle(tech.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "border-black bg-zinc-50 dark:border-white dark:bg-zinc-900 shadow-xs"
                        : "border-zinc-200 hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={tech.name}
                        src={tech.avatarUrl}
                        size="sm"
                        className="h-7 w-7 text-xs border border-zinc-200 dark:border-zinc-700"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {tech.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">{tech.phone || tech.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => setLeadTechId(tech.id)}
                          className={`p-1 rounded text-[10px] flex items-center gap-1 font-medium transition-colors ${
                            isLead
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold"
                              : "text-zinc-400 hover:text-amber-600"
                          }`}
                          title={isLead ? "Ketua Tim" : "Jadikan Ketua Tim"}
                        >
                          <Star className={`h-3 w-3 ${isLead ? "fill-amber-500 text-amber-500" : ""}`} />
                          {isLead && <span className="text-[9px]">Lead</span>}
                        </button>
                      )}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTechToggle(tech.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-black dark:text-white"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 4: Informasi Pelapor & Lokasi */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              LANGKAH 4
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Informasi Pelapor, Pelanggan &amp; Lokasi On-Site
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nama PIC / Pelanggan"
              placeholder="Contoh: Bapak Hendra / Toko Sumber Makmur"
              leftElement={<User className="h-3.5 w-3.5" />}
              {...register("reporterName")}
              error={errors.reporterName?.message as string | undefined}
            />

            <Input
              label="Nomor Telepon / WhatsApp"
              placeholder="Contoh: 081234567890"
              leftElement={<Phone className="h-3.5 w-3.5" />}
              {...register("reporterPhone")}
              error={errors.reporterPhone?.message as string | undefined}
              helperText="Kontak yang dapat dihubungi teknisi di lapangan"
            />

            <div className="sm:col-span-2">
              <Textarea
                label="Alamat Tertulis &amp; Patokan Lokasi"
                placeholder="Contoh: Jl. Diponegoro No. 45 (Depan Ruko Indomaret), RT 03/05..."
                rows={2}
                {...register("reporterAddress")}
                error={errors.reporterAddress?.message as string | undefined}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Link Google Maps / Titik Koordinat"
                placeholder="Contoh: https://maps.app.goo.gl/... atau https://goo.gl/maps/..."
                leftElement={<MapPin className="h-3.5 w-3.5" />}
                {...register("reporterMapUrl")}
                error={errors.reporterMapUrl?.message as string | undefined}
                helperText="Tautan maps untuk navigasi rute teknisi langsung dari smartphone"
              />
            </div>
          </div>
        </div>

        {/* Step 5: Detail Umum & Prioritas */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              LANGKAH 5
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Detail Subjek, Deskripsi &amp; Prioritas
            </h2>
          </div>

          <Input
            label="Subjek / Judul Tiket"
            placeholder="Judul tiket penugasan..."
            {...register("title")}
            error={errors.title?.message as string | undefined}
            required
          />

          <Textarea
            label="Deskripsi / Catatan Tambahan Khusus Untuk Teknisi"
            placeholder="Tuliskan instruksi teknis, catatan khusus jalur kabel, atau pesan untuk tim teknisi..."
            rows={3}
            {...register("description")}
            error={errors.description?.message as string | undefined}
          />

          {/* Priority selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Tingkat Prioritas <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-2.5 transition-all ${
                    currentPriority === p
                      ? "border-black bg-zinc-50 dark:border-white dark:bg-zinc-900 shadow-xs"
                      : "border-zinc-200 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
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
          </div>

          {/* Departemen & Kategori (Opsional) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {departments.length > 0 && (
              <Controller
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <Select
                    label="Departemen (Opsional)"
                    value={field.value || "none"}
                    onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                    options={[
                      { value: "none", label: "Pilih Departemen" },
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
                    label="Kategori (Opsional)"
                    value={field.value || "none"}
                    onValueChange={(val) => {
                      field.onChange(val === "none" ? "" : val);
                      setValue("subcategoryId", "");
                    }}
                    options={[
                      { value: "none", label: "Pilih Kategori" },
                      ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                )}
              />
            )}
          </div>
        </div>

        {/* Lampiran Berkas (Opsional) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Lampiran Berkas / Surat Tugas (Opsional)
            </h2>
            <span className="text-[11px] text-zinc-400 font-mono">Maks 10MB per berkas</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <FileText className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-medium truncate max-w-[160px]">{file.name}</span>
                <span className="text-zinc-400 text-[10px] font-mono">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="ml-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
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
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Paperclip className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Pilih Berkas
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/tickets">
            <Button type="button" variant="outline" size="md">
              Batal
            </Button>
          </Link>
          <Button
            type="submit"
            size="md"
            isLoading={isSubmitting}
            leftIcon={<Send className="h-3.5 w-3.5" />}
          >
            Buat &amp; Tugaskan Tiket
          </Button>
        </div>
      </form>
    </div>
  );
}
