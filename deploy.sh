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

# 5. 自动修改 Nginx 配置
echo "[5/5] 自动添加 WebSocket 反代规则到 Nginx..."

# 查找 Nginx 配置文件
NGINX_CONF=""
SEARCH_PATHS=(
  "/usr/local/openresty/nginx/conf/conf.d"
  "/etc/nginx/conf.d"
  "/etc/nginx/sites-enabled"
  "/etc/nginx/sites-available"
  "/www/sites/penmods/conf"
  "/opt/1panel"
)

for dir in "${SEARCH_PATHS[@]}"; do
  found=$(grep -rl "server_name.*pen.skdkzzx.dpdns.org" "$dir" 2>/dev/null || true)
  if [ -n "$found" ]; then
    NGINX_CONF=$(echo "$found" | head -1)
    break
  fi
done

if [ -z "$NGINX_CONF" ]; then
  NGINX_CONF=$(find / -path "*/penmods*" -name "*.conf" -type f 2>/dev/null | head -1)
fi

if [ -n "$NGINX_CONF" ]; then
  echo "  找到配置文件: $NGINX_CONF"
  if grep -q "location /ws/ssh" "$NGINX_CONF" 2>/dev/null; then
    echo "  配置已存在，跳过"
  else
    # 在最后一个 } 前插入（用 awk 处理多行，避免 sed 转义问题）
    awk '
      /^}/ && !found {
        print "    location /ws/ssh {"
        print "        proxy_pass http://127.0.0.1:8022;"
        print "        proxy_http_version 1.1;"
        print "        proxy_set_header Upgrade $http_upgrade;"
        print "        proxy_set_header Connection \"upgrade\";"
        print "        proxy_set_header Host $host;"
        print "        proxy_set_header X-Real-IP $remote_addr;"
        print "        proxy_read_timeout 86400s;"
        print "    }"
        found = 1
      }
      { print }
    ' "$NGINX_CONF" > "${NGINX_CONF}.tmp" && mv "${NGINX_CONF}.tmp" "$NGINX_CONF"
    echo "  已添加 WebSocket 反代规则"
  fi

  # 测试配置
  if nginx -t 2>/dev/null || openresty -t 2>/dev/null; then
    nginx -s reload 2>/dev/null || openresty -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || systemctl reload openresty 2>/dev/null || echo "  请手动重载 Nginx"
    echo "  Nginx 已重载"
  else
    echo "  ⚠️ Nginx 配置测试失败，请手动检查"
  fi
else
  echo "  ⚠️ 未找到 Nginx 配置文件，请手动添加规则："
  echo '    location /ws/ssh {'
  echo '        proxy_pass http://127.0.0.1:8022;'
  echo '        proxy_http_version 1.1;'
  echo '        proxy_set_header Upgrade $http_upgrade;'
  echo '        proxy_set_header Connection "upgrade";'
  echo '        proxy_set_header Host $host;'
  echo '        proxy_set_header X-Real-IP $remote_addr;'
  echo '        proxy_read_timeout 86400s;'
  echo '    }'
fi

echo ""
echo "============================================"
echo "  ✅ 全部部署完成！"
echo "============================================"
echo ""
echo "  代理服务状态: $(systemctl is-active penmods-ws 2>/dev/null || echo 'unknown')"
echo "  WebSocket 端点: ws://pen.skdkzzx.dpdns.org/ws/ssh"
echo "  访问网站: http://pen.skdkzzx.dpdns.org"
echo "============================================"