import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Home, LogOut } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 shadow-xs">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Access Restricted</h1>
      <p className="mt-1 text-xs text-gray-500 max-w-sm">
        You do not have the required administrative permissions to view or perform operations on this page.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link href="/dashboard">
          <Button size="md" leftIcon={<Home className="h-4 w-4" />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
