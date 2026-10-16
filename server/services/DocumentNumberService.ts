import { Prisma } from "@prisma/client";

const documents = {
  customer: ["Customer", "customerNumber"],
  supplier: ["Supplier", "supplierNumber"],
  estimate: ["Estimate", "estimateNumber"],
  salesOrder: ["SalesOrder", "orderNumber"],
  salesInvoice: ["SalesInvoice", "invoiceNumber"],
  customerPayment: ["CustomerPayment", "paymentNumber"],
  creditNote: ["CreditNote", "creditNoteNumber"],
  purchaseOrder: ["PurchaseOrder", "purchaseOrderNumber"],
  vendorBill: ["VendorBill", "billNumber"],
  vendorPayment: ["VendorPayment", "paymentNumber"],
  vendorCredit: ["VendorCredit", "vendorCreditNumber"],
  journalEntry: ["JournalEntry", "journalNumber"],
  expense: ["Expense", "expenseNumber"],
  bankTransfer: ["BankTransfer", "transferNumber"],
  bankReconciliation: ["BankReconciliation", "reconciliationNumber"],
} as const;

export type DocumentKind = keyof typeof documents;

/** Atomic PostgreSQL counter. Must use the document's existing transaction. */
export async function nextDocumentNumber(tx: Prisma.TransactionClient, organizationId: string, kind: DocumentKind, prefix: string, width = 6): Promise<string> {
  const [tableName, columnName] = documents[kind];
  // SQL identifiers come only from the closed mapping above, never from a request.
  const table = Prisma.raw(`"${tableName}"`);
  const column = Prisma.raw(`"${columnName}"`);
  const rows = await tx.$queryRaw<Array<{ value: bigint }>>(Prisma.sql`
    INSERT INTO "DocumentSequence" ("organizationId", "kind", "prefix", "value")
    SELECT ${organizationId}, ${kind}, ${prefix}, COALESCE(MAX(
      CASE WHEN substring(${column} from length(${prefix}) + 1) ~ '^[0-9]{1,18}$'
      THEN substring(${column} from length(${prefix}) + 1)::bigint ELSE 0 END
    ), 0) + 1
    FROM ${table}
    WHERE "organizationId" = ${organizationId} AND left(${column}, length(${prefix})) = ${prefix}
    ON CONFLICT ("organizationId", "kind", "prefix") DO UPDATE
    SET "value" = GREATEST("DocumentSequence"."value" + 1, EXCLUDED."value")
    RETURNING "value"
  `);
  if (!rows[0]) throw new Error("Document sequence allocation failed");
  return `${prefix}${String(rows[0].value).padStart(width, "0")}`;
}
