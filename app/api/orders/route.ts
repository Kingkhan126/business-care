import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    let userId = session?.userId;
    if (!userId) {
      const defaultCust = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
      userId = defaultCust?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "Customer login or valid account required to place an order." }, { status: 401 });
    }

    const body = await request.json();
    const { items, address, paymentMethod, couponCode, prescriptionId } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    if (!address || !address.street || !address.city || !address.zipCode) {
      return NextResponse.json({ error: "Complete shipping address is required." }, { status: 400 });
    }

    let hasRxItem = false;
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.id } });
      if (!product) continue;

      if (product.isPrescriptionRequired) {
        hasRxItem = true;
      }

      const unitPrice = product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: product.id,
        productName: product.name,
        unitPrice,
        quantity: item.quantity,
        isPrescriptionRequired: product.isPrescriptionRequired,
        totalPrice: itemTotal,
      });
    }

    // Coupon discount calculation
    let discountAmount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
      if (coupon && coupon.isActive && subtotal >= coupon.minOrderAmount) {
        if (coupon.discountType === "PERCENTAGE") {
          discountAmount = (subtotal * coupon.discountValue) / 100;
        } else {
          discountAmount = coupon.discountValue;
        }
      }
    }

    const shippingFee = subtotal > 50 ? 0 : 4.99;
    const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

    // Initial Order Status: if Rx item present, set to PRESCRIPTION_VERIFICATION unless approved prescription linked
    let status = "PENDING";
    if (hasRxItem) {
      status = "PRESCRIPTION_VERIFICATION";
      if (prescriptionId) {
        const rx = await prisma.prescription.findUnique({ where: { id: prescriptionId } });
        if (rx && rx.status === "APPROVED") {
          status = "PROCESSING";
        }
      }
    }

    const orderNumber = `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        shippingAddressJson: JSON.stringify(address),
        status,
        paymentStatus: paymentMethod === "CARD" || paymentMethod === "WALLET" ? "PAID" : "PENDING",
        paymentMethod: paymentMethod || "CARD",
        subtotal,
        discountAmount,
        shippingFee,
        totalAmount,
        prescriptionId: prescriptionId || null,
        estimatedDelivery: "3-5 Business Days",
        items: {
          create: orderItemsData,
        },
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to place order" }, { status: 500 });
  }
}
