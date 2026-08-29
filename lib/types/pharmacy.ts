export type Role = "CUSTOMER" | "PHARMACIST" | "ADMIN";

export type PrescriptionStatus =
  | "PENDING_REVIEW"
  | "UNDER_PHARMACIST_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CLARIFICATION_REQUESTED";

export type OrderStatus =
  | "PENDING"
  | "PRESCRIPTION_VERIFICATION"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type PaymentMethod = "CARD" | "CASH_ON_DELIVERY" | "WALLET" | "BANK_TRANSFER";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface PharmacyCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
}

export interface PharmacyBrand {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  description?: string | null;
}

export interface PharmacyProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  sku: string;
  price: number;
  salePrice?: number | null;
  stockQuantity: number;
  isPrescriptionRequired: boolean;
  dosageForm?: string | null;
  activeIngredients?: string | null;
  usageInstructions?: string | null;
  warnings?: string | null;
  imageUrl?: string | null;
  categoryId: string;
  category?: PharmacyCategory;
  brandId?: string | null;
  brand?: PharmacyBrand | null;
  ratingAverage: number;
  ratingCount: number;
  isFeatured: boolean;
}
