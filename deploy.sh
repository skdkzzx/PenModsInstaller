#!/bin/bash
# PenMods Installer — 一键部署脚本（1Panel + Nginx 反代场景）
# 用法: bash deploy.sh <网站目录>
# 示例: bash deploy.sh /opt/1panel/www/sites/penmods

set -e

SITE_DIR="${1:-/opt/1panel/www/sites/penmods}"
PROXY_DIR="/opt/penmods-proxy"
PORT="${2:-8022}"

echo "============================================"
echo "  PenMods Installer — 一键部署"
echo "============================================"

# 1. 检查 Node.js
if ! command -v node &>/dev/null; then
    echo "[1/5] 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[1/5] Node.js 已就绪: $(node -v)"
fi

# 2. 创建代理目录
echo "[2/5] 部署代理服务到 $PROXY_DIR..."
mkdir -p "$PROXY_DIR"

# 复制必要文件（如果当前在项目目录中）
if [ -f "server.mjs" ]; then
    cp server.mjs package.json package-lock.json "$PROXY_DIR/"
else
    # 从 GitHub 拉取
    cd "$PROXY_DIR"
    npm init -y >/dev/null
    curl -sL "https://raw.githubusercontent.com/skdkzzx/PenModsInstaller/main/server.mjs" -o server.mjs
fi

# 3. 安装依赖
echo "[3/5] 安装依赖..."
cd "$PROXY_DIR"
npm install ws ssh2 2>&1 | tail -2

# 4. 安装 systemd 服务（开机自启）
echo "[4/5] 注册 systemd 服务..."
cat > /etc/systemd/system/penmods-ws.service << 'SERVICEEOF'
[Unit]
Description=PenMods Installer — WebSocket SSH 代理
After=network.target

[Service]
Type=simple
User=nobody
Group=nogroup
Restart=always
RestartSec=5
WorkingDirectory=/opt/penmods-proxy
ExecStart=/usr/bin/node /opt/penmods-proxy/server.mjs --ws-only 8022
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable penmods-ws
systemctl restart penmods-ws

# 5. 生成 Nginx 配置片段
echo "[5/5] 生成 Nginx 配置片段..."
cat > /tmp/penmods-nginx.conf << 'NGINXEOF'
# 把这个加到 1Panel 网站配置的 server block 中
location /ws/ssh {
    proxy_pass http://127.0.0.1:8022;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 86400s;
}
NGINXEOF

echo ""
echo "============================================"
echo "  ✅ 部署完成！"
echo "============================================"
echo ""
echo "  代理服务已启动: 127.0.0.1:$PORT"
echo "  状态: $(systemctl is-active penmods-ws)"
echo ""
echo "  最后一步：在 1Panel 网站设置中添加反向代理规则"
echo "  配置内容已保存到: /tmp/penmods-nginx.conf"
echo "  复制粘贴到 1Panel → 网站 → 配置文件 即可"
echo ""
echo "  内容如下："
cat /tmp/penmods-nginx.conf
echo ""
echo "============================================"