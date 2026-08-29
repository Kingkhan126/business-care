import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const body = await request.json();
    const { status, deliveryAgentName, estimatedDelivery, paymentStatus, cancelReason } = body;

    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (deliveryAgentName !== undefined) updateData.deliveryAgentName = deliveryAgentName;
    if (estimatedDelivery !== undefined) updateData.estimatedDelivery = estimatedDelivery;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (cancelReason) updateData.cancelReason = cancelReason;

    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update order" }, { status: 500 });
  }
}
