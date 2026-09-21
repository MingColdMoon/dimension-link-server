import { describe, expect, it } from "vitest";
import {
  canKick,
  canMute,
  canSetAdmin,
  canSpeak,
  canToggleGroupMute,
  nextOwner,
  resolveRole,
} from "../src/modules/conversations/group.rules.js";

describe("群聊权限规则", () => {
  it("能识别群主、管理员和普通成员", () => {
    expect(resolveRole("u_me", ["u_sakurai"], "u_me")).toBe("owner");
    expect(resolveRole("u_me", ["u_sakurai"], "u_sakurai")).toBe("admin");
    expect(resolveRole("u_me", ["u_sakurai"], "u_tsukimi")).toBe("member");
  });

  it("普通成员在禁言时不能发言，管理员被单独禁言后也不能发言", () => {
    expect(canSpeak("member", false, true)).toBe(false);
    expect(canSpeak("member", true, false)).toBe(false);
    expect(canSpeak("admin", true, false)).toBe(true);
    expect(canSpeak("admin", false, true)).toBe(false);
    expect(canSpeak("owner", true, true)).toBe(true);
    expect(canSpeak("member", false, false)).toBe(true);
  });

  it("只有群主能设管理员，管理员只能管普通成员", () => {
    expect(canSetAdmin("owner")).toBe(true);
    expect(canSetAdmin("admin")).toBe(false);
    expect(canMute("owner", "admin")).toBe(true);
    expect(canMute("admin", "owner")).toBe(false);
    expect(canMute("admin", "member")).toBe(true);
    expect(canKick("member", "member")).toBe(false);
    expect(canToggleGroupMute("admin")).toBe(true);
    expect(canToggleGroupMute("member")).toBe(false);
  });

  it("群主离开时把位置交给管理员", () => {
    expect(nextOwner("u_me", ["u_sakurai"], ["u_me", "u_sakurai", "u_tsukimi"])).toBe("u_sakurai");
    expect(nextOwner("u_me", [], ["u_me", "u_tsukimi"])).toBe("u_tsukimi");
    expect(nextOwner("u_me", [], ["u_me"])).toBeNull();
  });
});
