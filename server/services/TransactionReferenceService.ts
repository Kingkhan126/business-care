import { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";

type References = {
  customerId?: string;
  supplierId?: string;
  sourceSalesOrderId?: string | null;
  sourceEstimateId?: string | null;
  sourcePurchaseOrderId?: string | null;
  sourceInvoiceId?: string | null;
  sourceBillId?: string | null;
  lines: Array<{ productId?: string | null; serviceId?: string | null }>;
};

/** Validate every supplied relationship within the transaction that writes it. */
export async function validateTransactionReferences(tx: Prisma.TransactionClient, organizationId: string, input: References) {
  for (const line of input.lines) {
    if (line.productId && line.serviceId) throw new ValidationError("A line must reference either a product or a service.");
  }
  for (const id of new Set(input.lines.map(l => l.productId).filter((id): id is string => Boolean(id)))) {
    const product = await tx.product.findFirst({ where: { id, organizationId } });
    if (!product) throw new NotFoundError("Product not found in your organization");
    if (product.status !== "ACTIVE") throw new ValidationError("Inactive products cannot be used on new documents");
  }
  for (const id of new Set(input.lines.map(l => l.serviceId).filter((id): id is string => Boolean(id)))) {
    const service = await tx.service.findFirst({ where: { id, organizationId } });
    if (!service) throw new NotFoundError("Service not found in your organization");
    if (service.status !== "ACTIVE") throw new ValidationError("Inactive services cannot be used on new documents");
  }
  const checkSource = async (source: { customerId?: string; supplierId?: string } | null, partyField: "customerId" | "supplierId", partyId?: string) => {
    if (!source) throw new NotFoundError("Source document not found in your organization");
    if (source[partyField] !== partyId) throw new ValidationError("Source document belongs to a different customer or supplier");
  };
  if (input.sourceSalesOrderId) await checkSource(await tx.salesOrder.findFirst({ where: { id: input.sourceSalesOrderId, organizationId } }), "customerId", input.customerId);
  if (input.sourceEstimateId) await checkSource(await tx.estimate.findFirst({ where: { id: input.sourceEstimateId, organizationId } }), "customerId", input.customerId);
  if (input.sourcePurchaseOrderId) await checkSource(await tx.purchaseOrder.findFirst({ where: { id: input.sourcePurchaseOrderId, organizationId } }), "supplierId", input.supplierId);
  if (input.sourceInvoiceId) await checkSource(await tx.salesInvoice.findFirst({ where: { id: input.sourceInvoiceId, organizationId } }), "customerId", input.customerId);
  if (input.sourceBillId) await checkSource(await tx.vendorBill.findFirst({ where: { id: input.sourceBillId, organizationId } }), "supplierId", input.supplierId);
}
