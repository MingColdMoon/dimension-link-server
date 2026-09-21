/** OpenAPI 3.0 文档：与现有 /v1 契约对齐，供 Swagger UI 与静态导出使用 */
export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "次元链接 API",
    description:
      "Dimension Link 微服务接口。成功响应为 `{ code: 0, message: 'ok', data }`；失败时 HTTP 状态码按语义返回，body 同样包一层。鉴权头：`Authorization: Bearer {accessToken}`。",
    version: "1.0.0",
  },
  servers: [
    { url: "/", description: "当前服务" },
    { url: "http://127.0.0.1:8080", description: "本地开发" },
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "健康检查", description: "存活与依赖探测" },
    { name: "认证", description: "注册、登录、刷新与登出" },
    { name: "住民", description: "当前用户、主页与关注" },
    { name: "动态", description: "广场、发布、点赞、星标、评论" },
    { name: "圈子", description: "圈子列表与加入" },
    { name: "私信", description: "会话、消息、群管理与已读" },
    { name: "通知", description: "系统通知" },
    { name: "搜索", description: "住民 / 圈子 / 动态" },
    { name: "匹配", description: "AI 推荐附近、同好与默契住民" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "登录或注册返回的 accessToken",
      },
    },
    parameters: {
      Cursor: {
        name: "cursor",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "上一页返回的 nextCursor，首页不传",
      },
      Limit: {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", default: 20, minimum: 1, maximum: 50 },
        description: "每页条数，默认 20，最大 50",
      },
    },
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          code: { type: "integer", example: 1006 },
          message: { type: "string", example: "请先登录" },
          data: { nullable: true, example: null },
        },
      },
      UserPublic: {
        type: "object",
        properties: {
          id: { type: "string", example: "u_me" },
          nickname: { type: "string", example: "星野铃" },
          handle: { type: "string", example: "@hoshi_suzu" },
          bio: { type: "string" },
          signature: { type: "string" },
          emoji: { type: "string", example: "🎀" },
          accentIndex: { type: "integer", minimum: 0, maximum: 7 },
          followers: { type: "integer" },
          following: { type: "integer" },
          level: { type: "integer" },
          badges: { type: "array", items: { type: "string" } },
          isFollowing: { type: "boolean" },
          city: { type: "string", example: "上海" },
          district: { type: "string", example: "徐汇" },
          hobbies: { type: "array", items: { type: "string" } },
          joinedCircleIds: {
            type: "array",
            items: { type: "string" },
            description: "仅 GET /v1/me 返回",
          },
        },
      },
      AuthPayload: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
          expiresIn: { type: "integer", example: 7200, description: "accessToken 有效期（秒）" },
          user: { $ref: "#/components/schemas/UserPublic" },
        },
      },
      CircleSummary: {
        type: "object",
        properties: {
          id: { type: "string", example: "c_cos" },
          name: { type: "string", example: "COSPLAY" },
          emoji: { type: "string", example: "👗" },
        },
      },
      CircleItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          emoji: { type: "string" },
          desc: { type: "string" },
          memberCount: { type: "integer" },
          accentIndex: { type: "integer" },
          tags: { type: "array", items: { type: "string" } },
          joined: { type: "boolean" },
        },
      },
      CommentItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          user: { $ref: "#/components/schemas/UserPublic" },
          content: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      PostCard: {
        type: "object",
        properties: {
          id: { type: "string", example: "p1" },
          author: { $ref: "#/components/schemas/UserPublic" },
          content: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          mood: {
            type: "string",
            enum: ["happy", "excited", "sleepy", "love", "sad", "fire"],
          },
          circle: { $ref: "#/components/schemas/CircleSummary" },
          imageHue: { type: "integer", minimum: 0, maximum: 359 },
          imageTitle: { type: "string" },
          likeCount: { type: "integer" },
          starCount: { type: "integer" },
          commentCount: { type: "integer" },
          liked: { type: "boolean" },
          starred: { type: "boolean" },
          comments: {
            type: "array",
            items: { $ref: "#/components/schemas/CommentItem" },
            description: "仅详情接口可能附带前 N 条",
          },
        },
      },
      ChatMessageItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          senderId: { type: "string" },
          text: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          kind: { type: "string", enum: ["text", "image", "system"] },
          imageUrl: { type: "string", nullable: true },
        },
      },
      ConversationItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: { type: "string", enum: ["direct", "group"] },
          title: { type: "string", nullable: true },
          ownerId: { type: "string", nullable: true },
          adminIds: { type: "array", items: { type: "string" } },
          mutedUserIds: { type: "array", items: { type: "string" } },
          groupMuted: { type: "boolean" },
          members: { type: "array", items: { $ref: "#/components/schemas/UserPublic" } },
          peer: { $ref: "#/components/schemas/UserPublic" },
          unread: { type: "integer" },
          lastMessage: { allOf: [{ $ref: "#/components/schemas/ChatMessageItem" }], nullable: true },
        },
      },
      NoticeItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          kind: { type: "string", enum: ["badge", "star", "circle", "like", "follow", "comment", "group"] },
        },
      },
      PageMeta: {
        type: "object",
        properties: {
          nextCursor: { type: "string", nullable: true },
          hasMore: { type: "boolean" },
        },
      },
      MatchCandidate: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/UserPublic" },
          mode: { type: "string", enum: ["nearby", "hobby", "affinity"] },
          score: { type: "integer", minimum: 1, maximum: 99, example: 92 },
          distanceKm: { type: "number", example: 1.2 },
          city: { type: "string", example: "上海" },
          district: { type: "string", example: "徐汇" },
          hobbies: { type: "array", items: { type: "string" }, example: ["插画", "同人"] },
          sharedHobbies: { type: "array", items: { type: "string" }, example: ["插画"] },
          reason: { type: "string", example: "次元共振 92%：因插画紧紧咬合。" },
          online: { type: "boolean" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["健康检查"],
        summary: "存活检查",
        security: [],
        responses: {
          "200": {
            description: "服务进程正常",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    code: { type: "integer", example: 0 },
                    message: { type: "string", example: "ok" },
                    data: {
                      type: "object",
                      properties: {
                        status: { type: "string", example: "ok" },
                        service: { type: "string", example: "dimension-link-server" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/ready": {
      get: {
        tags: ["健康检查"],
        summary: "就绪检查",
        description: "探测 PostgreSQL 与 Redis",
        security: [],
        responses: {
          "200": {
            description: "依赖可用",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    code: { type: "integer" },
                    message: { type: "string" },
                    data: {
                      type: "object",
                      properties: {
                        status: { type: "string", example: "ready" },
                        postgres: { type: "boolean" },
                        redis: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/auth/register": {
      post: {
        tags: ["认证"],
        summary: "注册并登录",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nickname", "password"],
                properties: {
                  nickname: { type: "string", example: "星野铃", description: "去空白后至少 2 个字符" },
                  handle: { type: "string", example: "suzu", description: "不要强求带 @，空则生成 user_{n}" },
                  password: { type: "string", example: "123456", description: "至少 4 位" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "注册成功即登录", content: { "application/json": { schema: success("AuthPayload") } } },
          "409": error(1005, "这个 @ 已经被占用啦"),
          "422": error(1003, "昵称再可爱一点点"),
        },
      },
    },
    "/v1/auth/login": {
      post: {
        tags: ["认证"],
        summary: "登录",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["identifier", "password"],
                properties: {
                  identifier: {
                    type: "string",
                    example: "星野铃",
                    description: "昵称、hoshi_suzu 或 @hoshi_suzu",
                  },
                  password: { type: "string", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "登录成功", content: { "application/json": { schema: success("AuthPayload") } } },
          "401": error(1002, "通行证口令不对哦"),
          "404": error(1001, "找不到这位次元住民"),
        },
      },
    },
    "/v1/auth/refresh": {
      post: {
        tags: ["认证"],
        summary: "刷新 token",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "返回新的 token 对", content: { "application/json": { schema: success("AuthPayload") } } },
          "401": error(1006, "请先登录"),
        },
      },
    },
    "/v1/auth/logout": {
      post: {
        tags: ["认证"],
        summary: "登出",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { refreshToken: { type: "string", description: "可选，作废对应 refresh" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "已作废会话",
            content: {
              "application/json": {
                schema: successInline({
                  type: "object",
                  properties: { success: { type: "boolean", example: true } },
                }),
              },
            },
          },
          "401": error(1006, "请先登录"),
        },
      },
    },
    "/v1/me": {
      get: {
        tags: ["住民"],
        summary: "当前住民",
        responses: {
          "200": { description: "含 joinedCircleIds", content: { "application/json": { schema: success("UserPublic") } } },
          "401": error(1006, "请先登录"),
        },
      },
      patch: {
        tags: ["住民"],
        summary: "更新资料",
        description: "只更新传入字段。handle、emoji、level、badges 本期只读。",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  nickname: { type: "string" },
                  bio: { type: "string" },
                  signature: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新后的当前用户", content: { "application/json": { schema: success("UserPublic") } } },
          "401": error(1006, "请先登录"),
        },
      },
    },
    "/v1/users/{userId}": {
      get: {
        tags: ["住民"],
        summary: "住民主页",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", example: "u_sakurai" } }],
        responses: {
          "200": { description: "含 isFollowing", content: { "application/json": { schema: success("UserPublic") } } },
          "404": error(1010, "住民不存在"),
        },
      },
    },
    "/v1/users/{userId}/follow": {
      post: {
        tags: ["住民"],
        summary: "关注 / 取关",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "toggle 后的状态",
            content: {
              "application/json": {
                schema: successInline({
                  type: "object",
                  properties: {
                    isFollowing: { type: "boolean" },
                    followers: { type: "integer" },
                  },
                }),
              },
            },
          },
          "400": error(1012, "不能关注自己"),
          "404": error(1010, "住民不存在"),
        },
      },
    },
    "/v1/posts": {
      get: {
        tags: ["动态"],
        summary: "动态列表",
        description: "都不传为广场时间线；authorId 为某人动态；circleId 为圈子动态。倒序。",
        parameters: [
          { $ref: "#/components/parameters/Cursor" },
          { $ref: "#/components/parameters/Limit" },
          { name: "authorId", in: "query", schema: { type: "string" } },
          { name: "circleId", in: "query", schema: { type: "string", example: "c_art" } },
        ],
        responses: {
          "200": {
            description: "分页动态",
            content: { "application/json": { schema: successInline(page("PostCard")) } },
          },
        },
      },
      post: {
        tags: ["动态"],
        summary: "发布动态",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content", "circleId"],
                properties: {
                  content: { type: "string", example: "今日速写：把发卡画成了小行星环。" },
                  circleId: { type: "string", example: "c_art" },
                  mood: {
                    type: "string",
                    enum: ["happy", "excited", "sleepy", "love", "sad", "fire"],
                    example: "happy",
                  },
                  imageTitle: { type: "string", example: "行星发卡", description: "空或省略则为「今日速记」" },
                  imageHue: { type: "integer", example: 312, description: "省略则随机 0–359" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "完整 PostCard", content: { "application/json": { schema: success("PostCard") } } },
          "404": error(1008, "圈子不存在"),
          "422": error(1011, "先写点什么再发布吧"),
        },
      },
    },
    "/v1/posts/{postId}": {
      get: {
        tags: ["动态"],
        summary: "动态详情",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "string", example: "p1" } }],
        responses: {
          "200": { description: "可附带 comments 前 N 条", content: { "application/json": { schema: success("PostCard") } } },
          "404": error(1007, "动态不存在"),
        },
      },
    },
    "/v1/posts/{postId}/like": {
      post: {
        tags: ["动态"],
        summary: "点赞 toggle",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "以响应布尔值为准",
            content: {
              "application/json": {
                schema: successInline({
                  type: "object",
                  properties: { liked: { type: "boolean" }, likeCount: { type: "integer" } },
                }),
              },
            },
          },
        },
      },
    },
    "/v1/posts/{postId}/star": {
      post: {
        tags: ["动态"],
        summary: "星标 toggle",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "星标他人动态时给作者写通知",
            content: {
              "application/json": {
                schema: successInline({
                  type: "object",
                  properties: { starred: { type: "boolean" }, starCount: { type: "integer" } },
                }),
              },
            },
          },
        },
      },
    },
    "/v1/posts/{postId}/comments": {
      get: {
        tags: ["动态"],
        summary: "评论列表",
        description: "时间正序",
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "string" } },
          { $ref: "#/components/parameters/Cursor" },
          { $ref: "#/components/parameters/Limit" },
        ],
        responses: {
          "200": { description: "分页评论", content: { "application/json": { schema: successInline(page("CommentItem")) } } },
        },
      },
      post: {
        tags: ["动态"],
        summary: "发表评论",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: { content: { type: "string", example: "星星眼睛好会！" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "新建评论", content: { "application/json": { schema: success("CommentItem") } } },
          "422": error(1011, "先写点什么再发布吧"),
        },
      },
    },
    "/v1/circles": {
      get: {
        tags: ["圈子"],
        summary: "圈子列表",
        responses: {
          "200": {
            description: "全量圈子",
            content: {
              "application/json": {
                schema: successInline({ type: "array", items: { $ref: "#/components/schemas/CircleItem" } }),
              },
            },
          },
        },
      },
    },
    "/v1/circles/{circleId}": {
      get: {
        tags: ["圈子"],
        summary: "圈子详情",
        parameters: [{ name: "circleId", in: "path", required: true, schema: { type: "string", example: "c_doujin" } }],
        responses: {
          "200": { description: "单个圈子", content: { "application/json": { schema: success("CircleItem") } } },
          "404": error(1008, "圈子不存在"),
        },
      },
    },
    "/v1/circles/{circleId}/join": {
      post: {
        tags: ["圈子"],
        summary: "加入 / 退出",
        parameters: [{ name: "circleId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "toggle 后的状态",
            content: {
              "application/json": {
                schema: successInline({
                  type: "object",
                  properties: { joined: { type: "boolean" }, memberCount: { type: "integer" } },
                }),
              },
            },
          },
        },
      },
    },
    "/v1/conversations": {
      get: {
        tags: ["私信"],
        summary: "会话列表",
        responses: {
          "200": {
            description: "按最后消息时间倒序",
            content: {
              "application/json": {
                schema: successInline({ type: "array", items: { $ref: "#/components/schemas/ConversationItem" } }),
              },
            },
          },
        },
      },
      post: {
        tags: ["私信"],
        summary: "确保私信或拉群",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  peerId: { type: "string", example: "u_sakurai", description: "一对一私信" },
                  memberIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "拉群成员，至少两位（不含自己）",
                  },
                  title: { type: "string", example: "漫展小队" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "已存在则返回已有私信，或新建群聊", content: { "application/json": { schema: success("ConversationItem") } } },
        },
      },
    },
    "/v1/conversations/{id}/messages": {
      get: {
        tags: ["私信"],
        summary: "聊天记录",
        description: "时间正序",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", example: "cv1" } },
          { $ref: "#/components/parameters/Cursor" },
          { $ref: "#/components/parameters/Limit" },
        ],
        responses: {
          "200": { description: "分页消息", content: { "application/json": { schema: successInline(page("ChatMessageItem")) } } },
          "404": error(1009, "会话不存在"),
        },
      },
      post: {
        tags: ["私信"],
        summary: "发送消息",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  text: { type: "string", example: "来！我带新画的小立牌。" },
                  kind: { type: "string", enum: ["text", "image"] },
                  imageUrl: { type: "string", example: "illustration:330", description: "插画卡或 /uploads 地址" },
                  imageBase64: { type: "string", description: "相册图片的 Base64" },
                  mimeType: { type: "string", example: "image/jpeg" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "新建消息", content: { "application/json": { schema: success("ChatMessageItem") } } },
          "403": error(1016, "你已被禁言"),
          "422": error(1011, "先写点什么再发布吧"),
        },
      },
    },
    "/v1/conversations/{id}": {
      get: {
        tags: ["私信"],
        summary: "会话详情",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "当前用户可见的会话", content: { "application/json": { schema: success("ConversationItem") } } },
        },
      },
    },
    "/v1/conversations/{id}/admins": {
      post: {
        tags: ["私信"],
        summary: "设为管理员（群主）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["userId"], properties: { userId: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "更新后的群", content: { "application/json": { schema: success("ConversationItem") } } },
          "403": error(1015, "只有群主能设置管理员"),
        },
      },
    },
    "/v1/conversations/{id}/admins/{userId}": {
      delete: {
        tags: ["私信"],
        summary: "取消管理员（群主）",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "更新后的群", content: { "application/json": { schema: success("ConversationItem") } } },
        },
      },
    },
    "/v1/conversations/{id}/mute": {
      post: {
        tags: ["私信"],
        summary: "禁言 / 解禁",
        description: "传 userId 则禁言该成员；不传则全员禁言。",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["muted"],
                properties: { userId: { type: "string" }, muted: { type: "boolean" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新后的群", content: { "application/json": { schema: success("ConversationItem") } } },
          "403": error(1015, "没有权限禁言这位住民"),
        },
      },
    },
    "/v1/conversations/{id}/kick": {
      post: {
        tags: ["私信"],
        summary: "移出群成员",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["userId"], properties: { userId: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "更新后的群", content: { "application/json": { schema: success("ConversationItem") } } },
        },
      },
    },
    "/v1/conversations/{id}/leave": {
      post: {
        tags: ["私信"],
        summary: "退群",
        description: "群主退群会把群主交给管理员或下一位成员；最后一人退群则解散。",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "已离开",
            content: {
              "application/json": {
                schema: successInline({ type: "object", properties: { left: { type: "boolean", example: true } } }),
              },
            },
          },
        },
      },
    },
    "/v1/conversations/{id}/read": {
      post: {
        tags: ["私信"],
        summary: "标记已读",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "未读清零",
            content: {
              "application/json": {
                schema: successInline({
                  type: "object",
                  properties: { unread: { type: "integer", example: 0 } },
                }),
              },
            },
          },
        },
      },
    },
    "/v1/notices": {
      get: {
        tags: ["通知"],
        summary: "通知列表",
        parameters: [{ $ref: "#/components/parameters/Cursor" }, { $ref: "#/components/parameters/Limit" }],
        responses: {
          "200": { description: "时间倒序", content: { "application/json": { schema: successInline(page("NoticeItem")) } } },
        },
      },
    },
    "/v1/match/recommend": {
      get: {
        tags: ["匹配"],
        summary: "AI 推荐附近 / 同好 / 默契住民",
        parameters: [
          {
            name: "mode",
            in: "query",
            schema: { type: "string", enum: ["nearby", "hobby", "affinity"], default: "affinity" },
            description: "nearby 附近 / hobby 同好 / affinity 默契",
          },
          { $ref: "#/components/parameters/Limit" },
        ],
        responses: {
          "200": {
            description: "按推荐分倒序，不含自己与已心动对象",
            content: { "application/json": { schema: successInline(page("MatchCandidate")) } },
          },
        },
      },
    },
    "/v1/match/{userId}/like": {
      post: {
        tags: ["匹配"],
        summary: "对住民心动",
        description: "记录心动并在尚未关注时自动关注。重复调用仍返回 liked=true。",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", example: "u_yukimi" } }],
        responses: {
          "200": {
            description: "已记录心动",
            content: {
              "application/json": {
                schema: successInline({
                  type: "object",
                  properties: { liked: { type: "boolean", example: true } },
                }),
              },
            },
          },
          "400": error(1012, "不能关注自己"),
          "404": error(1010, "住民不存在"),
        },
      },
    },
    "/v1/search": {
      get: {
        tags: ["搜索"],
        summary: "搜索住民、圈子、动态",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "可为空，空则返回推荐/全量截断" },
          { $ref: "#/components/parameters/Limit" },
        ],
        responses: {
          "200": {
            description: "三类结果",
            content: {
              "application/json": {
                schema: successInline({
                  type: "object",
                  properties: {
                    users: { type: "array", items: { $ref: "#/components/schemas/UserPublic" } },
                    circles: { type: "array", items: { $ref: "#/components/schemas/CircleItem" } },
                    posts: { type: "array", items: { $ref: "#/components/schemas/PostCard" } },
                  },
                }),
              },
            },
          },
        },
      },
    },
  },
} as const;

function success(schema: string) {
  return {
    type: "object",
    properties: {
      code: { type: "integer", example: 0 },
      message: { type: "string", example: "ok" },
      data: { $ref: `#/components/schemas/${schema}` },
    },
  };
}

function successInline(dataSchema: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      code: { type: "integer", example: 0 },
      message: { type: "string", example: "ok" },
      data: dataSchema,
    },
  };
}

function page(itemSchema: string) {
  return {
    type: "object",
    properties: {
      items: { type: "array", items: { $ref: `#/components/schemas/${itemSchema}` } },
      nextCursor: { type: "string", nullable: true },
      hasMore: { type: "boolean" },
    },
  };
}

function error(code: number, message: string) {
  return {
    description: message,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ApiError" },
        example: { code, message, data: null },
      },
    },
  };
}
