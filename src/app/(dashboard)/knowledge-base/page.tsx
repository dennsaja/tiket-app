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
      {/* Header */}
      <div className="text-center py-6 border-b border-gray-200">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3">
          <BookOpen className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base & FAQ</h1>
        <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
          Find self-service guides, troubleshooting articles, and answers to common technical questions
        </p>
      </div>

      {/* Category Grid */}
      {categoriesList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Browse by Category
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categoriesList.map((cat) => (
              <div
                key={cat.id}
                className="rounded-lg border border-gray-200 bg-white p-3 hover:border-indigo-300 hover:shadow-xs cursor-pointer transition-all"
              >
                <p className="text-xs font-semibold text-gray-900">{cat.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                  {cat.description || "Articles and guides"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular Articles */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Featured & Popular Articles
          </h2>
        </div>

        {articles.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No published articles available at this time. Check back soon.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {articles.map((art) => (
              <div
                key={art.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900">{art.title}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                      {art.excerpt || art.content.slice(0, 100)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      {art.category && <span>{art.category.name}</span>}
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {art.views} views
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" /> {art.helpfulCount}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
