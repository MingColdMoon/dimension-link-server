export class AppError extends Error {
  readonly status: number;
  readonly code: number;

  constructor(status: number, code: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const ErrorCode = {
  USER_NOT_FOUND_LOGIN: 1001,
  BAD_PASSWORD: 1002,
  NICKNAME_TOO_SHORT: 1003,
  PASSWORD_TOO_SHORT: 1004,
  HANDLE_TAKEN: 1005,
  UNAUTHORIZED: 1006,
  POST_NOT_FOUND: 1007,
  CIRCLE_NOT_FOUND: 1008,
  CONVERSATION_NOT_FOUND: 1009,
  USER_NOT_FOUND: 1010,
  EMPTY_CONTENT: 1011,
  FOLLOW_SELF: 1012,
  INVALID_MOOD: 1013,
  GROUP_TOO_SMALL: 1014,
  GROUP_FORBIDDEN: 1015,
  GROUP_MUTED: 1016,
  NOT_GROUP: 1017,
  INVALID_IMAGE: 1018,
  RATE_LIMITED: 4290,
  INTERNAL: 5000,
} as const;
