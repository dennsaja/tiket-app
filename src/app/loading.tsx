import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Spinner size="lg" />
        <p className="text-xs text-gray-400 font-medium">Loading...</p>
      </div>
    </div>
  );
}
