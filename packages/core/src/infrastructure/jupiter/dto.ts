import { z } from 'zod';

export const SwapInfoDto = z.object({
  ammKey: z.string(),
  label: z.string().optional(),
  inputMint: z.string(),
  outputMint: z.string(),
  inAmount: z.coerce.string(),
  outAmount: z.coerce.string(),
  feeAmount: z.coerce.string(),
  feeMint: z.string(),
});

export const RoutePlanStepDto = z.object({
  swapInfo: SwapInfoDto,
  percent: z.number(),
});

export const OrderResponseDto = z.object({
  requestId: z.string(),
  transaction: z.string(),
  inputMint: z.string(),
  outputMint: z.string(),
  inAmount: z.coerce.string(),
  outAmount: z.coerce.string(),
  otherAmountThreshold: z.coerce.string().default('0'),
  swapMode: z.enum(['ExactIn', 'ExactOut']).default('ExactIn'),
  slippageBps: z.coerce.number().int(),
  priceImpactPct: z.coerce.number(),
  routePlan: z.array(RoutePlanStepDto).default([]),
  contextSlot: z.coerce.string().optional(),
  prioritizationFeeLamports: z.coerce.string().optional(),
  expiresAt: z.string().optional(),
});
export type OrderResponseDtoT = z.infer<typeof OrderResponseDto>;

export const ExecuteResponseDto = z.object({
  status: z.string(),
  signature: z.string().optional(),
  slot: z.coerce.string().optional(),
  code: z.number().optional(),
  error: z.string().optional(),
  inputAmountResult: z.coerce.string().optional(),
  outputAmountResult: z.coerce.string().optional(),
});
export type ExecuteResponseDtoT = z.infer<typeof ExecuteResponseDto>;


