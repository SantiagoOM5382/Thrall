// Build a wa.me deep link. Strips non-digits and, if the result is a 10-digit
// Colombian mobile (starts with 3), prefixes country code 57. Numbers already
// including a country code (11+ digits) or non-CO patterns pass through as-is.
export function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  const withCc = digits.length === 10 && digits.startsWith("3")
    ? `57${digits}`
    : digits
  return `https://wa.me/${withCc}`
}

export function tgLink(handle: string): string {
  return `https://t.me/${handle.replace(/^@/, "")}`
}
