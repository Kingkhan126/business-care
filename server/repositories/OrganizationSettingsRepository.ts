import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class OrganizationSettingsRepository {
  static async findByOrganizationId(organizationId: string) {
    let settings = await db.organizationSettings.findUnique({
      where: { organizationId },
    });

    if (!settings) {
      // Auto-create default settings if missing
      settings = await db.organizationSettings.create({
        data: {
          organizationId,
          dateFormat: "YYYY-MM-DD",
          timeFormat: "24h",
          numberFormat: "comma_dot",
          invoicePrefix: "INV-",
          estimatePrefix: "EST-",
          purchaseOrderPrefix: "PO-",
          billPrefix: "BILL-",
          nextInvoiceNumber: 1001,
          nextEstimateNumber: 1001,
          nextPurchaseOrderNumber: 1001,
        },
      });
    }

    return settings;
  }

  static async updateSettings(
    organizationId: string,
    data: Prisma.OrganizationSettingsUpdateInput
  ) {
    return db.organizationSettings.update({
      where: { organizationId },
      data,
    });
  }
}
