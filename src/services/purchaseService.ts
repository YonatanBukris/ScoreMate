import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

import i18n from '../i18n';
import type { PlanId } from './analyticsService';

/**
 * RevenueCat wrapper.
 *
 * The native module does not exist in Expo Go, and it is not configured until
 * real API keys are supplied, so every entry point degrades to a mock that
 * keeps the paywall and the rest of the app fully usable in development. The
 * SDK is loaded with a guarded `require` for exactly that reason: a static
 * import would crash the bundle at startup wherever the native side is absent.
 */

/** Entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = 'pro_access';

/**
 * Fallback SDK key, used when neither an environment variable nor app.json
 * supplies a platform key.
 *
 * This is a RevenueCat **Test Store** key (`test_` prefix). Test Store keys
 * simulate purchases and cannot process real transactions — RevenueCat's own
 * guidance is never to submit a build configured with one. Ship by setting the
 * platform keys (see `readApiKey`), which take precedence over this constant
 * and need no code change.
 */
const FALLBACK_API_KEY = 'test_mOMEmTidbhFViNXtwBosGoAiHfy';

/** True for RevenueCat Test Store keys, which must not reach a store build. */
function isTestStoreKey(key: string): boolean {
  return key.startsWith('test_');
}

/**
 * Standard RevenueCat package identifiers. The dashboard assigns these to the
 * built-in duration slots, and they are what the paywall maps its plans to.
 */
const PACKAGE_IDENTIFIERS: Record<PlanId, string> = {
  annual: '$rc_annual',
  monthly: '$rc_monthly',
  lifetime: '$rc_lifetime',
};

/** Offering that holds the discounted plan shown on exit intent. */
export const EXIT_OFFER_IDENTIFIER = 'exit_offer';

/** Discount advertised in the exit-intent sheet when no offering is present. */
export const EXIT_OFFER_DISCOUNT_PERCENT = 30;

export interface Plan {
  id: PlanId;
  /** RevenueCat package identifier, or a synthetic id in mock mode. */
  packageIdentifier: string;
  productId: string;
  /** Store-formatted price, e.g. "€19.99". */
  priceString: string;
  price: number;
  currencyCode: string;
  /** Set when this plan came from the exit-intent offering. */
  isExitOffer?: boolean;
}

export type PurchaseResult =
  | { status: 'purchased'; isPro: boolean; plan: Plan }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/** Expo Go ships no third-party native modules, so RevenueCat cannot run. */
const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Rejects unset and placeholder values so they never reach `configure()`. */
function usable(value: string | undefined | null): string | null {
  const key = (value ?? '').trim();
  if (!key || key.startsWith('<') || key === 'REPLACE_ME') return null;
  return key;
}

/**
 * Resolves the SDK key, most specific source first:
 *
 *   1. `EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY` — per-build, per-platform.
 *   2. `expo.extra.revenueCat.{ios,android}` in app.json.
 *   3. `expo.extra.revenueCat.shared` — one key for both platforms.
 *   4. `FALLBACK_API_KEY` — the Test Store key.
 *
 * Release builds should set (1) or (2) with the `appl_` / `goog_` platform
 * keys; everything below them exists so development works with no setup.
 */
function readApiKey(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    revenueCat?: { ios?: string; android?: string; shared?: string };
  };
  const isIOS = Platform.OS === 'ios';

  return (
    usable(
      isIOS
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
    ) ??
    usable(isIOS ? extra.revenueCat?.ios : extra.revenueCat?.android) ??
    usable(extra.revenueCat?.shared) ??
    usable(FALLBACK_API_KEY)
  );
}

type PurchasesModule = typeof import('react-native-purchases').default;

let purchases: PurchasesModule | null = null;
let mockMode = true;
let configured = false;

/** True when running against mocks rather than the real store. */
export function isMockMode(): boolean {
  return mockMode;
}

/** Explains why mock mode is active, for the dev banner on the paywall. */
export function mockModeReason(): string | null {
  if (!mockMode) return null;
  if (IS_EXPO_GO) return 'Expo Go (no native module)';
  if (!readApiKey()) return 'no RevenueCat API key configured';
  return 'RevenueCat SDK unavailable';
}

/**
 * True when the SDK is live but running on a Test Store key, so purchases are
 * simulated by RevenueCat rather than by a real store. Surfaced on the paywall
 * so this state cannot be mistaken for working production billing.
 */
export function isUsingTestStore(): boolean {
  if (mockMode) return false;
  const key = readApiKey();
  return key !== null && isTestStoreKey(key);
}

// ---------------------------------------------------------------------------
// Mock catalogue
// ---------------------------------------------------------------------------

const MOCK_PLANS: Record<'annual' | 'monthly', Plan> = {
  annual: {
    id: 'annual',
    packageIdentifier: '$rc_annual',
    productId: 'scorekeeper_pro_annual',
    priceString: '€19.99',
    price: 19.99,
    currencyCode: 'EUR',
  },
  monthly: {
    id: 'monthly',
    packageIdentifier: '$rc_monthly',
    productId: 'scorekeeper_pro_monthly',
    priceString: '€2.99',
    price: 2.99,
    currencyCode: 'EUR',
  },
};

/** Entitlement state while mocking, so the paywall behaves end to end. */
let mockIsPro = false;

/** Lets GameContext seed the mock from persisted state on launch. */
export function setMockProState(isPro: boolean): void {
  mockIsPro = isPro;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Prepares the SDK. Safe to call more than once and never throws: a failure
 * here drops the app into mock mode instead of blocking launch.
 */
export async function configurePurchases(): Promise<void> {
  if (configured) return;
  configured = true;

  const apiKey = readApiKey();
  if (IS_EXPO_GO || !apiKey) {
    mockMode = true;
    if (__DEV__) {
      console.log(`[purchases] mock mode — ${mockModeReason()}`);
    }
    return;
  }

  try {
    // Guarded require: the module is absent wherever the native side is.
    const module = require('react-native-purchases');
    const sdk: PurchasesModule = module.default ?? module;
    if (__DEV__ && module.LOG_LEVEL) {
      sdk.setLogLevel(module.LOG_LEVEL.DEBUG);
    }
    sdk.configure({ apiKey });
    purchases = sdk;
    mockMode = false;

    if (isTestStoreKey(apiKey)) {
      // Deliberately not silenced in release: a store build on a Test Store
      // key takes no money, and this is the last chance to notice.
      console.warn(
        '[purchases] configured with a RevenueCat TEST STORE key — purchases ' +
          'are simulated and no real transaction can complete. Set the ' +
          'platform keys before submitting to the App Store or Google Play.'
      );
    }
  } catch (err) {
    mockMode = true;
    console.warn('[purchases] falling back to mock mode', err);
  }
}

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

function hasProEntitlement(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[PRO_ENTITLEMENT] !== 'undefined';
}

/**
 * Current entitlement state, or `null` when it could not be determined.
 *
 * The null case matters: a lookup failure (offline, store outage) must not be
 * read as "not subscribed", or a paying user loses access on a flaky network.
 * Callers should keep their last known value when this returns null.
 */
export async function isProActive(): Promise<boolean | null> {
  if (mockMode || !purchases) return mockIsPro;
  try {
    const info = await purchases.getCustomerInfo();
    return hasProEntitlement(info);
  } catch (err) {
    console.warn('[purchases] getCustomerInfo failed; keeping cached entitlement', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Offerings
// ---------------------------------------------------------------------------

function toPlan(
  pkg: PurchasesPackage,
  id: PlanId,
  isExitOffer = false
): Plan {
  return {
    id,
    packageIdentifier: pkg.identifier,
    productId: pkg.product.identifier,
    priceString: pkg.product.priceString,
    price: pkg.product.price,
    currencyCode: pkg.product.currencyCode,
    isExitOffer,
  };
}

/** Remembers the live packages so a purchase can be made from a Plan id. */
const packageByPlan = new Map<string, PurchasesPackage>();

function cacheKey(id: PlanId, isExitOffer: boolean): string {
  return `${isExitOffer ? 'exit:' : ''}${id}`;
}

/**
 * Finds the package backing a plan. Matching `$rc_annual` / `$rc_monthly` by
 * identifier first keeps the mapping explicit and independent of the SDK's
 * convenience accessors, which are then used as a fallback so an offering
 * built from custom package identifiers still resolves.
 */
function findPackage(
  offering: PurchasesOffering,
  id: PlanId
): PurchasesPackage | null {
  const byIdentifier = offering.availablePackages.find(
    (pkg) => pkg.identifier === PACKAGE_IDENTIFIERS[id]
  );
  if (byIdentifier) return byIdentifier;

  if (id === 'annual') return offering.annual ?? null;
  if (id === 'monthly') return offering.monthly ?? null;
  return offering.lifetime ?? null;
}

const PLAN_ORDER: PlanId[] = ['annual', 'monthly', 'lifetime'];

function readOffering(offering: PurchasesOffering, isExitOffer: boolean): Plan[] {
  const plans: Plan[] = [];
  for (const id of PLAN_ORDER) {
    const pkg = findPackage(offering, id);
    if (!pkg) continue;
    packageByPlan.set(cacheKey(id, isExitOffer), pkg);
    plans.push(toPlan(pkg, id, isExitOffer));
  }
  return plans;
}

/**
 * The plans shown on the paywall, newest pricing first. Returns the mock
 * catalogue whenever offerings cannot be fetched, so the screen is never
 * empty and never blocks on the network.
 */
export async function getPlans(): Promise<Plan[]> {
  if (mockMode || !purchases) {
    return [MOCK_PLANS.annual, MOCK_PLANS.monthly];
  }
  try {
    const offerings = await purchases.getOfferings();
    const current = offerings.current;
    if (!current || current.availablePackages.length === 0) {
      return [MOCK_PLANS.annual, MOCK_PLANS.monthly];
    }
    const plans = readOffering(current, false);
    return plans.length > 0 ? plans : [MOCK_PLANS.annual, MOCK_PLANS.monthly];
  } catch (err) {
    console.warn('[purchases] getOfferings failed, using fallback pricing', err);
    return [MOCK_PLANS.annual, MOCK_PLANS.monthly];
  }
}

/**
 * The discounted plan for the exit-intent sheet. Prefers a dedicated
 * `exit_offer` offering so pricing stays under dashboard control; without one
 * it derives an indicative price from the standard annual plan.
 */
export async function getExitOffer(standardAnnual: Plan | null): Promise<Plan | null> {
  if (!mockMode && purchases) {
    try {
      const offerings = await purchases.getOfferings();
      const offering = offerings.all[EXIT_OFFER_IDENTIFIER];
      if (offering) {
        const plans = readOffering(offering, true);
        // Prefer lifetime, then annual — whichever the dashboard configured.
        const preferred =
          plans.find((p) => p.id === 'lifetime') ?? plans.find((p) => p.id === 'annual');
        if (preferred) return preferred;
      }
    } catch (err) {
      console.warn('[purchases] exit offering lookup failed', err);
    }
  }

  const base = standardAnnual ?? MOCK_PLANS.annual;
  const discounted = round2(base.price * (1 - EXIT_OFFER_DISCOUNT_PERCENT / 100));
  return {
    ...base,
    id: 'annual',
    packageIdentifier: base.packageIdentifier,
    price: discounted,
    priceString: formatPrice(discounted, base.currencyCode, base.priceString),
    isExitOffer: true,
  };
}

// ---------------------------------------------------------------------------
// Purchasing
// ---------------------------------------------------------------------------

function isCancellation(err: unknown): boolean {
  const e = err as { userCancelled?: boolean; code?: string | number };
  return e?.userCancelled === true;
}

/**
 * Buys a plan. In mock mode the purchase always succeeds immediately so the
 * post-purchase flow can be exercised without store credentials.
 */
export async function purchasePlan(plan: Plan): Promise<PurchaseResult> {
  if (mockMode || !purchases) {
    mockIsPro = true;
    return { status: 'purchased', isPro: true, plan };
  }

  const pkg = packageByPlan.get(cacheKey(plan.id, plan.isExitOffer === true));
  if (!pkg) {
    return { status: 'error', message: 'Package unavailable. Please try again.' };
  }

  try {
    const result = await purchases.purchasePackage(pkg);
    return {
      status: 'purchased',
      isPro: hasProEntitlement(result.customerInfo),
      plan,
    };
  } catch (err) {
    if (isCancellation(err)) return { status: 'cancelled' };
    const message = err instanceof Error ? err.message : 'Purchase failed.';
    console.warn('[purchases] purchase failed', err);
    return { status: 'error', message };
  }
}

/** Restores prior purchases. Required by App Store review. */
export async function restorePurchases(): Promise<{ isPro: boolean; error?: string }> {
  if (mockMode || !purchases) {
    // Nothing to restore against; report the current mock entitlement.
    return { isPro: mockIsPro };
  }
  try {
    const info = await purchases.restorePurchases();
    return { isPro: hasProEntitlement(info) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Restore failed.';
    console.warn('[purchases] restore failed', err);
    return { isPro: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Price helpers
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Formats an amount in the plan's currency. Prefers Intl; where it is missing
 * or the currency is unknown it reuses the store string's own symbol so the
 * result still looks native rather than falling back to a bare number.
 */
export function formatPrice(
  amount: number,
  currencyCode: string,
  template?: string
): string {
  try {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    const fixed = amount.toFixed(2);
    if (template) {
      // Reuse whatever surrounds the digits in the store's own formatting.
      const prefix = template.match(/^[^\d]*/)?.[0] ?? '';
      const suffix = template.match(/[^\d]*$/)?.[0] ?? '';
      if (prefix || suffix) return `${prefix}${fixed}${suffix}`;
    }
    return `${fixed} ${currencyCode}`;
  }
}

/** Per-week price of an annual plan, for the "just X per week" line. */
export function weeklyBreakdown(plan: Plan): string {
  return formatPrice(round2(plan.price / 52), plan.currencyCode, plan.priceString);
}

/**
 * How much the annual plan saves against paying monthly for a year, rounded
 * down to stay conservative — an overstated saving risks store rejection.
 */
export function annualSavingsPercent(annual: Plan, monthly: Plan): number | null {
  if (monthly.price <= 0 || annual.price <= 0) return null;
  const yearAtMonthlyRate = monthly.price * 12;
  if (annual.price >= yearAtMonthlyRate) return null;
  return Math.floor((1 - annual.price / yearAtMonthlyRate) * 100);
}
