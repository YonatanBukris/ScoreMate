/**
 * Analytics facade.
 *
 * Call sites use the typed `track()` helper below; where the events actually
 * go is decided by the registered adapters. Today that is a console logger,
 * but adding Mixpanel or PostHog is a matter of registering another adapter at
 * startup — no call site changes.
 */

/** Where a paywall impression came from, for funnel attribution. */
export type PaywallTrigger =
  | 'player_limit'
  | 'voice_announcer'
  | 'banner'
  | 'celebration'
  | 'unknown';

/** Plans the paywall can offer. */
export type PlanId = 'annual' | 'monthly' | 'lifetime';

/**
 * Every event the app emits, with its payload. Adding a case here is what
 * makes it callable — `track()` will not accept an unknown event name.
 */
export type AnalyticsEvent =
  | { name: 'paywall_viewed'; properties: { trigger: PaywallTrigger; mock: boolean } }
  | {
      name: 'paywall_plan_selected';
      properties: { plan: PlanId; priceString: string; trigger: PaywallTrigger };
    }
  | { name: 'exit_offer_shown'; properties: { trigger: PaywallTrigger; discountPercent: number } }
  | {
      name: 'exit_offer_converted';
      properties: { plan: PlanId; discountPercent: number; priceString: string };
    }
  | {
      name: 'purchase_completed';
      properties: {
        plan: PlanId;
        productId: string;
        priceString: string;
        currencyCode: string;
        viaExitOffer: boolean;
        mock: boolean;
      };
    }
  | { name: 'purchase_cancelled'; properties: { plan: PlanId; viaExitOffer: boolean } }
  | { name: 'purchase_failed'; properties: { plan: PlanId; reason: string } }
  | { name: 'purchases_restored'; properties: { isPro: boolean; mock: boolean } }
  | {
      name: 'game_finished';
      properties: {
        templateId: string;
        playerCount: number;
        rounds: number;
        winnerScore: number | null;
        tie: boolean;
      };
    };

export type AnalyticsEventName = AnalyticsEvent['name'];

/** Implement this to forward events to a real analytics backend. */
export interface AnalyticsAdapter {
  /** Used in logs and to replace an adapter registered under the same name. */
  readonly name: string;
  track(event: AnalyticsEventName, properties: Record<string, unknown>): void;
  identify?(userId: string, traits?: Record<string, unknown>): void;
  reset?(): void;
}

/**
 * Development adapter. Deliberately quiet in production builds so shipped
 * apps do not spam the device log.
 */
export const consoleAdapter: AnalyticsAdapter = {
  name: 'console',
  track(event, properties) {
    if (!__DEV__) return;
    console.log(`[analytics] ${event}`, properties);
  },
  identify(userId, traits) {
    if (!__DEV__) return;
    console.log(`[analytics] identify ${userId}`, traits ?? {});
  },
};

const adapters: AnalyticsAdapter[] = [consoleAdapter];

/**
 * Adds an adapter, replacing any previous one with the same name so repeated
 * calls during a hot reload cannot double-report events.
 */
export function registerAdapter(adapter: AnalyticsAdapter): void {
  const index = adapters.findIndex((a) => a.name === adapter.name);
  if (index >= 0) adapters[index] = adapter;
  else adapters.push(adapter);
}

export function unregisterAdapter(name: string): void {
  const index = adapters.findIndex((a) => a.name === name);
  if (index >= 0) adapters.splice(index, 1);
}

/**
 * Records one event. Analytics must never be able to break a user flow, so a
 * throwing adapter is caught and skipped rather than propagated.
 */
export function track(event: AnalyticsEvent): void {
  for (const adapter of adapters) {
    try {
      adapter.track(event.name, event.properties);
    } catch (err) {
      if (__DEV__) console.warn(`[analytics] adapter "${adapter.name}" threw`, err);
    }
  }
}

/** Associates subsequent events with a user (e.g. the RevenueCat app user id). */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  for (const adapter of adapters) {
    try {
      adapter.identify?.(userId, traits);
    } catch (err) {
      if (__DEV__) console.warn(`[analytics] adapter "${adapter.name}" threw`, err);
    }
  }
}

/** Clears user association, e.g. on logout. */
export function reset(): void {
  for (const adapter of adapters) {
    try {
      adapter.reset?.();
    } catch (err) {
      if (__DEV__) console.warn(`[analytics] adapter "${adapter.name}" threw`, err);
    }
  }
}
