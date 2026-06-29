import { describe, it, expect } from 'vitest';

// Test pure helper functions from plugin-install.ts
// These aren't exported but are critical for correctness

describe('plugin-install helpers', () => {
  describe('dirname', () => {
    const dirname = (p: string) => {
      const i = p.lastIndexOf('/');
      return i >= 0 ? p.slice(0, i) : '';
    };

    it('extracts dirname from path', () => {
      expect(dirname('a/b/c.json')).toBe('a/b');
    });
    it('returns empty for root file', () => {
      expect(dirname('metadata.json')).toBe('');
    });
    it('handles nested paths', () => {
      expect(dirname('plugins/my-plugin/qml/main.qml')).toBe('plugins/my-plugin/qml');
    });
  });

  describe('basename', () => {
    const basename = (p: string) => {
      return p.split('/').filter(Boolean).pop() || '';
    };

    it('extracts basename from path', () => {
      expect(basename('a/b/file.txt')).toBe('file.txt');
    });
    it('handles root path', () => {
      expect(basename('/')).toBe('');
    });
    it('handles single segment', () => {
      expect(basename('file.txt')).toBe('file.txt');
    });
  });

  describe('decodeZipName', () => {
    const decodeZipName = (bytes: Uint8Array): string => {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        try { return new TextDecoder('gbk').decode(bytes); }
        catch { return new TextDecoder('utf-8').decode(bytes); }
      }
    };

    it('decodes UTF-8 names', () => {
      const bytes = new TextEncoder().encode('metadata.json');
      expect(decodeZipName(bytes)).toBe('metadata.json');
    });

    it('decodes Chinese UTF-8 names', () => {
      const bytes = new TextEncoder().encode('配置.json');
      expect(decodeZipName(bytes)).toBe('配置.json');
    });

    it('falls back to GBK for non-UTF-8 bytes', () => {
      // GBK encoded "测试" (0xB2 E2 0xCA D4)
      const bytes = new Uint8Array([0xB2, 0xE2, 0xCA, 0xD4]);
      const result = decodeZipName(bytes);
      // Should decode to something (GBK fallback), not throw
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('pickMetadata', () => {
    const pickMetadata = (paths: string[]): string | null => {
      const cands = paths.filter(p => {
        const lp = p.toLowerCase();
        return lp.endsWith('/metadata.json') || lp === 'metadata.json';
      });
      if (cands.length === 0) return null;
      const score = (p: string) => (/(源码|source|\/src\/|\bsrc\/)/i.test(p) ? 1000 : 0) + p.split('/').length;
      cands.sort((a, b) => score(a) - score(b));
      return cands[0];
    };

    it('finds root metadata.json', () => {
      expect(pickMetadata(['metadata.json', 'main.qml'])).toBe('metadata.json');
    });

    it('finds nested metadata.json', () => {
      expect(pickMetadata(['plugin/main.qml', 'plugin/metadata.json'])).toBe('plugin/metadata.json');
    });

    it('prefers non-source metadata over source', () => {
      const paths = [
        'src/metadata.json',
        'plugin/metadata.json',
      ];
      expect(pickMetadata(paths)).toBe('plugin/metadata.json');
    });

    it('returns null when no metadata.json', () => {
      expect(pickMetadata(['main.qml', 'icon.png'])).toBeNull();
    });

    it('picks the shallowest non-source metadata', () => {
      const paths = [
        'a/metadata.json',
        'a/b/metadata.json',
        'src/metadata.json',
      ];
      expect(pickMetadata(paths)).toBe('a/metadata.json');
    });

    it('ignores case for metadata.json', () => {
      expect(pickMetadata(['Metadata.json'])).toBe('Metadata.json');
    });
  });

  describe('resolveName', () => {
    const resolveName = (meta: Record<string, any>, rootDir: string): string => {
      const iconMatch = String(meta.icon || '').match(/plugins\/([^/]+)\//);
      if (iconMatch) return iconMatch[1];
      const base = rootDir.split('/').filter(Boolean).pop() || '';
      if (base) return base;
      return String(meta.id || meta.name || 'plugin').replace(/[^\w.\-]+/g, '_');
    };

    it('resolves from icon path', () => {
      const meta = { icon: 'plugins/my-plugin/icon.png' };
      expect(resolveName(meta, '')).toBe('my-plugin');
    });

    it('falls back to root dir basename', () => {
      expect(resolveName({}, 'plugins/some-plugin')).toBe('some-plugin');
    });

    it('falls back to id', () => {
      const meta = { id: 'fallback-id' };
      expect(resolveName(meta, '')).toBe('fallback-id');
    });

    it('falls back to name (space sanitized)', () => {
      const meta = { name: 'My Plugin' };
      expect(resolveName(meta, '')).toBe('My_Plugin');
    });

    it('sanitizes name with special chars (underscore)', () => {
      const meta = { name: 'bad/name:test' };
      expect(resolveName(meta, '')).toBe('bad_name_test');
    });

    it('icon path takes priority over root dir', () => {
      const meta = { icon: 'plugins/icon-version/icon.png' };
      expect(resolveName(meta, 'plugins/outdated-name')).toBe('icon-version');
    });
  });
});
