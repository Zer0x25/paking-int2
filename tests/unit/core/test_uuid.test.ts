import { describe, expect, it, vi } from "vitest";
import { createUuid } from "@core/utils/uuid";

describe("createUuid", () => {
  it("uses crypto.randomUUID when the runtime provides it", () => {
    const id = "89abcdef-0123-4567-89ab-cdef01234567";
    const randomUUID = vi.fn(() => id);
    const getRandomValues = vi.fn();
    const cryptoProvider = { randomUUID, getRandomValues } as unknown as Crypto;

    expect(createUuid(cryptoProvider)).toBe(id);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("builds a secure UUID v4 with getRandomValues when randomUUID is missing", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: bytes.length }, (_, index) => index));
      return bytes;
    });
    const cryptoProvider = { getRandomValues } as unknown as Crypto;

    expect(createUuid(cryptoProvider)).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("fails clearly when secure randomness is unavailable", () => {
    const cryptoProvider = {} as Crypto;

    expect(() => createUuid(cryptoProvider)).toThrow(/Web Crypto/i);
  });
});
