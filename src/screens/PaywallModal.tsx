import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BarChart3,
  Check,
  Crown,
  ShieldOff,
  Users,
  Volume2,
  X,
} from 'lucide-react-native';

import { RootStackParamList } from '../navigation';
import { useTheme } from '../theme';
import { useGame, FREE_PLAYER_LIMIT } from '../context/GameContext';
import * as haptics from '../utils/haptics';
import ExitOfferSheet from '../components/ExitOfferSheet';
import {
  EXIT_OFFER_DISCOUNT_PERCENT,
  annualSavingsPercent,
  getExitOffer,
  getPlans,
  isMockMode,
  isUsingTestStore,
  mockModeReason,
  purchasePlan,
  restorePurchases,
  weeklyBreakdown,
  type Plan,
} from '../services/purchaseService';
import { track, type PaywallTrigger } from '../services/analyticsService';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

/**
 * The published legal page. Both documents live on one page, so each link
 * deep-links to its own section rather than dropping the reader at the top.
 */
const TERMS_URL = 'https://yonatanbukris.github.io/ScoreMate/#terms';
const PRIVACY_URL = 'https://yonatanbukris.github.io/ScoreMate/#privacy';

export default function PaywallModal({ navigation, route }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isPro, unlockPro } = useGame();

  const trigger: PaywallTrigger = route.params?.trigger ?? 'unknown';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('annual');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [exitOffer, setExitOffer] = useState<Plan | null>(null);
  const [exitSheetVisible, setExitSheetVisible] = useState(false);

  // The exit offer fires at most once, and only while the user is not Pro.
  const exitOfferUsed = useRef(false);
  // Set immediately before a close we have decided to allow through.
  const allowClose = useRef(false);

  const annual = plans.find((p) => p.id === 'annual') ?? null;
  const monthly = plans.find((p) => p.id === 'monthly') ?? null;
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? annual ?? plans[0] ?? null;

  const savings = useMemo(
    () => (annual && monthly ? annualSavingsPercent(annual, monthly) : null),
    [annual, monthly]
  );

  // Load the catalogue and pre-resolve the exit offer so the sheet is instant.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await getPlans();
      if (cancelled) return;
      setPlans(loaded);
      setLoadingPlans(false);

      const standardAnnual = loaded.find((p) => p.id === 'annual') ?? null;
      const offer = await getExitOffer(standardAnnual);
      if (!cancelled) setExitOffer(offer);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    track({ name: 'paywall_viewed', properties: { trigger, mock: isMockMode() } });
  }, [trigger]);

  const closeForReal = useCallback(() => {
    allowClose.current = true;
    navigation.goBack();
  }, [navigation]);

  /**
   * Intercepts every way out of this screen — the X, "maybe later", the
   * Android back button and the iOS swipe-down — so the exit offer gets its
   * one chance regardless of how the user tries to leave.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allowClose.current || isPro || exitOfferUsed.current) return;
      e.preventDefault();
      exitOfferUsed.current = true;
      haptics.tap();
      setExitSheetVisible(true);
      track({
        name: 'exit_offer_shown',
        properties: { trigger, discountPercent: EXIT_OFFER_DISCOUNT_PERCENT },
      });
    });
    return unsubscribe;
  }, [navigation, isPro, trigger]);

  const selectPlan = (plan: Plan) => {
    if (plan.id === selectedPlanId) return;
    haptics.selection();
    setSelectedPlanId(plan.id);
    track({
      name: 'paywall_plan_selected',
      properties: { plan: plan.id, priceString: plan.priceString, trigger },
    });
  };

  const runPurchase = async (plan: Plan, viaExitOffer: boolean) => {
    setBusy(true);
    const result = await purchasePlan(plan);
    setBusy(false);

    if (result.status === 'cancelled') {
      track({ name: 'purchase_cancelled', properties: { plan: plan.id, viaExitOffer } });
      return;
    }
    if (result.status === 'error') {
      haptics.warning();
      track({ name: 'purchase_failed', properties: { plan: plan.id, reason: result.message } });
      Alert.alert(t('paywall.purchaseFailedTitle'), result.message);
      return;
    }

    haptics.success();
    track({
      name: 'purchase_completed',
      properties: {
        plan: plan.id,
        productId: plan.productId,
        priceString: plan.priceString,
        currencyCode: plan.currencyCode,
        viaExitOffer,
        mock: isMockMode(),
      },
    });
    if (viaExitOffer) {
      track({
        name: 'exit_offer_converted',
        properties: {
          plan: plan.id,
          discountPercent: EXIT_OFFER_DISCOUNT_PERCENT,
          priceString: plan.priceString,
        },
      });
    }
    if (result.isPro) unlockPro();
    setExitSheetVisible(false);
    closeForReal();
  };

  const handleSubscribe = () => {
    if (!selectedPlan || busy) return;
    haptics.tap();
    runPurchase(selectedPlan, false);
  };

  const handleClaimExitOffer = () => {
    if (!exitOffer || busy) return;
    haptics.success();
    runPurchase(exitOffer, true);
  };

  const handleDeclineExitOffer = () => {
    haptics.tap();
    setExitSheetVisible(false);
    closeForReal();
  };

  const handleRestore = async () => {
    haptics.tap();
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);

    track({ name: 'purchases_restored', properties: { isPro: result.isPro, mock: isMockMode() } });

    if (result.error) {
      Alert.alert(t('paywall.purchaseFailedTitle'), result.error);
      return;
    }
    if (result.isPro) {
      unlockPro();
      Alert.alert(t('paywall.restoreDoneTitle'), t('paywall.restoreDoneMessage'));
      closeForReal();
    } else {
      Alert.alert(t('paywall.restoreNoneTitle'), t('paywall.restoreNoneMessage'));
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      // A missing browser must not crash the paywall.
    });
  };

  const features = [
    {
      icon: <Users size={22} color={theme.colors.primary} />,
      title: t('paywall.featureUnlimitedPlayers'),
      desc: t('paywall.featureUnlimitedPlayersDesc', { count: FREE_PLAYER_LIMIT }),
    },
    {
      icon: <Volume2 size={22} color={theme.colors.primary} />,
      title: t('paywall.featureVoice'),
      desc: t('paywall.featureVoiceDesc'),
    },
    {
      icon: <BarChart3 size={22} color={theme.colors.primary} />,
      title: t('paywall.featureHistory'),
      desc: t('paywall.featureHistoryDesc'),
    },
    {
      icon: <ShieldOff size={22} color={theme.colors.primary} />,
      title: t('paywall.featureNoAds'),
      desc: t('paywall.featureNoAdsDesc'),
    },
  ];

  const devReason = mockModeReason();
  // Simulated money: worth saying out loud on the buying screen, and more
  // specific than the generic mock-mode reason, so it wins the banner.
  const testStore = isUsingTestStore();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.closeRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        >
          <X size={26} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.crownBadge, { backgroundColor: theme.colors.primary }]}>
          <Crown size={40} color={theme.colors.accent} />
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('paywall.headline')}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {t('paywall.subtitle')}
        </Text>

        {devReason || testStore ? (
          <View style={[styles.devNotice, { borderColor: theme.colors.accent }]}>
            <Text style={[styles.devNoticeText, { color: theme.colors.accent }]}>
              {testStore
                ? t('paywall.testStoreNotice')
                : t('paywall.devModeNotice', { reason: devReason })}
            </Text>
          </View>
        ) : null}

        {/* Value proposition */}
        <View style={styles.features}>
          {features.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: theme.colors.surfaceAlt }]}>
                {f.icon}
              </View>
              <View style={styles.flex}>
                <Text style={[styles.featureTitle, { color: theme.colors.text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: theme.colors.textMuted }]}>
                  {f.desc}
                </Text>
              </View>
              <Check size={20} color={theme.colors.success} />
            </View>
          ))}
        </View>

        {isPro ? (
          <View style={[styles.proActive, { backgroundColor: theme.colors.success }]}>
            <Check size={20} color="#FFF" />
            <Text style={styles.proActiveText}>{t('paywall.proActive')}</Text>
          </View>
        ) : loadingPlans ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
              {t('paywall.loadingPlans')}
            </Text>
          </View>
        ) : (
          <>
            {/* Plan selection */}
            <View style={styles.plans}>
              {annual ? (
                <PlanCard
                  plan={annual}
                  selected={selectedPlan?.id === 'annual'}
                  onPress={() => selectPlan(annual)}
                  title={t('paywall.planAnnual')}
                  period={t('paywall.perYear')}
                  footnote={t('paywall.perWeek', { price: weeklyBreakdown(annual) })}
                  badge={
                    savings !== null
                      ? `${t('paywall.bestValue')} · ${t('paywall.savePercent', { percent: savings })}`
                      : t('paywall.bestValue')
                  }
                />
              ) : null}
              {monthly ? (
                <PlanCard
                  plan={monthly}
                  selected={selectedPlan?.id === 'monthly'}
                  onPress={() => selectPlan(monthly)}
                  title={t('paywall.planMonthly')}
                  period={t('paywall.perMonth')}
                />
              ) : null}
            </View>

            <TouchableOpacity
              onPress={handleSubscribe}
              disabled={busy || !selectedPlan}
              activeOpacity={0.9}
              accessibilityRole="button"
              style={[
                styles.unlockButton,
                { backgroundColor: theme.colors.primary, opacity: busy ? 0.6 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.primaryText} />
              ) : (
                <Text style={[styles.unlockText, { color: theme.colors.primaryText }]}>
                  {t('paywall.subscribeCta')}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.legal, { color: theme.colors.textMuted }]}>
              {selectedPlan?.id === 'lifetime'
                ? t('paywall.legalOneTime')
                : t('paywall.legalRecurring')}
            </Text>

            <TouchableOpacity
              onPress={handleRestore}
              disabled={restoring}
              style={styles.restore}
              accessibilityRole="button"
            >
              <Text style={[styles.restoreText, { color: theme.colors.textMuted }]}>
                {restoring ? t('paywall.restoring') : t('paywall.restore')}
              </Text>
            </TouchableOpacity>

            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={() => openLink(TERMS_URL)} accessibilityRole="link">
                <Text style={[styles.legalLink, { color: theme.colors.textMuted }]}>
                  {t('paywall.terms')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.legalLink, { color: theme.colors.border }]}>·</Text>
              <TouchableOpacity onPress={() => openLink(PRIVACY_URL)} accessibilityRole="link">
                <Text style={[styles.legalLink, { color: theme.colors.textMuted }]}>
                  {t('paywall.privacy')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.later}>
          <Text style={[styles.laterText, { color: theme.colors.textMuted }]}>
            {t('paywall.maybeLater')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ExitOfferSheet
        visible={exitSheetVisible}
        discountPercent={EXIT_OFFER_DISCOUNT_PERCENT}
        offer={exitOffer}
        originalPriceString={annual?.priceString ?? null}
        busy={busy}
        onClaim={handleClaimExitOffer}
        onDismiss={handleDeclineExitOffer}
      />
    </SafeAreaView>
  );
}

/** One selectable subscription option. */
function PlanCard({
  plan,
  selected,
  onPress,
  title,
  period,
  footnote,
  badge,
}: {
  plan: Plan;
  selected: boolean;
  onPress: () => void;
  title: string;
  period: string;
  footnote?: string;
  badge?: string;
}) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.planCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      {badge ? (
        <View style={[styles.planBadge, { backgroundColor: theme.colors.accent }]}>
          <Text style={styles.planBadgeText}>{badge}</Text>
        </View>
      ) : null}

      <View style={styles.planTop}>
        <View
          style={[
            styles.radio,
            {
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              backgroundColor: selected ? theme.colors.primary : 'transparent',
            },
          ]}
        >
          {selected ? <Check size={13} color={theme.colors.primaryText} /> : null}
        </View>
        <View style={styles.flex}>
          <Text style={[styles.planTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.planPeriod, { color: theme.colors.textMuted }]}>{period}</Text>
        </View>
        <Text style={[styles.planPrice, { color: theme.colors.text }]}>{plan.priceString}</Text>
      </View>

      {footnote ? (
        <Text style={[styles.planFootnote, { color: theme.colors.primary }]}>{footnote}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  closeRow: { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'flex-end' },
  content: { paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center' },
  crownBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  title: { fontSize: 26, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  subtitle: { fontSize: 15, marginTop: 6, textAlign: 'center' },
  devNotice: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  devNoticeText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  features: { width: '100%', gap: 10, marginTop: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { fontSize: 16, fontWeight: '700' },
  featureDesc: { fontSize: 13, marginTop: 2 },
  loading: { marginTop: 30, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 14 },
  plans: { width: '100%', gap: 12, marginTop: 26 },
  planCard: { borderRadius: 18, padding: 16, paddingTop: 18 },
  planBadge: {
    position: 'absolute',
    top: -10,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  planBadgeText: { color: '#161821', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: { fontSize: 17, fontWeight: '800' },
  planPeriod: { fontSize: 13, marginTop: 1 },
  planPrice: { fontSize: 20, fontWeight: '900' },
  planFootnote: { fontSize: 13, fontWeight: '700', marginTop: 8, marginLeft: 34 },
  unlockButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  unlockText: { fontSize: 18, fontWeight: '800' },
  legal: { fontSize: 11, marginTop: 12, textAlign: 'center', lineHeight: 15 },
  restore: { marginTop: 14 },
  restoreText: { fontSize: 14, fontWeight: '700' },
  legalLinks: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  legalLink: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  proActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 28,
  },
  proActiveText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  later: { marginTop: 20 },
  laterText: { fontSize: 15, fontWeight: '600' },
});
