/**
 * Generic Result<T, E> — a railway-oriented programming primitive.
 * Avoids throwing across module boundaries and forces error handling.
 *
 * Time complexity for all combinators: O(1).
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}
export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

export function map<T, E, U>(r: Result<T, E>, fn: (t: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

export function flatMap<T, E, U>(r: Result<T, E>, fn: (t: T) => Result<U, E>): Result<U, E> {
  return r.ok ? fn(r.value) : r;
}

export function match<T, E, R>(
  r: Result<T, E>,
  arms: { ok: (v: T) => R; err: (e: E) => R },
): R {
  return r.ok ? arms.ok(r.value) : arms.err(r.error);
}

/** Lift an async fn into a Result-returning fn, catching thrown errors. */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

