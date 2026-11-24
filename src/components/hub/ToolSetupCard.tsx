import { useMutation, useQuery } from "convex/react";
import { Check, KeyRound } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { TOOLS, toolHref } from "@/lib/hub";

// Shows until every daily tool is ticked, then disappears for good.
export function ToolSetupCard() {
  const done = useQuery(api.toolSetup.mine);
  const toggle = useMutation(api.toolSetup.toggle);
  if (done === undefined) return null;
  const tools = TOOLS.filter(t => t.setup);
  const n = tools.filter(t => done.includes(t.name)).length;
  if (n === tools.length) return null;
  return (
    <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-[#9C7434]/30" data-testid="tool-setup">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold"><KeyRound className="size-5 text-[#9C7434]" /> Set up your tools</div>
        <span className="text-sm font-semibold text-stone-600">{n}/{tools.length}</span>
      </div>
      <p className="mt-1 text-[15px] text-stone-700">
        Log in to each one once on this phone and check <b>Remember me</b> / save the password. After that the tiles open straight in. Tick each one when done.
      </p>
      <ul className="mt-3 divide-y divide-stone-100">
        {tools.map(t => {
          const ok = done.includes(t.name);
          return (
            <li key={t.name} className="flex items-center gap-3 py-2">
              <img src={t.icon} alt="" className="size-8 rounded-lg object-contain" />
              <a href={toolHref(t)} target="_blank" rel="noreferrer" className={`flex-1 text-[15px] font-semibold ${ok ? "text-stone-400 line-through" : "text-[#7a5a26]"}`}>{t.name} →</a>
              <button
                aria-label={`${ok ? "Untick" : "Tick"} ${t.name}`}
                onClick={() => void toggle({ tool: t.name, done: !ok })}
                className={`grid size-8 place-items-center rounded-full ring-2 ${ok ? "bg-[#9C7434] text-white ring-[#9C7434]" : "text-transparent ring-stone-300"}`}
              >
                <Check className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
