import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/common/password.js";

describe("密码摘要", () => {
  it("相同密码可以校验通过，错误密码会被拒绝", async () => {
    const stored = await hashPassword("password123");
    expect(stored.includes(":")).toBe(true);
    expect(await verifyPassword("password123", stored)).toBe(true);
    expect(await verifyPassword("password124", stored)).toBe(false);
  });
});
