/** Zod schemas for the shared credential formats (server boundaries). */
import { z } from "zod";

import { PAIR_CODE_PATTERN, PAIR_TOKEN_PATTERN } from "./pair-credentials";

export const pairTokenSchema = z.string().regex(PAIR_TOKEN_PATTERN);

export const pairCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => PAIR_CODE_PATTERN.test(value));
