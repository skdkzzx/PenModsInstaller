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
> 本工具是**第三方独立开源项目**，与网易有道公司（NetEase Youdao）**无任何隶属关系**，未获其官方授权或认可。  
> 使用本工具修改设备固件存在风险（包括但不限于设备变砖、功能异常、数据丢失、保修失效），请自行评估风险，作者不对任何损失负责。  
> 使用即代表您同意 [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) 协议及上述条款。  
> 详情见首次使用时的完整弹窗声明。

---

### 在线使用

👉 **https://pen.skdkzzx.dpdns.org** — 直接打开即可使用。

> WebUSB 需要 HTTPS 环境，在线部署已自带 HTTPS。

## 简介

**做这个工具的初衷**：原版 [PenMods](https://github.com/PenUniverse/PenMods) 安装需要操作命令行、配置 ADB 环境，对没有电脑或不熟悉命令行的用户来说门槛很高。这个项目就是为了解决这个问题——**手机 OTG 连接词典笔，打开浏览器就能一键安装、更新、卸载 PenMods，还能直接管理设备文件。全程无需电脑，无需安装 adb 或任何驱动。**

本项目基于 [PenUniverse/PenMods](https://github.com/PenUniverse/PenMods) 修改，感谢原作者的辛勤付出。


</details>

## 功能一览

| 模块 | 功能 | 说明 |
|------|------|------|
| **PenMods 安装** | 一键安装 | 推送所有文件 → 安装证书 → 初始化 → 注入 Mod → 重启 |
| | 快速更新 | 单独推送 `libPenMods.so`，不执行完整安装 |
| | 卸载 | 恢复原版应用，删除 Mod 文件，不清除个人数据 |
| | 自定义 ZIP | 上传自己的 `PenMods.zip`，自动替换内置文件 |
| **文件管理器** | 浏览目录 | 显示文件和目录，区分颜色图标 |
| | 可编辑路径 | 点击路径栏手动输入，按 Enter 跳转 |
| | 上传/下载 | 从本地设备上传或下载文件 |
| | 复制/剪切/粘贴 | 跨目录复制和移动文件 |
| | 重命名/新建/删除 | 完整文件操作 |
| | 压缩/解压 | 目录打包为 zip，zip 文件解压（自动处理 GBK 编码） |
| | 多选模式 | 勾选多项后批量操作 |
| | 拖拽上传 | 拖放文件即可上传 |
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
| **其他 Android 手机/平板** | — | ⚠️ 仅支持 USB 连接，需安装 Termux 等 ADB 环境 |

> **Android 手机用户注意**：手机需使用 **OTG 转接头** 连接词典笔的数据线。大部分 Android 手机支持 OTG，少部分机型（如部分华为、小米旧款）需在设置中开启 OTG 功能。
>
> **电脑用户**：直接使用数据线连接即可，无需额外驱动。

## 快速开始

### 前提条件

| 项目 | 要求 |
|------|------|
| **设备** | 有道词典笔二代（YDP02x）/ 三代（YDPG3） |
| **ADB 开启** | 设置 → 关于 → 法律监管 → 快速点击 10 次 |
| **连接方式** | **Android 手机**：OTG 转接头 + 数据线连接词典笔；**电脑**：直接数据线连接 |
| **浏览器** | Chrome / Edge（需支持 [WebUSB](https://developer.mozilla.org/en-US/docs/Web/API/USB)） |

### 本地启动

```bash
git clone https://github.com/skdkzzx/PenModsInstaller.git
cd PenModsInstaller
npm install
npm run dev
“```”

浏览器打开 `http://localhost:5173` 即可使用。

### 手机端测试

启动后在终端会显示两个地址：
```
Local:   http://localhost:5173/         # 本机用
Network: http://192.168.x.x:5173/       # 手机访问这个
```

手机 Chrome 打开 Network 地址，插上 OTG 线连接词典笔即可操作。

### 构建部署

```bash
npm run build
# 产物在 dist/ 目录，部署到 Web 服务器即可
```

## 使用指南

### 安装 PenMods

1. **词典笔上开启 ADB**：设置 → 关于 → 法律监管 → 点击 10 次
2. 用 OTG 线连接手机/电脑和词典笔
3. 打开 PenMods Installer 网页
4. 点击右上角 **「连接设备」**
5. 浏览器弹出 USB 选择窗口，选择你的词典笔
6. 连接成功后，点击 **「开始安装」**
7. 等待进度条走完（约 1-3 分钟）
8. 设备自动重启，安装完成

> 如果重启后屏幕不可用，长按电源键关机再开机即可。

### 快速更新

当 PenMods 作者发布新版本时，只需更新 `libPenMods.so`：

1. 连接设备
2. 在 **「安装包」** 区域下方的快速更新栏，选择新的 `.so` 文件
3. 自动推送到设备
4. 重启词典笔即可生效

### 卸载 PenMods

1. 连接设备
2. 点击 **「卸载」** 按钮（红色）
3. 确认后自动完成：
   - 恢复原版 `YoudaoDictPen` 应用
   - 删除 `/userdata/PenMods` 目录
   - 重启设备

> 卸载仅移除 Mod，词典笔内的单词本、设置等个人数据不会丢失。

### 连接模式

本工具支持两种连接方式：

| 模式 | 传输协议 | 适用场景 |
|------|---------|---------|
| **USB** | ADB (WebUSB) | 首次安装 PenMods、文件管理、终端 |
| **SSH** | SFTP | 文件管理、终端（设备需先开启 SSH） |

开启 SSH：通过 USB 连接后，切换到「更多 → 开启 SSH」标签页，一键启动设备 OpenSSH 并设置开机自启。

## 自定义安装包

上传自己的 PenMods ZIP 替换内置文件：

```
PenMods.zip
├── CA.zip
├── libPenMods.so
├── patch.sh
├── misc/
│   ├── init.sh
│   ├── patchelf
│   ├── libm.so
│   ├── libcrypt.so
│   └── libstdc++.so
└── Rime/
    ├── *.dict.yaml
    ├── *.schema.yaml
    ├── cn_dicts/
    ├── en_dicts/
    └── lua/
```

ZIP 中有的文件用 ZIP 的，没有的自动使用内置版本。

## 文件管理器

提供 Windows 资源管理器风格的操作逻辑：

- 文件列表/网格两种视图
- 路径栏可点击导航或手动输入
- 拖拽上传文件
- 右键上下文菜单
- 键盘快捷键（方向键导航，Ctrl+C/V 复制粘贴，Delete 删除等）
- 侧栏快捷导航 / 书签 / 最近目录

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

PenMods Installer 通过 WebUSB API 直接与词典笔的 USB 接口通信，使用 `@yume-chan/adb` 库在浏览器中实现了完整的 ADB（Android Debug Bridge）协议：

- **设备认证**：RSA 密钥交换（标准 ADB 认证流程）
- **Shell 执行**：通过 `shell:exec` 服务在设备上运行命令
- **文件传输**：通过 `sync:` 协议推送和拉取文件
- **服务管理**：启动、停止设备端服务

词典笔需要先通过 `adb shell auth` + 密码 `CherryYoudao` 进行额外认证，安装器会在连接后自动执行此步骤。

## 项目结构

```
PenModsInstaller/
├── public/
│   ├── files/              # 内置的 PenMods 安装文件
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
│   │   └── youdaoxt.ts         # youdaoEXT 安装逻辑
│   ├── components/
│   │   ├── DisclaimerModal.tsx # 免责声明弹窗
│   │   └── icons/              # SVG 图标
│   ├── pages/
│   │   ├── FileManager/        # 文件管理器（含 SSH/SFTP 版）
│   │   ├── PluginInstall/      # 插件安装
│   │   ├── AppStore/           # 安装包商店
│   │   ├── Shell/              # SSH 终端
│   │   ├── EnableSSH/          # SSH 一键开启引导
│   │   └── SSHTerminal/        # 独立 SSH 连接终端
│   ├── App.tsx                 # 主应用
│   └── main.tsx                # 入口
├── proxy.mjs                   # 独立 SSH 代理服务器
├── vite.config.ts              # Vite 配置（含内置 SSH 代理）
├── vitest.config.ts            # 测试配置
└── package.json
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（热重载）
npm run dev

# 运行测试
npm test

# 运行测试（持续监听）
npm run test:watch

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint
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

<div align="lift">

| 方式 | 信息 |
|------|------|
| QQ | 1481705136 |
| 邮箱 | [1583400854@qq.com](mailto:1583400854@qq.com) |
| 邮箱 | [skdkzzx@gmail.com](mailto:skdkzzx@gmail.com) |
| 赞助 | [❤️ 爱发电](https://ifdian.net/order/create?user_id=c2e3740cb7a811ef93d85254001e7c00) |

</div>

## 致谢

- [PenUniverse/PenMods](https://github.com/PenUniverse/PenMods) — 原项目，本工具的基础
- [@yume-chan/adb](https://github.com/yume-chan/adb) — 浏览器端 ADB 实现
- 所有贡献者和赞助者

## 协议

本项目基于 [PenUniverse/PenMods](https://github.com/PenUniverse/PenMods) 修改，遵循 **GNU General Public License v3.0**。

Copyright © 2026 [skdkzzx](https://github.com/skdkzzx)
