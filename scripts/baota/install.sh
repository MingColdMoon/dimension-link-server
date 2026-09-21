#!/usr/bin/env bash
# 宝塔服务器端安装：在解压后的项目根目录执行 bash install.sh
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请先在宝塔「软件商店」安装 Node.js（>= 20）。" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm，请检查 Node.js 安装是否完整。" >&2
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 20 ]; then
  echo "当前 Node.js 版本过低（$(node -v)），需要 >= 20。" >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已根据 .env.example 生成 .env，请先改好 PostgreSQL / Redis / JWT 再启动。"
fi

if grep -q "请改成" .env; then
  echo "警告：.env 仍含占位符，请改完数据库密码和 JWT_SECRET 再启动。"
fi

echo "正在安装生产依赖（不含开发依赖）..."
npm ci --omit=dev

echo "依赖安装完成。"
echo "接下来可以："
echo "  1) 宝塔「Node 项目」：启动文件填 dist/main.js，端口 8080"
echo "  2) 或执行：pm2 start ecosystem.config.cjs"
