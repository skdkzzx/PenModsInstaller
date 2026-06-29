import { describe, it, expect } from 'vitest';
import { InstallStep, STEP_INFO, STEP_ORDER } from '../steps';

describe('InstallStep constants', () => {
  it('has correct step values', () => {
    expect(InstallStep.Welcome).toBe('welcome');
    expect(InstallStep.EnableAdb).toBe('enable-adb');
    expect(InstallStep.Connect).toBe('connect');
    expect(InstallStep.DetectDevice).toBe('detect');
    expect(InstallStep.ChooseComponents).toBe('choose');
    expect(InstallStep.Installing).toBe('installing');
    expect(InstallStep.Complete).toBe('complete');
    expect(InstallStep.Troubleshoot).toBe('troubleshoot');
  });

  it('has all steps in STEP_INFO', () => {
    const stepValues = Object.values(InstallStep) as string[];
    const infoKeys = Object.keys(STEP_INFO);
    expect(stepValues.every(v => infoKeys.includes(v))).toBe(true);
  });

  it('all STEP_INFO entries have required fields', () => {
    for (const info of Object.values(STEP_INFO)) {
      expect(info).toHaveProperty('id');
      expect(info).toHaveProperty('title');
      expect(info).toHaveProperty('description');
      expect(typeof info.order).toBe('number');
    }
  });
});

describe('STEP_ORDER', () => {
  it('excludes troubleshoot (order -1)', () => {
    const ids = STEP_ORDER.map(s => s.id);
    expect(ids).not.toContain('troubleshoot');
  });

  it('is sorted by order ascending', () => {
    for (let i = 1; i < STEP_ORDER.length; i++) {
      expect(STEP_ORDER[i].order).toBeGreaterThanOrEqual(STEP_ORDER[i - 1].order);
    }
  });

  it('starts with Welcome (order 0)', () => {
    expect(STEP_ORDER[0].id).toBe(InstallStep.Welcome);
    expect(STEP_ORDER[0].order).toBe(0);
  });
});
