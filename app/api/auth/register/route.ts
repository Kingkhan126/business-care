import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, isPasswordStrong } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const RegisterSchema = z.object({
  name: z.string().min(2, "Please enter your full name.").max(120),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().optional(),
  password: z.string().min(10, "Password must be at least 10 characters."),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { name, email, phone, password } = parsed.data;

  if (!isPasswordStrong(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one letter and one number." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Unable to create account with these details." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), phone: phone || null, passwordHash, role: "CUSTOMER" },
  });

  await createSession({ userId: user.id, role: user.role as any });

  return NextResponse.json({ ok: true, role: user.role });
}
