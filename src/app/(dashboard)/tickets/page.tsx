import { getWebPageData } from "@/lib/web-data/client";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { TicketRow } from "@/components/tickets/ticket-row";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Plus, Ticket as TicketIcon } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Daftar tiket",
};

interface TicketsPageProps {
  searchParams: Promise<{
    page?: string;
    perPage?: string;
    search?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    departmentId?: string;
    categoryId?: string;
    sortBy?: string;
    sortOrder?: string;
    mine?: string;
    view?: string;
    days?: string;
  }>;
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = await searchParams;
  const data = await getWebPageData("tickets", Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
  const { ticketList, totalCount, deptList, catList, agentList, totalPages, page, perPage, canCreate, userRole } = data;

  return (
    <div className="space-y-4">
      {/* Header (Vercel Style) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {params.mine === "true" ? "Tiket Ditugaskan ke Saya" : "Semua Tiket"}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Menampilkan {ticketList.length} dari {totalCount} total tiket
          </p>
        </div>
        {canCreate && (
          <Link href="/tickets/new">
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Buat Tiket Baru
            </Button>
          </Link>
        )}
      </div>

      {/* Filter Component */}
      <TicketFilters
        departments={deptList}
        categories={catList}
        agents={agentList}
      />

      {/* Table Card (Vercel Style) */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-black">
        {ticketList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-400 mb-3">
              <TicketIcon className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Tidak ada tiket ditemukan</h3>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 max-w-sm">
              Tidak ada tiket yang sesuai dengan kriteria filter atau kata kunci pencarian Anda.
            </p>
            {canCreate && (
              <div className="mt-4">
                <Link href="/tickets/new">
                  <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                    Buat Tiket Baru
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/50 border-b border-zinc-200 dark:bg-zinc-950/50 dark:border-zinc-800">
                <TableRow>
                  <TableHead className="w-20 text-[11px] font-medium text-zinc-500">ID</TableHead>
                  <TableHead className="min-w-[240px] text-[11px] font-medium text-zinc-500">Subjek / Judul</TableHead>
                  <TableHead className="w-28 text-[11px] font-medium text-zinc-500">Status</TableHead>
                  <TableHead className="w-24 text-[11px] font-medium text-zinc-500">Prioritas</TableHead>
                  <TableHead className="w-36 text-[11px] font-medium text-zinc-500">Pelapor</TableHead>
                  <TableHead className="w-36 text-[11px] font-medium text-zinc-500">Teknisi</TableHead>
                  <TableHead className="w-32 text-[11px] font-medium text-zinc-500">Batas SLA</TableHead>
                  <TableHead className="w-28 text-[11px] font-medium text-zinc-500">Dibuat</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketList.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalCount}
              itemsPerPage={perPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
