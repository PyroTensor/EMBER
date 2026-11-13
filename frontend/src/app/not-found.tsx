import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This page doesn't exist. Pick a module from the navigation."
        action={
          <Link
            href="/"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-2"
          >
            Back to overview
          </Link>
        }
      />
    </div>
  );
}
