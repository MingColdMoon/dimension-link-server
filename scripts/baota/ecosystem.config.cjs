/**
 * 宝塔 / PM2（进程管理器）启动配置。
 * 在解压后的项目根目录执行：pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "dimension-link-server",
      script: "dist/main.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      listen_timeout: 10000,
      kill_timeout: 8000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
