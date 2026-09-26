"use client";

import * as React from "react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { ScrollText, Search } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminAuditPage() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchLogs = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "25",
      });
      if (search) params.set("actorEmail", search);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat log audit");
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.meta?.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-zinc-900 dark:text-zinc-100" /> Log Audit Keamanan
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Catatan riwayat aktivitas autentikasi pengguna, modifikasi tiket, dan operasi administratif
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-black">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari berdasarkan email aktor..."
            className="pl-8 h-8 text-xs font-normal"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-black">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400">
            Tidak ada riwayat log audit ditemukan.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-zinc-50/50 border-b border-zinc-200 dark:bg-zinc-950/50 dark:border-zinc-800">
              <TableRow>
                <TableHead className="w-40 text-[11px] font-medium text-zinc-500">Waktu</TableHead>
                <TableHead className="w-48 text-[11px] font-medium text-zinc-500">Aktor</TableHead>
                <TableHead className="w-44 text-[11px] font-medium text-zinc-500">Aksi</TableHead>
                <TableHead className="w-32 text-[11px] font-medium text-zinc-500">Target</TableHead>
                <TableHead className="text-[11px] font-medium text-zinc-500">Metadata</TableHead>
                <TableHead className="w-28 text-[11px] font-medium text-zinc-500">Alamat IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-[11px] text-zinc-400">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate block max-w-[160px]">
                      {log.actorEmail || "Sistem"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="indigo" className="font-mono text-[10px]">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                    {log.targetType ? `${log.targetType}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-xs">
                    {log.metadata ? JSON.stringify(log.metadata) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-zinc-400">
                    {log.ipAddress || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > 25 && (
          <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 25)}
              totalItems={total}
              itemsPerPage={25}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
