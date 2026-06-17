// Build tel: / mailto: links from a free-form contact string, shared by the
// parent header (call us) and the operator inbox (call/email back).
export const isEmail = (c: string): boolean => c.includes("@");

export const telHref = (value: string): string =>
  `tel:${value.replace(/[^0-9+]/g, "")}`;

export const contactHref = (c: string): string =>
  isEmail(c) ? `mailto:${c.trim()}` : telHref(c);
