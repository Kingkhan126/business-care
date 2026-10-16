import { z } from "zod";

const pageSchema = z.object({
  skip: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
});

export function parsePagination(params: URLSearchParams) {
  return pageSchema.parse({ skip: params.get("skip") ?? undefined, take: params.get("take") ?? undefined });
}

export const validDate = z.union([z.string(), z.date()]).refine(value => Number.isFinite(new Date(value).getTime()), "Enter a valid date");
