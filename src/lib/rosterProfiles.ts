// Meet-me page and signature profile for any agent: the generated profile (agentProfiles.ts) for the
// original team, overlaid with what was entered on the Team roster screen; agents added on that
// screen get a profile built from their bio, title, license # and headshot.
import { AGENTS, agentSlug, type Agent } from "@/lib/agents";
import { type AgentProfile, profileBySlug } from "@/lib/agentProfiles";

const liveBySlug = (slug: string): Agent | undefined => AGENTS.find(a => agentSlug(a.name) === slug.toLowerCase());

function fromBio(a: Agent): AgentProfile {
  const paras = (a.bio ?? "").split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean);
  return {
    slug: agentSlug(a.name),
    name: a.name,
    title: `${a.title || "Real Estate Broker"} · SpaceMatch Inc.`,
    lic: a.lic ?? "",
    head: `Meet ${a.name.split(" ")[0]}.`,
    p1: paras[0] ?? `${a.name} is a broker with SpaceMatch Inc., a team of Real Broker, LLC serving Chicagoland.`,
    p2: paras.slice(1).join(" "),
    stats: [],
    cards: [],
    photo: a.photo ?? null,
    intro: null,
    why: null,
  };
}

export function profileFor(slug: string): AgentProfile | undefined {
  const a = liveBySlug(slug);
  const base = profileBySlug(slug);
  if (!a) return base;
  if (!base) return fromBio(a);
  return {
    ...base,
    name: a.name,
    title: a.title ? `${a.title} · SpaceMatch Inc.` : base.title,
    lic: a.lic || base.lic,
    photo: a.photo ?? base.photo,
  };
}

/** Square headshot uploaded on the Team roster screen, if any (absolute URL). */
export const rosterPhoto = (name: string) => AGENTS.find(a => a.name === name || agentSlug(a.name) === agentSlug(name))?.photo;
