import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFilesApi } from '@/services/api';
import { apiClient } from '@/services/api/client';
import {
  quotaRoutingApi,
  ROUTING_STRATEGIES,
  type RoutingStrategy,
} from '@/services/api/quotaRouting';
import { useConfigStore } from '@/stores';
import type { AuthFileItem } from '@/types';
import { Button } from '@/components/ui/Button';
import styles from './AccountRouting.module.scss';

export function RoutingStrategyControl({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<RoutingStrategy>('round-robin');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const request = ++generation.current;
    const revision = apiClient.getConnectionRevision();
    if (disabled) return;
    setBusy(true);
    quotaRoutingApi
      .getStrategy()
      .then((value) => {
        if (request === generation.current && revision === apiClient.getConnectionRevision())
          setStrategy(value);
      })
      .catch((err: unknown) => {
        if (request === generation.current && revision === apiClient.getConnectionRevision())
          setError(String(err));
      })
      .finally(() => {
        if (request === generation.current && revision === apiClient.getConnectionRevision())
          setBusy(false);
      });
    return () => {
      generation.current = request + 1;
    };
  }, [disabled]);
  const save = async (value: RoutingStrategy) => {
    const request = generation.current;
    const revision = apiClient.getConnectionRevision();
    setBusy(true);
    setError('');
    try {
      await quotaRoutingApi.setStrategy(value);
      if (request !== generation.current || revision !== apiClient.getConnectionRevision()) return;
      setStrategy(value);
      useConfigStore.getState().clearCache();
    } catch (err) {
      if (request === generation.current && revision === apiClient.getConnectionRevision())
        setError(String(err));
    } finally {
      if (request === generation.current && revision === apiClient.getConnectionRevision())
        setBusy(false);
    }
  };
  return (
    <section className={styles.settings}>
      <label>
        {t('account_routing.strategy')}
        <select
          value={strategy}
          disabled={disabled || busy}
          onChange={(e) => void save(e.target.value as RoutingStrategy)}
        >
          {ROUTING_STRATEGIES.map((value) => (
            <option key={value} value={value}>
              {t(`account_routing.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <p>{t('account_routing.strategy_hint')}</p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function AccountRouting({
  file,
  disabled,
  onSaved,
}: {
  file: AuthFileItem;
  disabled: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [priority, setPriority] = useState(String(file.priority ?? 0));
  const [fiveHourLimit, setFiveHourLimit] = useState(
    String(file.quotaFiveHourRemainingPercent ?? 0)
  );
  const [weeklyLimit, setWeeklyLimit] = useState(String(file.quotaWeeklyRemainingPercent ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setPriority(String(file.priority ?? 0));
    setFiveHourLimit(String(file.quotaFiveHourRemainingPercent ?? 0));
    setWeeklyLimit(String(file.quotaWeeklyRemainingPercent ?? 0));
  }, [file.priority, file.quotaFiveHourRemainingPercent, file.quotaWeeklyRemainingPercent]);
  const supportsLimit = ['claude', 'codex'].includes(String(file.provider ?? file.type));
  const save = async (toggle: boolean) => {
    const revision = apiClient.getConnectionRevision();
    const current = () => mounted.current && revision === apiClient.getConnectionRevision();
    setBusy(true);
    setError('');
    try {
      if (toggle)
        await authFilesApi.setStatus(
          file.name,
          !file.disabled,
          String(file.authIndex ?? '') || undefined
        );
      else
        await authFilesApi.setRouting(file.name, {
          priority: Number(priority),
          ...(supportsLimit
            ? {
                limits: {
                  fiveHourRemainingPercent: Number(fiveHourLimit),
                  weeklyRemainingPercent: Number(weeklyLimit),
                },
              }
            : {}),
        });
      if (current()) onSaved();
    } catch (err) {
      if (current()) setError(String(err));
    } finally {
      if (current()) setBusy(false);
    }
  };
  const valid =
    priority.trim() !== '' &&
    Number.isSafeInteger(Number(priority)) &&
    (!supportsLimit ||
      [fiveHourLimit, weeklyLimit].every(
        (value) =>
          value.trim() !== '' &&
          Number.isFinite(Number(value)) &&
          Number(value) >= 0 &&
          Number(value) <= 100
      ));
  return (
    <div className={styles.settings}>
      <Button variant="secondary" disabled={disabled || busy} onClick={() => void save(true)}>
        {t(file.disabled ? 'account_routing.enable' : 'account_routing.disable')}
      </Button>
      <form
        className={styles.fields}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void save(false);
        }}
      >
        <label>
          {t('account_routing.priority')}
          <input
            type="number"
            step="1"
            value={priority}
            disabled={disabled || busy}
            onChange={(e) => setPriority(e.target.value)}
          />
        </label>
        {supportsLimit && (
          <>
            <label>
              {t('account_routing.five_hour_limit')}
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={fiveHourLimit}
                disabled={disabled || busy}
                onChange={(e) => setFiveHourLimit(e.target.value)}
              />
            </label>
            <label>
              {t('account_routing.weekly_limit')}
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={weeklyLimit}
                disabled={disabled || busy}
                onChange={(e) => setWeeklyLimit(e.target.value)}
              />
            </label>
          </>
        )}
        <Button type="submit" variant="secondary" disabled={disabled || busy || !valid}>
          {t('account_routing.save')}
        </Button>
      </form>
      {supportsLimit && <p>{t('account_routing.limit_hint')}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
