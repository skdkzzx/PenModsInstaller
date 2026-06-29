import { describe, it, expect } from 'vitest';
import { getInstallFiles } from '../files';

describe('getInstallFiles', () => {
  it('returns the default 8 install files', () => {
    const files = getInstallFiles();
    expect(files).toHaveLength(8);
  });

  it('all files have required fields', () => {
    const files = getInstallFiles();
    for (const f of files) {
      expect(f.name).toBeTruthy();
      expect(f.localPath).toBeTruthy();
      expect(f.remotePath).toMatch(/^\//);
    }
  });

  it('includes CA.zip with correct remote path', () => {
    const files = getInstallFiles();
    const ca = files.find(f => f.name === 'CA.zip');
    expect(ca).toBeDefined();
    expect(ca!.remotePath).toBe('/userdisk/CA.zip');
    expect(ca!.localPath).toMatch(/CA\.zip$/);
  });

  it('includes libPenMods.so', () => {
    const files = getInstallFiles();
    const so = files.find(f => f.name === 'libPenMods.so');
    expect(so).toBeDefined();
    expect(so!.remotePath).toBe('/userdata/PenMods/libPenMods.so');
  });

  it('marks shell scripts and patchelf as executable', () => {
    const files = getInstallFiles();
    const executables = files.filter(f => f.executable);
    const names = executables.map(f => f.name);
    expect(names).toContain('patch.sh');
    expect(names).toContain('init.sh');
    expect(names).toContain('patchelf');
  });

  it('all files go to /userdisk/ or /userdata/PenMods/', () => {
    const files = getInstallFiles();
    for (const f of files) {
      const ok = f.remotePath.startsWith('/userdisk/') ||
                 f.remotePath.startsWith('/userdata/PenMods/');
      expect(ok).toBe(true);
    }
  });

  it('misc files go to /userdata/PenMods/misc/', () => {
    const files = getInstallFiles();
    const miscNames = ['libm.so', 'libcrypt.so', 'libstdc++.so'];
    for (const f of files) {
      if (miscNames.includes(f.name)) {
        expect(f.remotePath).toMatch(/^\/userdata\/PenMods\/misc\//);
      }
    }
  });
});
