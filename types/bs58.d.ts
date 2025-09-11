declare module 'bs58' {
  export function encode(buffer: Uint8Array | Buffer): string;
  export function decode(string: string): Buffer;
  const bs58: {
    encode: typeof encode;
    decode: typeof decode;
  };
  export default bs58;
}