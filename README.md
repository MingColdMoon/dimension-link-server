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

## 打包上线（宝塔）

在项目根目录执行：

```bash
npm run pack
```

或双击 `pack.cmd` / 执行 `.\pack.ps1`。产物在 `release/`：

- `dimension-link-server-<version>-<日期>.tar.gz`
- `dimension-link-server.tar.gz`（同一份最新包）

压缩包不含 `node_modules`。上传到宝塔后解压，执行 `bash install.sh`，再按包内 `DEPLOY.md` 用 Node 项目或 PM2 启动。

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
| GET / POST | `/v1/conversations` | 私信会话 / 拉群 |
| GET | `/v1/conversations/{id}` | 会话详情 |
| GET / POST | `/v1/conversations/{id}/messages` | 聊天（支持图片） |
| POST | `/v1/conversations/{id}/admins` | 设管理员 |
| DELETE | `/v1/conversations/{id}/admins/{userId}` | 取消管理员 |
| POST | `/v1/conversations/{id}/mute` | 成员禁言 / 全员禁言 |
| POST | `/v1/conversations/{id}/kick` | 移出成员 |
| POST | `/v1/conversations/{id}/leave` | 退群 |
| GET | `/v1/notices` | 通知 |
| GET | `/v1/search` | 搜索 |
| GET | `/v1/match/recommend` | 次元匹配：附近 / 同好 / 默契 |
| POST | `/v1/match/{userId}/like` | 心动（未关注则同时关注） |

字段、错误码与分页约定见前端仓库 `docs/backend-api.md`。
