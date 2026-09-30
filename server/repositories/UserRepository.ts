import { db } from "@/db/client";
import { User, Prisma } from "@prisma/client";

export class UserRepository {
  static async findById(id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id } });
  }

  static async findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  static async create(data: Prisma.UserCreateInput): Promise<User> {
    return db.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase().trim(),
      },
    });
  }

  static async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return db.user.update({
      where: { id },
      data,
    });
  }
}
