// CMA option: show the public schools assigned to the subject address
// (attendance-boundary elementary / middle / high + district) or leave them out.
// Stored as the label on cmaRequests.schools; residential reports only.
export const SCHOOL_OPTIONS = [
  "Include assigned schools",
  "Leave schools out",
];

export const SCHOOLS_HINT =
  "Adds the elementary, middle and high schools assigned to this address, plus the district. Pick “Leave schools out” to skip it.";

export const includesSchools = (v?: string) => v !== "Leave schools out";
