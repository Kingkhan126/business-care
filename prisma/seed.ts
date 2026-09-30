import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ExpenseMasterDataService } from "../server/services/ExpenseMasterDataService";

const prisma = new PrismaClient();

const PERMISSIONS = [
  // Organization & Team
  { code: "organization.view", category: "Organization", description: "View organization profile and settings" },
  { code: "organization.update", category: "Organization", description: "Update organization details and settings" },
  { code: "organization.members.manage", category: "Organization", description: "Invite, update, or remove team members" },

  // User Management
  { code: "users.view", category: "Users", description: "View user directory and profiles" },
  { code: "users.manage", category: "Users", description: "Manage user roles and permissions" },

  // Customers & Sales (Future domains)
  { code: "customers.read", category: "Customers", description: "View customer profiles and history" },
  { code: "customers.create", category: "Customers", description: "Create new customer records" },
  { code: "customers.update", category: "Customers", description: "Update customer information" },
  { code: "customers.delete", category: "Customers", description: "Delete customer records" },

  { code: "invoices.read", category: "Sales", description: "View sales invoices" },
  { code: "invoices.create", category: "Sales", description: "Create new sales invoices" },
  { code: "invoices.update", category: "Sales", description: "Update sales invoices" },
  { code: "invoices.delete", category: "Sales", description: "Delete sales invoices" },

  { code: "estimates.read", category: "Sales", description: "View estimates and quotes" },
  { code: "estimates.create", category: "Sales", description: "Create estimates and quotes" },
  { code: "estimates.update", category: "Sales", description: "Update estimates and quotes" },

  { code: "orders.read", category: "Sales", description: "View sales orders" },
  { code: "orders.create", category: "Sales", description: "Create sales orders" },
  { code: "orders.update", category: "Sales", description: "Update sales orders" },

  { code: "payments.read", category: "Sales", description: "View customer payment records" },
  { code: "payments.create", category: "Sales", description: "Record customer payments" },

  { code: "credits.read", category: "Sales", description: "View credit notes and vendor credits" },
  { code: "credits.create", category: "Sales", description: "Create credit notes and vendor credits" },
  { code: "credits.update", category: "Sales", description: "Update credit notes and vendor credits" },

  // Vendors & Purchases (Future domains)
  { code: "vendors.read", category: "Purchases", description: "View vendor profiles" },
  { code: "vendors.create", category: "Purchases", description: "Create vendor records" },
  { code: "vendors.update", category: "Purchases", description: "Update vendor information" },

  { code: "purchases.read", category: "Purchases", description: "View purchase orders and bills" },
  { code: "purchases.create", category: "Purchases", description: "Create purchase orders and bills" },
  { code: "purchases.update", category: "Purchases", description: "Update purchase orders and bills" },

  // Products & Inventory (Future domains)
  { code: "products.read", category: "Products", description: "View product catalog" },
  { code: "products.create", category: "Products", description: "Create products and services" },
  { code: "products.update", category: "Products", description: "Update product catalog" },
  { code: "products.delete", category: "Products", description: "Delete products" },

  { code: "inventory.read", category: "Inventory", description: "View stock levels and inventory" },
  { code: "inventory.update", category: "Inventory", description: "Adjust stock levels and inventory" },

  // Expenses & Reimbursements (Phase 7)
  { code: "expenses.read", category: "Expenses", description: "View business expenses" },
  { code: "expenses.create", category: "Expenses", description: "Record business expenses" },
  { code: "expenses.update", category: "Expenses", description: "Update business expenses" },
  { code: "expense.read", category: "Expenses", description: "View expenses and reimbursement claims" },
  { code: "expense.create", category: "Expenses", description: "Create expenses and reimbursement claims" },
  { code: "expense.update", category: "Expenses", description: "Update draft expenses and claims" },
  { code: "expense.submit", category: "Expenses", description: "Submit claims for manager approval" },
  { code: "expense.approve", category: "Expenses", description: "Approve submitted expense claims" },
  { code: "expense.reject", category: "Expenses", description: "Reject submitted expense claims" },
  { code: "expense.post", category: "Expenses", description: "Post approved expenses to General Ledger" },
  { code: "expense.pay", category: "Expenses", description: "Disburse expense payments and employee reimbursements" },
  { code: "expense.manage", category: "Expenses", description: "Manage expense categories and accounting configurations" },
  { code: "expense.attachments", category: "Expenses", description: "Upload and inspect receipt attachments" },
  { code: "expense.reports", category: "Expenses", description: "View expense and reimbursement financial reports" },

  { code: "banking.read", category: "Banking", description: "View bank accounts, cash registers, and transactions" },
  { code: "banking.manage", category: "Banking", description: "Create and manage bank and cash accounts" },
  { code: "banking.import", category: "Banking", description: "Import bank statement feeds and files" },
  { code: "banking.match", category: "Banking", description: "Match and categorize bank transactions" },
  { code: "banking.reconcile", category: "Banking", description: "Perform and finalize bank reconciliations" },
  { code: "banking.transfer", category: "Banking", description: "Execute inter-account bank and cash transfers" },

  // Accounting & Reports
  { code: "accounting.read", category: "Accounting", description: "View journal entries, reports, and chart of accounts" },
  { code: "accounting.manage", category: "Accounting", description: "Manage financial accounts and manual journals" },
  { code: "accounting.post", category: "Accounting", description: "Post financial journal entries and transaction postings" },
  { code: "accounting.reverse", category: "Accounting", description: "Reverse posted accounting journal entries" },
  { code: "accounting.close_period", category: "Accounting", description: "Close or reopen fiscal accounting periods" },

  { code: "reports.read", category: "Reports", description: "View financial and operational reports" },
  { code: "reports.export", category: "Reports", description: "Export financial reports and data" },

  // Settings & Audit
  { code: "settings.manage", category: "Settings", description: "Manage system-wide configuration" },
  { code: "audit.read", category: "Audit", description: "View system audit logs" },
];

async function main() {
  console.log("🌱 Starting development database seeding...");

  // 1. Seed Permissions
  console.log("Creating permissions...");
  const permissionMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { category: perm.category, description: perm.description },
      create: perm,
    });
    permissionMap.set(perm.code, created.id);
  }

  // Helper to resolve permission IDs from codes
  const getPermIds = (codes: string[]) =>
    codes.map((c) => permissionMap.get(c)).filter((id): id is string => Boolean(id));

  const allPermIds = Array.from(permissionMap.values());

  // 2. Seed System Default Roles
  console.log("Creating system roles...");
  const systemRoles = [
    {
      name: "Owner",
      description: "Full administrative and ownership access across the organization.",
      permCodes: allPermIds,
    },
    {
      name: "Admin",
      description: "Administrative access to manage team, settings, and business operations.",
      permCodes: allPermIds.filter(
        (id) =>
          id !== permissionMap.get("settings.manage") // Admin can manage most things
      ),
    },
    {
      name: "Manager",
      description: "Operational management of sales, purchases, inventory, and customers.",
      permCodes: getPermIds([
        "organization.view",
        "users.view",
        "customers.read", "customers.create", "customers.update",
        "invoices.read", "invoices.create", "invoices.update",
        "estimates.read", "estimates.create", "estimates.update",
        "payments.read", "payments.create",
        "vendors.read", "vendors.create", "vendors.update",
        "purchases.read", "purchases.create", "purchases.update",
        "products.read", "products.create", "products.update",
        "inventory.read", "inventory.update",
        "expenses.read", "expenses.create",
        "expense.read", "expense.create", "expense.update", "expense.submit", "expense.approve", "expense.reject", "expense.attachments", "expense.reports",
        "banking.read", "banking.transfer",
        "reports.read",
      ]),
    },
    {
      name: "Accountant",
      description: "Access to banking, accounting, financial statements, and reports.",
      permCodes: getPermIds([
        "organization.view",
        "customers.read",
        "invoices.read",
        "payments.read", "payments.create",
        "vendors.read",
        "purchases.read",
        "expenses.read", "expenses.create", "expenses.update",
        "expense.read", "expense.create", "expense.update", "expense.post", "expense.pay", "expense.manage", "expense.attachments", "expense.reports",
        "banking.read", "banking.manage", "banking.import", "banking.match", "banking.reconcile", "banking.transfer",
        "accounting.read", "accounting.manage",
        "reports.read", "reports.export",
      ]),
    },
    {
      name: "Member",
      description: "Standard team member operational access.",
      permCodes: getPermIds([
        "organization.view",
        "customers.read", "customers.create",
        "invoices.read", "invoices.create",
        "estimates.read", "estimates.create",
        "products.read",
        "inventory.read",
        "expense.read", "expense.create", "expense.update", "expense.submit", "expense.attachments",
      ]),
    },
    {
      name: "Viewer",
      description: "Read-only access across standard business modules.",
      permCodes: getPermIds([
        "organization.view",
        "users.view",
        "customers.read",
        "invoices.read",
        "estimates.read",
        "vendors.read",
        "purchases.read",
        "products.read",
        "inventory.read",
        "expenses.read",
        "expense.read",
        "reports.read",
      ]),
    },
  ];

  const createdRolesMap = new Map<string, string>();
  for (const roleDef of systemRoles) {
    let role = await prisma.role.findFirst({
      where: { organizationId: null, name: roleDef.name },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          organizationId: null,
        },
      });
    }

    createdRolesMap.set(roleDef.name, role.id);

    // Link Role Permissions
    for (const permId of roleDef.permCodes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        update: {},
        create: { roleId: role.id, permissionId: permId },
      });
    }
  }

  // 3. Seed Demo Organization
  console.log("Creating demo organization...");
  let demoOrg = await prisma.organization.findFirst({
    where: { name: "Acme Global Enterprises" },
  });

  if (!demoOrg) {
    demoOrg = await prisma.organization.create({
      data: {
        name: "Acme Global Enterprises",
        legalName: "Acme Global Enterprises LLC",
        description: "Global manufacturing, distribution, and logistics platform.",
        registrationNumber: "CRN-98765432",
        taxId: "US-987654321",
        email: "contact@acmeglobal.com",
        phone: "+1 (555) 019-2834",
        website: "https://acmeglobal.com",
        currency: "USD",
        timezone: "America/New_York",
        addressLine1: "100 Innovation Way",
        addressLine2: "Suite 400",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "US",
        fiscalYearStart: 1,
        onboardingCompleted: true,
        onboardingStep: 6,
      },
    });
  }

  if (demoOrg) {
    await prisma.organizationSettings.upsert({
      where: { organizationId: demoOrg.id },
      update: {},
      create: {
        organizationId: demoOrg.id,
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

  // 4. Seed Demo Users
  console.log("Creating demo users...");
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const demoUsers = [
    {
      email: "owner@acme.com",
      name: "Eleanor Vance (Owner)",
      phone: "+1 (555) 101-2020",
      roleName: "Owner",
    },
    {
      email: "admin@acme.com",
      name: "Marcus Brody (Admin)",
      phone: "+1 (555) 101-3030",
      roleName: "Admin",
    },
    {
      email: "staff@acme.com",
      name: "Sarah Chen (Staff Member)",
      phone: "+1 (555) 101-4040",
      roleName: "Member",
    },
  ];

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: passwordHash,
        phone: u.phone,
        emailVerified: true,
      },
    });

    const roleId = createdRolesMap.get(u.roleName);
    if (roleId && demoOrg) {
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: demoOrg.id, userId: user.id } },
        update: { roleId },
        create: {
          organizationId: demoOrg.id,
          userId: user.id,
          roleId,
          status: "ACTIVE",
        },
      });
    }
  }

  // 5. Initial Audit Log Entry
  if (demoOrg) {
    const ownerUser = await prisma.user.findUnique({ where: { email: "owner@acme.com" } });
    await prisma.auditLog.create({
      data: {
        organizationId: demoOrg.id,
        actorId: ownerUser?.id,
        action: "organization.created",
        entityType: "Organization",
        entityId: demoOrg.id,
        metadata: { info: "Initial demo seed organization created" },
      },
    });
  }

  // 6. Phase 7: Expense Management Master Data (COA, Mappings, Categories)
  console.log("Seeding Phase 7 Expense Management Master Data...");
  const organizations = await prisma.organization.findMany();
  for (const org of organizations) {
    const result = await ExpenseMasterDataService.provisionOrganizationDefaults(prisma, org.id);
    console.log(
      `  → ${org.name}: ${result.accountsCreated} accounts created, mapping ${result.mappingCreated ? "initialized" : "preserved"}, ${result.categoriesCreated} categories created`
    );
  }

  console.log("✅ Seed completed successfully!");
  console.log("Demo Credentials:");
  console.log("  Owner: owner@acme.com / Password123!");
  console.log("  Admin: admin@acme.com / Password123!");
  console.log("  Staff: staff@acme.com / Password123!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
