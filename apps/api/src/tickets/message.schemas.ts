import { z } from "zod";

export const createMessageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  isInternal: z.boolean().default(false),
});
