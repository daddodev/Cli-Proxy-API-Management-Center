import { apiClient } from './client';
import { getConfigValue } from './configValue';

export const ROUTING_STRATEGIES = ['round-robin', 'fill-first', 'weighted-round-robin'] as const;
export type RoutingStrategy = (typeof ROUTING_STRATEGIES)[number];

export function normalizeRoutingStrategy(value: unknown): RoutingStrategy {
  return ROUTING_STRATEGIES.includes(value as RoutingStrategy)
    ? (value as RoutingStrategy)
    : 'round-robin';
}

export const quotaRoutingApi = {
  async getStrategy(): Promise<RoutingStrategy> {
    return normalizeRoutingStrategy(
      await getConfigValue('/config/routing/strategy', 'round-robin')
    );
  },
  setStrategy: (strategy: RoutingStrategy) => apiClient.put('/config/routing/strategy', strategy),
};
