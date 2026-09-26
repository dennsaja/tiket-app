import { db } from "@/lib/db";
import { kbArticles, categories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { BookOpen, FileText, ChevronRight, Eye, ThumbsUp } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Knowledge Base",
};

export default async function KnowledgeBasePage() {
  let articles: any[] = [];
  let categoriesList: any[] = [];

  try {
    [articles, categoriesList] = await Promise.all([
      db.query.kbArticles.findMany({
        where: eq(kbArticles.status, "published"),
        with: {
          category: { columns: { id: true, name: true } },
          author: { columns: { id: true, name: true } },
        },
        orderBy: [desc(kbArticles.views)],
        limit: 20,
      }),
      db.query.categories.findMany({
        where: eq(categories.isActive, true),
      }),
    ]);
  } catch {
    // Graceful fallback during build or when database is empty
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header (Vercel Style) */}
      <div className="text-center py-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black mb-3 shadow-xs">
          <BookOpen className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Pusat Bantuan &amp; FAQ</h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Temukan panduan mandiri, artikel pemecahan masalah teknis, dan jawaban pertanyaan umum seputar sistem.
        </p>
      </div>

      {/* Category Grid */}
      {categoriesList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Jelajahi Berdasarkan Kategori
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categoriesList.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-zinc-200 bg-white p-3.5 hover:border-zinc-400 dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-600 shadow-xs cursor-pointer transition-all"
              >
                <p className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{cat.name}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                  {cat.description || "Artikel dan panduan"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular Articles */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-black">
        <div className="border-b border-zinc-200 px-4 py-3 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50">
          <h2 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Artikel Populer &amp; Panduan Pilihan
          </h2>
        </div>

        {articles.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Belum ada artikel yang dipublikasikan saat ini.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {articles.map((art) => (
              <div
                key={art.id}
                className="flex items-center justify-between p-4 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{art.title}</h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                      {art.excerpt || art.content.slice(0, 100)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-400 font-mono">
                      {art.category && <span>{art.category.name}</span>}
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {art.views} dilihat
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" /> {art.helpfulCount}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
