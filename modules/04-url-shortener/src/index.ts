const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function encodeBase62(num: bigint): string {
  if (num === 0n) return "0";
  let result = "";
  let current = num;
  const base = 62n;

  while (current > 0n) {
    const remainder = Number(current % base);
    result = BASE62_CHARS[remainder] + result;
    current = current / base;
  }
  return result;
}

export function decodeBase62(str: string): bigint {
  let result = 0n;
  const base = 62n;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = BigInt(BASE62_CHARS.indexOf(char));
    if (index === -1n) {
      throw new Error(`Invalid Base62 character: ${char}`);
    }
    result = result * base + index;
  }
  return result;
}
