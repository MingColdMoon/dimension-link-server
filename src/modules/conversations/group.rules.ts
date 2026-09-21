export type GroupRole = "owner" | "admin" | "member";

export function resolveRole(ownerId: string | null | undefined, adminIds: string[], userId: string): GroupRole {
  if (ownerId && ownerId === userId) {
    return "owner";
  }
  if (adminIds.includes(userId)) {
    return "admin";
  }
  return "member";
}

export function canSpeak(role: GroupRole, groupMuted: boolean, memberMuted: boolean): boolean {
  if (role === "owner") {
    return true;
  }
  if (memberMuted) {
    return false;
  }
  if (role === "admin") {
    return true;
  }
  return !groupMuted;
}

export function canSetAdmin(actor: GroupRole): boolean {
  return actor === "owner";
}

export function canMute(actor: GroupRole, target: GroupRole): boolean {
  if (actor === "owner") {
    return target !== "owner";
  }
  if (actor === "admin") {
    return target === "member";
  }
  return false;
}

export function canKick(actor: GroupRole, target: GroupRole): boolean {
  return canMute(actor, target);
}

export function canToggleGroupMute(actor: GroupRole): boolean {
  return actor === "owner" || actor === "admin";
}

export function nextOwner(ownerId: string, adminIds: string[], memberIds: string[]): string | null {
  const rest = memberIds.filter((id) => id !== ownerId);
  const admin = adminIds.find((id) => rest.includes(id));
  return admin ?? rest[0] ?? null;
}
