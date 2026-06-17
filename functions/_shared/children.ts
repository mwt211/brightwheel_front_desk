// Connected family data for the "answers about your child's day" feature.
// This is a static, fictional seed for the demo. In production this would be
// per-parent authenticated data from the daily report and billing systems; the
// shape here mirrors what the Brightwheel app already shows families.
import data from "../../seed/children.json";

export type ChildRecord = {
  id: string;
  name: string;
  firstName: string;
  room: string;
  today: {
    checkIn: string;
    checkOut: string | null;
    naps: { start: string; end: string }[];
    meals: { meal: string; detail: string }[];
    activities: string;
    mood: string;
    diapering: string;
    photosShared: number;
  };
  account: {
    balance: string;
    nextPaymentAmount: string;
    nextPaymentDue: string;
    autopay: string;
  };
};

const CHILDREN = (data as { children: ChildRecord[] }).children;

// Identity-only projection for the "viewing as" selector; the private record and
// account never leave the server. Built once at module load.
const CHILD_LIST = CHILDREN.map(({ id, name, firstName, room }) => ({
  id,
  name,
  firstName,
  room,
}));

/** Public list for the parent "viewing as" selector: identity only, no record. */
export function listChildren(): { id: string; name: string; firstName: string; room: string }[] {
  return CHILD_LIST;
}

export function getChild(id: string | undefined | null): ChildRecord | null {
  if (!id) return null;
  return CHILDREN.find((c) => c.id === id) ?? null;
}

// The citation section label for a family's record. Shared so the prompt
// instruction and the server-side from_record detection can never drift.
export const familyDaySection = (firstName: string): string => `${firstName}'s day`;

/** A grounded, prompt-ready block of one family's day and account. */
export function childContext(c: ChildRecord): string {
  const naps = c.today.naps.length
    ? c.today.naps.map((n) => `${n.start} to ${n.end}`).join(", ")
    : "no nap recorded yet";
  const meals = c.today.meals.map((m) => `${m.meal}: ${m.detail}`).join("; ");
  return [
    `You are speaking with the parent of ${c.name} (${c.room}). Below is ${c.firstName}'s record for today and the family account. Treat it as private and answer this family's personal questions ONLY from it.`,
    `- Checked in: ${c.today.checkIn}`,
    `- Checked out: ${c.today.checkOut ?? "not yet, still at the center"}`,
    `- Naps: ${naps}`,
    `- Meals: ${meals}`,
    `- Activities: ${c.today.activities}`,
    `- Mood: ${c.today.mood}`,
    `- Diapering or bathroom: ${c.today.diapering}`,
    `- Photos shared today: ${c.today.photosShared}`,
    `- Account balance: ${c.account.balance}`,
    `- Next payment: ${c.account.nextPaymentAmount} due ${c.account.nextPaymentDue}; autopay is ${c.account.autopay}`,
  ].join("\n");
}
