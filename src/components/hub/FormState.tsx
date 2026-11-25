// Shared bits for forms and data on the new backend: field errors, loading skeletons,
// load errors with "Try again", and empty states.
import type { ReactNode } from "react";
import { Skeleton as Placeholder } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/apiData";

/** Red message under a field. */
export const FieldError = ({ msg, id }: { msg?: string; id?: string }) =>
  msg ? <span id={id} role="alert" className="mt-1 block text-xs font-normal text-red-600">{msg}</span> : null;

/** Classes that turn a field's border red when it has an error. */
export const errorBorder = (err?: string) => (err ? "border-red-400! focus:border-red-500! focus:ring-red-500/20!" : "");

/** Placeholder cards while a section loads. */
export function Skeleton({ rows = 3, className = "h-28", grid = "", label = "Loading" }: { rows?: number; className?: string; grid?: string; label?: string }) {
  return (
    <div className={grid || "space-y-3"} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`space-y-2 rounded-2xl bg-white p-3 ring-1 ring-[#ebe5da] ${className}`} aria-hidden="true">
          <Placeholder className="h-4 w-2/5 bg-stone-200" />
          <Placeholder className="h-3 w-4/5 bg-stone-200" />
          <Placeholder className="h-3 w-3/5 bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

/** Couldn't load: the reason and a Try again button. */
export function LoadError({ error, onRetry, what = "this" }: { error: unknown; onRetry: () => void; what?: string }) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
      Couldn't load {what}. {apiErrorMessage(error)}{" "}
      <button type="button" onClick={onRetry} className="ml-1 font-semibold underline">Try again</button>
    </div>
  );
}

/** Nothing here yet: icon, title, one line and an optional action. */
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white/50 p-8 text-center">
      {icon && <div className="mx-auto mb-2 grid size-10 place-items-center text-[#9C7434]">{icon}</div>}
      <h3 className="text-[17px] font-semibold text-[#1F1E1B]">{title}</h3>
      {children && <p className="mx-auto mt-1 max-w-md text-[15px] text-stone-600">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
