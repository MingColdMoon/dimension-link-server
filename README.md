# Dimension Link Server

次元链接（Dimension Link）后端，对齐 Flutter 客户端 `docs/backend-api.md`。

- 框架：Koa
- 存储：PostgreSQL
- 会话 / 限流：Redis
- Base URL：`http://127.0.0.1:8080/v1`

## 快速启动

```bash
cp .env.example .env
npm install
npm run docker:up
npm run dev
```

- 存活：`GET /health`
- 就绪：`GET /ready`
- Swagger：`http://127.0.0.1:8080/docs`（规格 JSON：`/docs/openapi.json`）
- 演示账号：昵称 `星野铃`，口令 `123456`

生成静态 OpenAPI 文件：

```bash
npm run docs:gen
```

输出为 `docs/openapi.json`。

本地已有 PostgreSQL 占用 5432 时，Compose 把数据库映射到 **5433**。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/auth/register` | 注册并登录 |
| POST | `/v1/auth/login` | 登录 |
| POST | `/v1/auth/refresh` | 刷新 token |
| POST | `/v1/auth/logout` | 登出 |
| GET / PATCH | `/v1/me` | 当前住民 |
| GET | `/v1/users/{id}` | 住民主页 |
| POST | `/v1/users/{id}/follow` | 关注 toggle |
| GET / POST | `/v1/posts` | 广场 / 发布 |
| POST | `/v1/posts/{id}/like` | 点赞 toggle |
| POST | `/v1/posts/{id}/star` | 星标 toggle |
| GET / POST | `/v1/posts/{id}/comments` | 评论 |
| GET | `/v1/circles` | 圈子 |
| POST | `/v1/circles/{id}/join` | 加入 toggle |
| GET / POST | `/v1/conversations` | 私信会话 |
| GET / POST | `/v1/conversations/{id}/messages` | 聊天 |
| GET | `/v1/notices` | 通知 |
| GET | `/v1/search` | 搜索 |

字段、错误码与分页约定见前端仓库 `docs/backend-api.md`。
