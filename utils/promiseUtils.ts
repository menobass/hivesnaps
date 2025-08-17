// Small helpers for working with Promises in a type-safe, concise way

export function isPromise<T = any>(val: any): val is Promise<T> {
  return !!val && typeof (val as any).then === 'function';
}

export function addPromiseIfValid<T = any>(maybePromise: any, ops: Promise<any>[]) {
  if (isPromise<T>(maybePromise)) ops.push(maybePromise as Promise<any>);
}
