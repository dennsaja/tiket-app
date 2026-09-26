"use client";

import * as React from "react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { ScrollText, Search, ShieldAlert } from "lucide-react";
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
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.meta?.total || 0);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-indigo-600" /> Security Audit Log
        </h1>
        <p className="text-xs text-gray-500">
          Immutable log of user authentication events, ticket modifications, and administrative operations
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-xs">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by actor email..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No audit log records found.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/75 border-b border-gray-200">
              <TableRow>
                <TableHead className="w-40 text-xs font-semibold text-gray-600">Timestamp</TableHead>
                <TableHead className="w-48 text-xs font-semibold text-gray-600">Actor</TableHead>
                <TableHead className="w-44 text-xs font-semibold text-gray-600">Action</TableHead>
                <TableHead className="w-32 text-xs font-semibold text-gray-600">Target</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Metadata</TableHead>
                <TableHead className="w-28 text-xs font-semibold text-gray-600">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-gray-50/80">
                  <TableCell className="font-mono text-[11px] text-gray-500">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-xs text-gray-900 truncate block max-w-[160px]">
                      {log.actorEmail || "System"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="indigo" className="font-mono text-[10px]">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 font-mono">
                    {log.targetType ? `${log.targetType}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-gray-600 truncate max-w-xs">
                    {log.metadata ? JSON.stringify(log.metadata) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-gray-400">
                    {log.ipAddress || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > 25 && (
          <div className="border-t border-gray-200 px-4 py-3">
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
