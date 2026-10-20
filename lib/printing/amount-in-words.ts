/** Display-only PKR wording; the invoice's stored total remains authoritative. */
export function rupeesInWords(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const small = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const spell = (n: number): string => {
    if (n < 20) return small[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? `-${small[n % 10]}` : "");
    if (n < 1000) return `${small[Math.floor(n / 100)]} Hundred` + (n % 100 ? ` ${spell(n % 100)}` : "");
    for (const [value, label] of [[1e12, "Trillion"], [1e9, "Billion"], [1e6, "Million"], [1000, "Thousand"]] as const) {
      if (n >= value) return `${spell(Math.floor(n / value))} ${label}` + (n % value ? ` ${spell(n % value)}` : "");
    }
    return "";
  };
  const paisaTotal = Math.round(Math.abs(amount) * 100);
  if (!Number.isSafeInteger(paisaTotal)) return "Amount exceeds supported wording range";
  const rupees = Math.floor(paisaTotal / 100);
  const paisa = paisaTotal % 100;
  return `${amount < 0 ? "Minus " : ""}${spell(rupees)} ${rupees === 1 ? "Rupee" : "Rupees"}${paisa ? ` and ${spell(paisa)} ${paisa === 1 ? "Paisa" : "Paisas"}` : ""} Only.`;
}
