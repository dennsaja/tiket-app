"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Camera,
  Image as ImageIcon,
  X,
  CheckCircle2,
  Upload,
  Layers,
  Wrench,
  CheckCheck,
} from "lucide-react";
import toast from "react-hot-toast";

interface WorkReportModalProps {
  ticketId: string;
  ticketNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted: () => void;
}

interface PhotoItem {
  file: File;
  previewUrl: string;
}

export function WorkReportModal({
  ticketId,
  ticketNumber,
  isOpen,
  onClose,
  onReportSubmitted,
}: WorkReportModalProps) {
  const [summary, setSummary] = React.useState("");
  const [actionTaken, setActionTaken] = React.useState("");
  const [materialsUsed, setMaterialsUsed] = React.useState("");
  const [finalResult, setFinalResult] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [beforePhotos, setBeforePhotos] = React.useState<PhotoItem[]>([]);
  const [afterPhotos, setAfterPhotos] = React.useState<PhotoItem[]>([]);

  const beforeCameraInputRef = React.useRef<HTMLInputElement>(null);
  const beforeGalleryInputRef = React.useRef<HTMLInputElement>(null);
  const afterCameraInputRef = React.useRef<HTMLInputElement>(null);
  const afterGalleryInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddPhotos = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "before" | "after"
  ) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const newItems: PhotoItem[] = selected.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      if (type === "before") {
        setBeforePhotos((prev) => [...prev, ...newItems]);
      } else {
        setAfterPhotos((prev) => [...prev, ...newItems]);
      }
    }
  };

  const removePhoto = (type: "before" | "after", index: number) => {
    if (type === "before") {
      setBeforePhotos((prev) => {
        const item = prev[index];
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return prev.filter((_, i) => i !== index);
      });
    } else {
      setAfterPhotos((prev) => {
        const item = prev[index];
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return prev.filter((_, i) => i !== index);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!summary.trim()) {
      toast.error("Harap isi ringkasan pekerjaan");
      return;
    }
    if (!actionTaken.trim()) {
      toast.error("Harap isi tindakan penanganan yang dilakukan");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("summary", summary.trim());
      formData.append("actionTaken", actionTaken.trim());
      if (materialsUsed.trim()) formData.append("materialsUsed", materialsUsed.trim());
      if (finalResult.trim()) formData.append("finalResult", finalResult.trim());

      beforePhotos.forEach((p, idx) => {
        formData.append(`beforePhoto_${idx}`, p.file);
      });

      afterPhotos.forEach((p, idx) => {
        formData.append(`afterPhoto_${idx}`, p.file);
      });

      const res = await fetch(`/api/tickets/${ticketId}/work-report`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengirimkan laporan kerja");
      }

      toast.success("Laporan kerja berhasil diserahkan! Tiket telah diselesaikan.");
      onReportSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={onClose}
      title={`Laporan Kerja Teknisi — Tiket #${ticketNumber}`}
      description="Lengkapi ringkasan penanganan, material yang digunakan, serta dokumentasi foto sebelum dan sesudah pengerjaan."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2 max-h-[75vh] overflow-y-auto pr-1">
        {/* Ringkasan & Tindakan */}
        <Textarea
          label="Ringkasan Hasil Pekerjaan *"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Contoh: Pemasangan PSB 50 Mbps selesai dan aktif normal / Perbaikan kabel FO putus telah disambung..."
          rows={2}
          required
        />

        <Textarea
          label="Tindakan Penanganan yang Dilakukan *"
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
          placeholder="Contoh: Menarik kabel dropcore 75m, melakukan splicing FO di ODP-02, konfigurasi PPPoE dan WiFi pada ONT..."
          rows={3}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Material / Perangkat Digunakan"
            value={materialsUsed}
            onChange={(e) => setMaterialsUsed(e.target.value)}
            placeholder="Contoh: Dropcore 75m, Fast Connector 2 pcs, Roset 1 pcs..."
            helperText="Catatan pemakaian barang/alat"
          />

          <Input
            label="Hasil Akhir / Pengukuran"
            value={finalResult}
            onChange={(e) => setFinalResult(e.target.value)}
            placeholder="Contoh: RX Power -19.2 dBm, Speedtest 50 Mbps OK..."
            helperText="Data parameter teknis pasca pengerjaan"
          />
        </div>

        {/* Section: Foto Sebelum Pengerjaan */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Foto Sebelum Pengerjaan (Before)</span>
                <span className="text-[10px] text-zinc-400 font-mono">({beforePhotos.length} foto)</span>
              </h4>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Foto kondisi awal lokasi, kabel rusak, redaman tinggi, atau titik penempatan.
              </p>
            </div>

            {/* Inputs & Buttons */}
            <div className="flex items-center gap-1.5">
              <input
                ref={beforeCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleAddPhotos(e, "before")}
                className="hidden"
              />
              <input
                ref={beforeGalleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleAddPhotos(e, "before")}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => beforeCameraInputRef.current?.click()}
                leftIcon={<Camera className="h-3.5 w-3.5 text-blue-600" />}
                className="text-[11px] h-7 px-2"
              >
                Kamera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => beforeGalleryInputRef.current?.click()}
                leftIcon={<ImageIcon className="h-3.5 w-3.5 text-zinc-500" />}
                className="text-[11px] h-7 px-2"
              >
                Galeri
              </Button>
            </div>
          </div>

          {/* Photo Previews */}
          {beforePhotos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
              {beforePhotos.map((item, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-lg overflow-hidden border border-zinc-200 aspect-video bg-zinc-900 dark:border-zinc-700"
                >
                  <img
                    src={item.previewUrl}
                    alt={`Before ${idx}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto("before", idx)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-[11px] text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
              Belum ada foto sebelum pengerjaan.
            </div>
          )}
        </div>

        {/* Section: Foto Sesudah Pengerjaan */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Foto Sesudah Pengerjaan (After)</span>
                <span className="text-[10px] text-zinc-400 font-mono">({afterPhotos.length} foto)</span>
              </h4>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Foto perangkat terpasang rapi, hasil pengukuran redaman normal, tampilan CCTV, dll.
              </p>
            </div>

            {/* Inputs & Buttons */}
            <div className="flex items-center gap-1.5">
              <input
                ref={afterCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleAddPhotos(e, "after")}
                className="hidden"
              />
              <input
                ref={afterGalleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleAddPhotos(e, "after")}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => afterCameraInputRef.current?.click()}
                leftIcon={<Camera className="h-3.5 w-3.5 text-emerald-600" />}
                className="text-[11px] h-7 px-2"
              >
                Kamera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => afterGalleryInputRef.current?.click()}
                leftIcon={<ImageIcon className="h-3.5 w-3.5 text-zinc-500" />}
                className="text-[11px] h-7 px-2"
              >
                Galeri
              </Button>
            </div>
          </div>

          {/* Photo Previews */}
          {afterPhotos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
              {afterPhotos.map((item, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-lg overflow-hidden border border-zinc-200 aspect-video bg-zinc-900 dark:border-zinc-700"
                >
                  <img
                    src={item.previewUrl}
                    alt={`After ${idx}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto("after", idx)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-[11px] text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
              Belum ada foto sesudah pengerjaan.
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<CheckCheck className="h-3.5 w-3.5 text-emerald-500" />}
          >
            Kirim Laporan Kerja &amp; Selesaikan Tiket
          </Button>
        </div>
      </form>
    </Modal>
  );
}
