import { describe, it, expect } from 'vitest';
import {
  formatSize, formatDate, joinPath, parentPath,
  buildPathSegments, getFileType, sortEntries, formatPermissions,
} from '../utils';
import type { FileEntry } from '../types';

describe('formatSize', () => {
  it('returns "-" for 0 bytes', () => {
    expect(formatSize(0)).toBe('-');
  });
  it('formats bytes without decimal', () => {
    expect(formatSize(512)).toBe('512 B');
  });
  it('formats KB with 1 decimal', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
  });
  it('formats MB with 2 decimals', () => {
    expect(formatSize(1048576)).toBe('1.00 MB');
    expect(formatSize(1572864)).toBe('1.50 MB');
  });
  it('formats GB with 2 decimals', () => {
    expect(formatSize(1073741824)).toBe('1.00 GB');
  });
});

describe('formatDate', () => {
  it('returns "-" for falsy mtime', () => {
    expect(formatDate(0)).toBe('-');
  });
  it('formats today', () => {
    const now = Date.now() / 1000;
    const result = formatDate(now);
    expect(result).toMatch(/^今天 \d{2}:\d{2}$/);
  });
  it('formats yesterday', () => {
    const yesterday = (Date.now() / 1000) - 86400;
    const result = formatDate(yesterday);
    expect(result).toMatch(/^昨天 \d{2}:\d{2}$/);
  });
  it('formats this year as MM/DD HH:mm', () => {
    const d = new Date();
    d.setMonth(0, 15); // Jan 15
    d.setHours(10, 30);
    const ts = d.getTime() / 1000;
    const result = formatDate(ts);
    if (d.getFullYear() === new Date().getFullYear()) {
      expect(result).toMatch(/^01\/15 10:30$/);
    }
  });
  it('formats past years as YYYY/MM/DD', () => {
    const ts = new Date(2023, 5, 15).getTime() / 1000;
    const result = formatDate(ts);
    // This year check - may be "2023/06/15" format for past years
    expect(result).toMatch(/^2023\//);
  });
});

describe('joinPath', () => {
  it('joins root with child', () => {
    expect(joinPath('/', 'foo')).toBe('/foo');
  });
  it('joins path with child', () => {
    expect(joinPath('/foo', 'bar')).toBe('/foo/bar');
  });
  it('handles empty parent', () => {
    expect(joinPath('', 'foo')).toBe('/foo');
  });
});

describe('parentPath', () => {
  it('returns "/" for root', () => {
    expect(parentPath('/')).toBe('/');
  });
  it('returns parent of /foo', () => {
    expect(parentPath('/foo')).toBe('/');
  });
  it('returns parent of /foo/bar', () => {
    expect(parentPath('/foo/bar')).toBe('/foo');
  });
  it('handles no slash', () => {
    expect(parentPath('foo')).toBe('/');
  });
});

describe('buildPathSegments', () => {
  it('returns root segment for /', () => {
    expect(buildPathSegments('/')).toEqual([{ label: '/', path: '/' }]);
  });
  it('builds segments for nested path', () => {
    expect(buildPathSegments('/foo/bar/baz')).toEqual([
      { label: '/', path: '/' },
      { label: 'foo', path: '/foo' },
      { label: 'bar', path: '/foo/bar' },
      { label: 'baz', path: '/foo/bar/baz' },
    ]);
  });
});

describe('getFileType', () => {
  it('returns "folder" for dirs', () => {
    expect(getFileType('anything', true)).toBe('folder');
  });
  it('detects image types', () => {
    expect(getFileType('photo.png', false)).toBe('image');
    expect(getFileType('photo.jpg', false)).toBe('image');
    expect(getFileType('photo.webp', false)).toBe('image');
  });
  it('detects archive types', () => {
    expect(getFileType('archive.zip', false)).toBe('archive');
    expect(getFileType('archive.rar', false)).toBe('archive');
    expect(getFileType('test.tar.gz', false)).toBe('archive'); // .gz matches
  });
  it('detects text types', () => {
    expect(getFileType('readme.md', false)).toBe('text');
    expect(getFileType('log.txt', false)).toBe('text');
    expect(getFileType('config.ini', false)).toBe('text');
  });
  it('detects code types', () => {
    expect(getFileType('app.ts', false)).toBe('code');
    expect(getFileType('app.js', false)).toBe('code');
    expect(getFileType('style.css', false)).toBe('code');
    expect(getFileType('data.json', false)).toBe('code');
  });
  it('detects audio types', () => {
    expect(getFileType('song.mp3', false)).toBe('audio');
    expect(getFileType('song.flac', false)).toBe('audio');
  });
  it('detects video types', () => {
    expect(getFileType('movie.mp4', false)).toBe('video');
    expect(getFileType('movie.mkv', false)).toBe('video');
  });
  it('detects binary', () => {
    expect(getFileType('lib.so', false)).toBe('binary');
    expect(getFileType('binary.dll', false)).toBe('binary');
  });
  it('detects script', () => {
    expect(getFileType('run.sh', false)).toBe('script');
  });
  it('falls back to "binary" for no extension', () => {
    expect(getFileType('Makefile', false)).toBe('binary');
  });
  it('returns "file" for unknown extension', () => {
    expect(getFileType('weird.xyz', false)).toBe('file');
  });
});

describe('sortEntries', () => {
  const entries: FileEntry[] = [
    { name: 'bravo.txt', isDir: false, isSymlink: false, sizeBytes: 200, mtime: 100 },
    { name: 'alpha', isDir: true, isSymlink: false, sizeBytes: 0, mtime: 300 },
    { name: 'charlie.txt', isDir: false, isSymlink: false, sizeBytes: 100, mtime: 200 },
    { name: 'delta', isDir: true, isSymlink: false, sizeBytes: 0, mtime: 50 },
  ];

  it('sorts dirs first, then by name asc', () => {
    const sorted = sortEntries(entries, 'name', true);
    expect(sorted[0].name).toBe('alpha');
    expect(sorted[1].name).toBe('delta');
    expect(sorted[2].name).toBe('bravo.txt');
    expect(sorted[3].name).toBe('charlie.txt');
  });

  it('sorts dirs first, then by name desc', () => {
    const sorted = sortEntries(entries, 'name', false);
    expect(sorted[0].name).toBe('delta');
    expect(sorted[1].name).toBe('alpha');
    expect(sorted[2].name).toBe('charlie.txt');
    expect(sorted[3].name).toBe('bravo.txt');
  });

  it('sorts by size within same dir/file group', () => {
    const sorted = sortEntries(entries, 'size', true);
    // dirs first, then files by size asc
    expect(sorted[2].sizeBytes).toBe(100); // charlie.txt
    expect(sorted[3].sizeBytes).toBe(200); // bravo.txt
  });
});

describe('formatPermissions', () => {
  it('returns "" for 0', () => {
    expect(formatPermissions(0)).toBe('');
  });
  it('formats 0o755', () => {
    expect(formatPermissions(0o755)).toBe('rwxr-xr-x');
  });
  it('formats 0o644', () => {
    expect(formatPermissions(0o644)).toBe('rw-r--r--');
  });
  it('formats 0o777', () => {
    expect(formatPermissions(0o777)).toBe('rwxrwxrwx');
  });
  it('returns "" for 0 (falsy), matches function behavior', () => {
    expect(formatPermissions(0)).toBe('');
  });
});
