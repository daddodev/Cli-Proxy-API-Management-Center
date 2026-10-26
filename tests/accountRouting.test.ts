import { describe, expect, spyOn, test } from 'bun:test';
import { authFilesApi, normalizeAuthFilesResponse } from '../src/services/api/authFiles';
import { apiClient } from '../src/services/api/client';
import { classifyQuotaFiles } from '../src/features/quota/logic';
import { normalizeRoutingStrategy } from '../src/services/api/quotaRouting';

describe('account routing contract', () => {
  test('retains disabled accounts for re-enabling without making them refreshable', () => {
    const file = { name: 'disabled.json', provider: 'codex', disabled: true };
    expect(classifyQuotaFiles([file])).toHaveLength(0);
    const entries = classifyQuotaFiles([file], true);
    expect(entries).toHaveLength(1);
    expect(entries[0].file).toBe(file);
    expect(entries[0].file.disabled).toBe(true);
  });
  test('converts legacy used ceilings to remaining reserves and retains priority and status', () => {
    const { files } = normalizeAuthFilesResponse({
      files: [
        {
          name: 'account.json',
          type: 'codex',
          priority: 12,
          disabled: true,
          quota_limit_percent: 82.5,
        },
      ],
    });
    expect(files[0].quotaFiveHourRemainingPercent).toBe(17.5);
    expect(files[0].quotaWeeklyRemainingPercent).toBe(17.5);
    expect(files[0].priority).toBe(12);
    expect(files[0].disabled).toBe(true);
  });
  test('reads independent remaining percentages, including explicit zero over legacy', () => {
    const { files } = normalizeAuthFilesResponse({
      files: [
        {
          name: 'account.json',
          type: 'claude',
          quota_limit_percent: 20,
          quota_5h_remaining_percent: 0,
          quota_weekly_remaining_percent: 35.5,
        },
      ],
    });
    expect(files[0].quotaFiveHourRemainingPercent).toBe(0);
    expect(files[0].quotaWeeklyRemainingPercent).toBe(35.5);
  });
  test('saves both reserves directly and clears the old shared ceiling', async () => {
    const patch = spyOn(apiClient, 'patch').mockResolvedValue({});
    try {
      await authFilesApi.setRouting('account.json', {
        priority: 1,
        limits: { fiveHourRemainingPercent: 20, weeklyRemainingPercent: 35.5 },
      });
      expect(patch).toHaveBeenCalledWith('/credentials/fields', {
        name: 'account.json',
        priority: 1,
        quota_limit_percent: null,
        quota_5h_remaining_percent: 20,
        quota_weekly_remaining_percent: 35.5,
      });
    } finally {
      patch.mockRestore();
    }
  });
  test('saves zero for one reserve while retaining the other', async () => {
    const patch = spyOn(apiClient, 'patch').mockResolvedValue({});
    try {
      await authFilesApi.setRouting('account.json', {
        priority: 1,
        limits: { fiveHourRemainingPercent: 0, weeklyRemainingPercent: 35.5 },
      });
      expect(patch).toHaveBeenCalledWith('/credentials/fields', {
        name: 'account.json',
        priority: 1,
        quota_limit_percent: null,
        quota_5h_remaining_percent: 0,
        quota_weekly_remaining_percent: 35.5,
      });
    } finally {
      patch.mockRestore();
    }
  });
  test('priority-only edits leave quota settings unchanged', async () => {
    const patch = spyOn(apiClient, 'patch').mockResolvedValue({});
    try {
      await authFilesApi.setRouting('account.json', { priority: 2 });
      expect(patch).toHaveBeenCalledWith('/credentials/fields', {
        name: 'account.json',
        priority: 2,
      });
    } finally {
      patch.mockRestore();
    }
  });
  test('preserves every supported selection mode and defaults an absent value', () => {
    for (const strategy of ['round-robin', 'fill-first', 'weighted-round-robin'])
      expect(normalizeRoutingStrategy(strategy)).toBe(strategy);
    expect(normalizeRoutingStrategy(undefined)).toBe('round-robin');
  });
});
