/**
 * 安装步骤状态管理
 * 使用 const object 代替 enum 以兼容 erasableSyntaxOnly
 */

export const InstallStep = {
  Welcome: 'welcome',
  EnableAdb: 'enable-adb',
  Connect: 'connect',
  DetectDevice: 'detect',
  ChooseComponents: 'choose',
  Installing: 'installing',
  Complete: 'complete',
  Troubleshoot: 'troubleshoot',
} as const;

export type InstallStep = (typeof InstallStep)[keyof typeof InstallStep];

export interface StepInfo {
  id: InstallStep;
  title: string;
  description: string;
  order: number;
}

export const STEP_INFO: Record<InstallStep, StepInfo> = {
  [InstallStep.Welcome]: {
    id: InstallStep.Welcome,
    title: '欢迎使用',
    description: 'PenMods 一键安装工具',
    order: 0,
  },
  [InstallStep.EnableAdb]: {
    id: InstallStep.EnableAdb,
    title: '开启 ADB',
    description: '在词典笔上开启调试模式',
    order: 1,
  },
  [InstallStep.Connect]: {
    id: InstallStep.Connect,
    title: '连接设备',
    description: '用 OTG 线连接手机和词典笔',
    order: 2,
  },
  [InstallStep.DetectDevice]: {
    id: InstallStep.DetectDevice,
    title: '检测设备',
    description: '自动检测并认证词典笔',
    order: 3,
  },
  [InstallStep.ChooseComponents]: {
    id: InstallStep.ChooseComponents,
    title: '选择组件',
    description: '选择要安装的功能',
    order: 4,
  },
  [InstallStep.Installing]: {
    id: InstallStep.Installing,
    title: '安装中',
    description: '正在安装 PenMods',
    order: 5,
  },
  [InstallStep.Complete]: {
    id: InstallStep.Complete,
    title: '安装完成',
    description: '所有步骤已完成',
    order: 6,
  },
  [InstallStep.Troubleshoot]: {
    id: InstallStep.Troubleshoot,
    title: '故障排除',
    description: '常见问题解决方法',
    order: -1,
  },
};

export const STEP_ORDER = Object.values(STEP_INFO)
  .filter(s => s.order >= 0)
  .sort((a, b) => a.order - b.order);
