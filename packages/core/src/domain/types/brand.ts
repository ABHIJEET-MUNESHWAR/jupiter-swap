/**
 * Brand types — enforce semantic constraints at compile time without runtime cost.
 *
 * @example
 *   const m: MintAddress = mintAddress("So11111111111111111111111111111111111111112");
 *   // const bad: MintAddress = "hello"; // ❌ compile error
 */
export type Brand<T, K extends string> = T & { readonly __brand: K };

export type MintAddress = Brand<string, 'MintAddress'>;
export type WalletAddress = Brand<string, 'WalletAddress'>;
export type Lamports = Brand<bigint, 'Lamports'>;
export type Bps = Brand<number, 'Bps'>;
export type RequestId = Brand<string, 'RequestId'>;
export type Base64Tx = Brand<string, 'Base64Tx'>;

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function mintAddress(s: string): MintAddress {
  if (!BASE58_RE.test(s)) throw new Error(`Invalid mint address: ${s}`);
  return s as MintAddress;
}

export function walletAddress(s: string): WalletAddress {
  if (!BASE58_RE.test(s)) throw new Error(`Invalid wallet address: ${s}`);
  return s as WalletAddress;
}

export function lamports(n: bigint | number | string): Lamports {
  const v = typeof n === 'bigint' ? n : BigInt(n);
  if (v < 0n) throw new Error(`Lamports must be non-negative, got ${v}`);
  return v as Lamports;
}

export function bps(n: number): Bps {
  if (!Number.isInteger(n) || n < 0 || n > 10_000) {
    throw new Error(`Bps must be integer in [0,10000], got ${n}`);
  }
  return n as Bps;
}

export function requestId(s: string): RequestId {
  if (!s) throw new Error('Empty requestId');
  return s as RequestId;
}

export function base64Tx(s: string): Base64Tx {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) throw new Error('Invalid base64 transaction');
  return s as Base64Tx;
}

/** Exhaustiveness helper for discriminated-union switches. */
export function assertNever(x: never, msg = 'Non-exhaustive switch'): never {
  throw new Error(`${msg}: ${JSON.stringify(x)}`);
}

