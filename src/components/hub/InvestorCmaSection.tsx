// Investor / 2–4 unit add-on for the residential sale CMA (Rob Robinson's idea,
// approved by Michael 2026-11-02). Stored on the request as a flat string map
// `investor` (see convex/schema.ts). Viktor's CMA worker reads it and adds
// as-is value, after-repair value (ARV) and rent-per-unit pages.
import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Choice, Field } from "@/pages/NewRequestPage";

export type InvestorState = Record<string, string>;

export const INVESTOR_GOALS = [
  "Buy, renovate and resell (flip)",
  "Buy and hold as a rental",
  "Live in one unit, rent the others",
  "Owner deciding: sell, rent or renovate",
];
export const INVESTOR_OUTPUTS = [
  "As-is value",
  "After-repair value (ARV)",
  "Market rent per unit",
];
const UNIT_STATUS = ["Rented", "Vacant", "Owner lives here"];
const REHAB_SCOPES = [
  "None, keep as is",
  "Cosmetic (paint, floors, fixtures)",
  "Medium (kitchens + baths)",
  "Full gut / systems",
  "Not sure, estimate it",
];
const FINISH_LEVELS = ["Rental grade", "Mid-market", "High-end"];
const HUD_OPTIONS = [
  "Include HUD Fair Market Rent",
  "Leave HUD Fair Market Rent out",
];

export function investorDefaults(propertyType: string): InvestorState {
  return {
    goal: INVESTOR_GOALS[0],
    outputs: INVESTOR_OUTPUTS.join(", "),
    units: propertyType.startsWith("2") ? "2" : "1",
    rehabScope: "",
    finishLevel: "",
    hud: HUD_OPTIONS[0],
  };
}

// Drop empty values and fields for units beyond the unit count.
export function cleanInvestor(s: InvestorState): Record<string, string> {
  const n = Number(s.units) || 1;
  return Object.fromEntries(
    Object.entries(s)
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([k, v]) => {
        if (!v) return false;
        const m = /^u(\d)/.exec(k);
        return !m || Number(m[1]) <= n;
      }),
  );
}

export function InvestorCmaSection({
  on,
  onToggle,
  value,
  onChange,
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  value: InvestorState;
  onChange: (v: InvestorState) => void;
}) {
  const get = (k: string) => value[k] ?? "";
  const set = (k: string) => (v: string) => onChange({ ...value, [k]: v });
  const setIn =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...value, [k]: e.target.value });
  const outputs = get("outputs")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  const toggleOutput = (o: string, c: boolean) => {
    const next = c
      ? INVESTOR_OUTPUTS.filter(x => x === o || outputs.includes(x))
      : outputs.filter(x => x !== o);
    onChange({ ...value, outputs: next.join(", ") });
  };
  const units = Math.min(4, Math.max(1, Number(get("units")) || 1));
  const wantsArv = outputs.includes("After-repair value (ARV)");
  const wantsRent = outputs.includes("Market rent per unit");

  return (
    <Card
      className={on ? "ring-2 ring-primary/30" : ""}
      data-testid="investor-section"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" /> Investor numbers
              <span className="text-xs font-normal text-muted-foreground">
                optional
              </span>
            </CardTitle>
            <CardDescription>
              For investors and 2–4 flat buyers or owners. Adds the as-is
              value, the after-repair value (ARV) from renovated sales, and
              market rent for each unit compared with what it rents for today.
            </CardDescription>
          </div>
          <Switch
            checked={on}
            onCheckedChange={onToggle}
            aria-label="Add investor numbers"
            data-testid="investor-toggle"
          />
        </div>
      </CardHeader>
      {on && (
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="What's the plan?" className="sm:col-span-4">
              <Choice
                id="investor-goal"
                value={get("goal")}
                onChange={set("goal")}
                options={INVESTOR_GOALS}
              />
            </Field>
            <Field label="Units" className="sm:col-span-2">
              <Choice
                id="investor-units"
                value={String(units)}
                onChange={set("units")}
                options={["1", "2", "3", "4"]}
              />
            </Field>
            <div className="sm:col-span-6 space-y-2">
              <p className="text-sm font-medium">Put in the report</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {INVESTOR_OUTPUTS.map(o => {
                  const id = `inv-out-${o.replace(/\W+/g, "-").toLowerCase()}`;
                  return (
                    <label
                      key={o}
                      htmlFor={id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        id={id}
                        checked={outputs.includes(o)}
                        onCheckedChange={c => toggleOutput(o, c === true)}
                      />
                      {o}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {units === 1 ? "The unit" : "Each unit"}
            </p>
            <p className="text-xs text-muted-foreground">
              Current rent is what the tenant pays today. Leave it blank if the
              unit is vacant or the owner lives there.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="investor-units">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">Unit</th>
                    <th className="py-1 pr-2 font-medium">Beds</th>
                    <th className="py-1 pr-2 font-medium">Baths</th>
                    <th className="py-1 pr-2 font-medium">Current rent $/mo</th>
                    <th className="py-1 pr-2 font-medium">Status</th>
                    <th className="py-1 font-medium">Lease ends</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: units }, (_, i) => {
                    const u = `u${i + 1}`;
                    return (
                      <tr key={u}>
                        <td className="py-1 pr-2">
                          <Input
                            aria-label={`Unit ${i + 1} name`}
                            placeholder={
                              units === 1 ? "Main" : ["1st fl", "2nd fl", "3rd fl", "Garden"][i]
                            }
                            value={get(`${u}Name`)}
                            onChange={setIn(`${u}Name`)}
                            className="bg-white min-w-20"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            aria-label={`Unit ${i + 1} beds`}
                            inputMode="numeric"
                            value={get(`${u}Beds`)}
                            onChange={setIn(`${u}Beds`)}
                            className="bg-white w-16"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            aria-label={`Unit ${i + 1} baths`}
                            inputMode="decimal"
                            value={get(`${u}Baths`)}
                            onChange={setIn(`${u}Baths`)}
                            className="bg-white w-16"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            aria-label={`Unit ${i + 1} current rent`}
                            inputMode="numeric"
                            placeholder="e.g. 1,450"
                            value={get(`${u}Rent`)}
                            onChange={setIn(`${u}Rent`)}
                            className="bg-white min-w-24"
                          />
                        </td>
                        <td className="py-1 pr-2 min-w-36">
                          <Choice
                            id={`investor-${u}-status`}
                            value={get(`${u}Status`)}
                            onChange={set(`${u}Status`)}
                            options={UNIT_STATUS}
                            placeholder="Status"
                          />
                        </td>
                        <td className="py-1">
                          <Input
                            aria-label={`Unit ${i + 1} lease end`}
                            placeholder="e.g. Apr 2027"
                            value={get(`${u}LeaseEnd`)}
                            onChange={setIn(`${u}LeaseEnd`)}
                            className="bg-white min-w-24"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {wantsArv && (
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Renovation plan" className="sm:col-span-3">
                <Choice
                  id="investor-rehab"
                  value={get("rehabScope")}
                  onChange={set("rehabScope")}
                  options={REHAB_SCOPES}
                  placeholder="Choose scope"
                />
              </Field>
              <Field label="Finish level after rehab" className="sm:col-span-3">
                <Choice
                  value={get("finishLevel")}
                  onChange={set("finishLevel")}
                  options={FINISH_LEVELS}
                  placeholder="Choose level"
                />
              </Field>
              <Field
                label="Rehab budget"
                className="sm:col-span-2"
                hint="If known, e.g. 85,000"
              >
                <Input
                  inputMode="numeric"
                  value={get("rehabBudget")}
                  onChange={setIn("rehabBudget")}
                  className="bg-white"
                />
              </Field>
              <Field
                label="What would be done"
                className="sm:col-span-4"
                hint="e.g. new kitchens + baths in both units, add a 3rd bed in the garden unit"
              >
                <Textarea
                  value={get("rehabNotes")}
                  onChange={setIn("rehabNotes")}
                  className="bg-white min-h-10"
                />
              </Field>
            </div>
          )}

          {wantsRent && (
            <div className="grid gap-4 sm:grid-cols-6">
              <Field
                label="HUD Fair Market Rent benchmark"
                className="sm:col-span-3"
                hint="HUD's yearly rent figure for this ZIP by bedroom count, shown next to the MLS rent comps."
              >
                <Choice
                  id="investor-hud"
                  value={get("hud")}
                  onChange={set("hud")}
                  options={HUD_OPTIONS}
                />
              </Field>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
