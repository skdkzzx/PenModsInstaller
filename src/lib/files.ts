export interface InstallFile {
  name: string;
  localPath?: string;
  remotePath: string;
  data?: Uint8Array;
  executable?: boolean;
}

export interface ZipParseResult {
  files: InstallFile[];
  warnings: string[];
  fileCount: number;
}

/** 必备文件清单（用于 ZIP 验证） */
const REQUIRED_FILES = [
  'CA.zip',
  'libPenMods.so',
  'patch.sh',
  'misc/init.sh',
  'misc/patchelf',
  'misc/libm.so',
  'misc/libcrypt.so',
  'misc/libstdc++.so',
];

/** 默认安装文件列表 */
export function getInstallFiles(): InstallFile[] {
  return [
    { name: 'CA.zip', localPath: './files/CA.zip', remotePath: '/userdisk/CA.zip' },
    { name: 'libPenMods.so', localPath: './files/libPenMods.so', remotePath: '/userdata/PenMods/libPenMods.so' },
    { name: 'patch.sh', localPath: './files/patch.sh', remotePath: '/userdata/PenMods/patch.sh', executable: true },
    { name: 'init.sh', localPath: './files/misc/init.sh', remotePath: '/userdata/PenMods/misc/init.sh', executable: true },
    { name: 'patchelf', localPath: './files/misc/patchelf', remotePath: '/userdata/PenMods/misc/patchelf', executable: true },
    { name: 'libm.so', localPath: './files/misc/libm.so', remotePath: '/userdata/PenMods/misc/libm.so' },
    { name: 'libcrypt.so', localPath: './files/misc/libcrypt.so', remotePath: '/userdata/PenMods/misc/libcrypt.so' },
    { name: 'libstdc++.so', localPath: './files/misc/libstdc++.so', remotePath: '/userdata/PenMods/misc/libstdc++.so' },
  ];
}

/** 从用户上传的 ZIP 中提取安装文件 */
export async function getInstallFilesFromZip(zip: any): Promise<ZipParseResult> {
  const warnings: string[] = [];
  const files: InstallFile[] = [];
  const allEntries = Object.keys(zip.files).filter((k: string) => !zip.files[k].dir);

  // 检测 ZIP 结构
  const hasPenModsPrefix = allEntries.some((e: string) => /^PenMods\d\.\d\.\d\//.test(e));
  const stripPrefix = (path: string) => {
    let p = path;
    if (hasPenModsPrefix) p = p.replace(/^PenMods\d\.\d\.\d\//, '');
    return p;
  };

  // 检查必备文件
  for (const req of REQUIRED_FILES) {
    const name = req.split('/').pop()!;
    const found = allEntries.find((e: string) => {
      const stripped = stripPrefix(e);
      return stripped === req || stripped === name ||
             stripped === 'PenMods/' + req || stripped === 'PenMods/' + name;
    });
    if (!found) {
      warnings.push(`缺少 ${req}`);
    }
  }

  // 提取所有文件
  for (const entryPath of allEntries) {
    const entry = zip.files[entryPath];
    if (entry.dir) continue;

    const content = await entry.async('uint8array');
    const stripped = stripPrefix(entryPath);
    const name = stripped.split('/').pop() || stripped;

    let remotePath = '';
    if (stripped === 'CA.zip') {
      remotePath = '/userdisk/CA.zip';
    } else if (stripped.startsWith('Rime/') || stripped.startsWith('rime/')) {
      remotePath = '/userdisk/Music/' + stripped;
    } else if (stripped.startsWith('misc/')) {
      remotePath = '/userdata/PenMods/' + stripped;
    } else if (stripped.startsWith('PenMods/') || stripped.startsWith('penmods/')) {
      remotePath = '/userdata/' + stripped;
    } else if (['libPenMods.so', 'patch.sh', 'init.sh', 'patchelf', 'libm.so', 'libcrypt.so', 'libstdc++.so'].includes(name)) {
      remotePath = '/userdata/PenMods/' + stripped;
    } else {
      remotePath = '/userdata/PenMods/' + stripped;
    }

    const isExec = name.endsWith('.sh') || name === 'patchelf';
    files.push({ name, remotePath, data: content, executable: isExec });
  }

  return {
    files,
    warnings: [...new Set(warnings)], // 去重
    fileCount: allEntries.length,
  };
}
