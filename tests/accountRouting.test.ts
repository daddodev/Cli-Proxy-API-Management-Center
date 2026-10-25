import { describe, expect, test } from 'bun:test';
import { normalizeAuthFilesResponse } from '../src/services/api/authFiles';
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
  test('retains percentage ceilings, disabled state, and priority from v8 credentials', () => {
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
    expect(files[0].quotaLimitPercent).toBe(82.5);
    expect(files[0].priority).toBe(12);
    expect(files[0].disabled).toBe(true);
  });
  test('preserves every supported selection mode and defaults an absent value', () => {
    for (const strategy of ['round-robin', 'fill-first', 'weighted-round-robin'])
      expect(normalizeRoutingStrategy(strategy)).toBe(strategy);
    expect(normalizeRoutingStrategy(undefined)).toBe('round-robin');
  });
});
