<div align="center">
  <img src="public/icon.svg" width="96" height="96" alt="PenMods Installer">
  <h1>PenMods Installer</h1>
  <p><strong>有道词典笔 PenMods 增强工具 — 一体化网页安装器</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React 19">
    <img src="https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript" alt="TypeScript 6">
    <img src="https://img.shields.io/badge/Vite-8-646cff?logo=vite" alt="Vite 8">
    <img src="https://img.shields.io/badge/license-GPLv3-blue" alt="GPL-3.0">
    <img src="https://img.shields.io/badge/PWA-enabled-5a0fc8" alt="PWA">
  </p>
</div>

---

> ⚠️ **免责声明**  
> 本工具是**第三方独立开源项目**，与网易有道公司**无任何隶属关系**，未获其官方授权或认可。  
> 使用本工具修改设备固件存在风险（包括但不限于设备变砖、功能异常、数据丢失、保修失效），请自行评估风险，作者不对任何损失负责。  
> 使用即代表您同意 [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) 协议及上述条款。

---

### 在线使用

👉 **https://pen.skdkzzx.dpdns.org** — 直接打开即可使用（WebUSB 需要 HTTPS 环境）。

## 简介

原版 [PenMods](https://github.com/PenUniverse/PenMods) 安装需要操作命令行、配置 ADB 环境，对不熟悉命令行的用户门槛很高。本项目就是为了解决这个问题——**手机 OTG 连接词典笔，打开浏览器就能一键安装、更新、卸载 PenMods，还能直接管理设备文件。全程无需电脑，无需安装 adb 或任何驱动。**

本项目基于 [PenUniverse/PenMods](https://github.com/PenUniverse/PenMods) 修改。

## 功能一览

| 模块 | 功能 | 说明 |
|------|------|------|
| **PenMods 安装** | 一键安装 | 推送所有文件 → 安装证书 → 初始化 → 注入 Mod → 重启 |
| | 快速更新 | 单独推送 `libPenMods.so`，不执行完整安装 |
| | 卸载 | 恢复原版应用，删除 Mod 文件，不清除个人数据 |
| | 自定义 ZIP | 上传自己的 `PenMods.zip`，自动替换内置文件 |
| **文件管理器** | 浏览目录 | 显示文件和目录，区分颜色图标 |
| | 上传/下载 | 从本地上传或下载文件到设备 |
| | 复制/剪切/粘贴 | 跨目录复制和移动文件 |
| | 重命名/新建/删除 | 完整文件操作 |
| | 压缩/解压 | 目录打包为 zip，zip 文件解压（自动处理 GBK 编码） |
| | 多选模式 | 勾选多项后批量操作 |
| | 拖拽上传 | 拖放文件即可上传 |
| | 路径导航 | 路径栏可点击导航或手动输入 |
| **SSH 终端** | 交互式 Shell | 浏览器内建 xterm 终端，USB 或 SSH 均可使用 |
| **插件系统** | ZIP/文件夹安装 | 解析 `metadata.json`，自动推送安装 |
| **SSH 引导** | USB 一键开启 SSH | 自动探测并启动设备 OpenSSH，设置开机自启 |
| **扩展包安装** | tar.gz/zip 安装 | 上传压缩包 + 安装脚本，设备端解压执行 |
| **通用** | PWA 离线 | 首次加载后可离线使用 |
| | USB 断开检测 | 拔线自动识别，无需手动刷新 |
| | 连接模式切换 | USB(ADB) 或 SSH(SFTP) 双通道 |

## 支持设备

| 设备 | 型号 | 支持状态 |
|------|------|---------|
| **有道词典笔 2 代** | YDP02x | ✅ 完全支持 |
| **有道词典笔 3 代** | YDPG3 | ✅ 完全支持 |

> **Android 手机用户注意**：手机需使用 **OTG 转接头** 连接词典笔的数据线。大部分 Android 手机支持 OTG，少部分机型（如部分华为、小米旧款）需在设置中开启 OTG 功能。
>
> **电脑用户**：直接使用数据线连接即可，无需额外驱动。

## 快速开始

### 前提条件

| 项目 | 要求 |
|------|------|
| **设备** | 有道词典笔二代（YDP02x）/ 三代（YDPG3） |
| **ADB 开启** | 设置 → 关于 → 法律监管 → 快速点击 10 次 |
| **连接方式** | Android 手机：OTG 转接头 + 数据线；电脑：直接连接 |
| **浏览器** | Chrome / Edge（需支持 [WebUSB](https://developer.mozilla.org/en-US/docs/Web/API/USB)） |

### 本地启动

```bash
git clone https://github.com/skdkzzx/PenModsInstaller.git
cd PenModsInstaller
npm install
npm run dev
```

浏览器打开 `http://localhost:5173` 即可使用。

手机端测试：启动后终端会显示 `Network` 地址（如 `http://192.168.x.x:5173/`），手机 Chrome 打开即可。

### 构建部署

```bash
npm run build    # 产物在 dist/ 目录，部署到 Web 服务器
npm run test     # 运行测试
npm run lint     # 代码检查
```

## 使用指南

### 安装 PenMods

1. **词典笔上开启 ADB**：设置 → 关于 → 法律监管 → 点击 10 次
2. 使用 OTG 线连接手机/电脑与词典笔
3. 打开 PenMods Installer 网页
4. 点击右上角 **"连接设备"**
5. 浏览器弹出 USB 选择窗口，选择你的词典笔
6. 连接成功后，点击 **「开始安装」**
7. 等待进度条走完（约 1-3 分钟）
8. 设备自动重启，安装完成

> 如果重启后屏幕不可用，长按电源键关机再开机即可。

### 快速更新

当 PenMods 作者发布新版本时，只需更新 `libPenMods.so`：连接设备后，在安装包区域下方的快速更新栏选择新的 `.so` 文件，自动推送到设备，重启即可生效。

### 卸载 PenMods

点击 **「卸载」** 按钮（红色），确认后自动完成：恢复原版应用 → 删除 `/userdata/PenMods` 目录 → 重启设备。个人数据不会丢失。

### 连接模式

| 模式 | 传输协议 | 适用场景 |
|------|---------|---------|
| **USB** | ADB (WebUSB) | 首次安装 PenMods、文件管理、终端 |
| **SSH** | SFTP | 文件管理、终端（设备需先开启 SSH） |

开启 SSH：通过 USB 连接后，在更多页面点击「开启 SSH」，一键启动设备 OpenSSH 并设置开机自启。

## 自定义安装包

上传自己的 PenMods ZIP 替换内置文件，ZIP 中有的文件用 ZIP 的，没有的自动使用内置版本：

```
PenMods.zip
├── CA.zip
├── libPenMods.so
├── patch.sh
├── misc/        (init.sh, patchelf, libm.so, libcrypt.so, libstdc++.so)
└── Rime/        (字典 & 输入法配置)
```

## 技术栈

| 技术 | 用途 |
|------|------|
| **React 19** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Vite 8** | 构建工具 |
| **Tailwind CSS 4** | 样式 |
| **@yume-chan/adb** | 浏览器端 ADB 协议实现 |
| **WebUSB API** | 浏览器 USB 通信 |
| **JSZip** | 客户端 ZIP 解析 |
| **xterm.js** | 终端模拟器 |
| **ssh2** | SSH/SFTP 代理 |
| **PWA** | 离线可用 |

### 原理

通过 WebUSB API 直接与词典笔 USB 接口通信，使用 `@yume-chan/adb` 库在浏览器中实现完整 ADB 协议：

- **设备认证**：RSA 密钥交换（标准 ADB 认证流程）
- **Shell 执行**：通过 `shell:exec` 服务在设备上运行命令
- **文件传输**：通过 `sync:` 协议推送和拉取文件
- **额外认证**：词典笔需通过 `adb shell auth` + 密码 `CherryYoudao` 额外认证，安装器连接后自动处理

## 项目结构

```
PenModsInstaller/
├── public/
│   ├── files/              # 内置 PenMods 安装文件
│   │   ├── CA.zip          # SSL 根证书包
│   │   ├── libPenMods.so   # Mod 核心库
│   │   ├── patch.sh        # 注入脚本
│   │   ├── misc/           # 初始化工具和库
│   │   └── Rime/           # Rime 输入法配置
│   ├── manifest.json       # PWA 配置
│   └── sw.js               # Service Worker
├── src/
│   ├── lib/
│   │   ├── adb.ts              # ADB 核心封装
│   │   ├── credential-store.ts # RSA 密钥持久化
│   │   ├── installer.ts        # 安装/卸载流程
│   │   ├── device.ts           # 设备连接抽象 (ADB/SSH)
│   │   ├── ssh.ts              # SSH/SFTP 客户端
│   │   ├── files.ts            # 文件清单管理
│   │   ├── plugin-install.ts   # 插件安装逻辑
│   │   ├── app-store.ts        # 应用安装包管理
│   │   ├── steps.ts            # 安装步骤定义
│   │   └── youdaoxt.ts         # youdaoEXT 安装逻辑
│   ├── pages/
│   │   ├── FileManager/        # 文件管理器
│   │   ├── PluginInstall/      # 插件安装
│   │   ├── AppStore/           # 安装包商店
│   │   ├── Shell/              # SSH 终端
│   │   ├── EnableSSH/          # SSH 引导
│   │   ├── SSHTerminal/        # 独立 SSH 连接终端
│   │   ├── YoudaoExt/          # youdaoEXT 安装
│   │   ├── Welcome.tsx         # 欢迎页
│   │   ├── EnableAdb.tsx       # ADB 开启引导
│   │   ├── ConnectDevice.tsx   # 设备连接
│   │   ├── DetectDevice.tsx    # 设备检测
│   │   ├── ChooseComponents.tsx# 组件选择
│   │   ├── Installing.tsx      # 安装进度
│   │   ├── Complete.tsx        # 安装完成
│   │   └── Troubleshoot.tsx    # 故障排查
│   ├── components/
│   │   ├── DisclaimerModal.tsx # 免责声明弹窗
│   │   ├── DeviceStatus.tsx    # 设备状态
│   │   ├── ErrorCard.tsx       # 错误卡片
│   │   ├── LogViewer.tsx       # 日志查看器
│   │   ├── ProgressBar.tsx     # 进度条
│   │   ├── StepGuide.tsx       # 步骤引导
│   │   └── icons/              # SVG 图标
│   ├── hooks/
│   │   └── useInstall.ts       # 安装流程 Hook
│   ├── App.tsx                 # 主应用
│   ├── main.tsx                # 入口
│   └── index.css               # 全局样式
├── proxy.mjs                   # SSH 代理服务器
├── vite.config.ts              # Vite 配置
└── package.json
```

## 常见问题

### WebUSB 不支持
- 使用 Chrome 或 Edge 浏览器
- 确保页面通过 HTTPS 或 `localhost` 访问
- 关闭无痕/隐私模式
- 检查 `edge://flags/#enable-webusb` 是否启用

### 设备连接失败
- 先在终端执行 `adb kill-server` 释放 USB 接口
- 重新插拔 OTG 线
- 确认词典笔已开启 ADB（法律监管点 10 次）
- 换一根数据线（非充电线）

### 安装后屏幕不可用
长按电源键关机，再重新开机即可。这是已知问题，第二次启动恢复正常。

### 如何恢复原版
- 方法一：使用本工具的 **「卸载」** 功能
- 方法二：词典笔设置 → 关于 → 重置 → 卸载 PenMods

## 联系作者

| 方式 | 信息 |
|------|------|
| QQ | 1481705136 |
| 邮箱 | 1583400854@qq.com / skdkzzx@gmail.com |
| 赞助 | [❤️ 爱发电](https://ifdian.net/order/create?user_id=c2e3740cb7a811ef93d85254001e7c00) |

## 致谢

- [PenUniverse/PenMods](https://github.com/PenUniverse/PenMods) — 原项目
- [@yume-chan/adb](https://github.com/yume-chan/adb) — 浏览器端 ADB 实现
- 所有贡献者和赞助者

## 协议

[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)

Copyright © 2026 [skdkzzx](https://github.com/skdkzzx)
