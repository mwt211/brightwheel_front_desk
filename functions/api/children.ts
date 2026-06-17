import { type Env, json } from "../_shared/db";
import { listChildren } from "../_shared/children";

// Public: the identities a parent can view as in the demo. Identity only (name,
// room); the private daily record and account are only injected server-side
// into the answer for the selected child, never listed here.
export const onRequestGet: PagesFunction<Env> = async () => {
  return json({ children: listChildren() });
};
