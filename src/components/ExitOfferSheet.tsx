import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles, Tag } from 'lucide-react-native';

import { useTheme } from '../theme';
import type { Plan } from '../services/purchaseService';

interface Props {
  visible: boolean;
  discountPercent: number;
  /** Discounted plan being offered; null while it is still being resolved. */
  offer: Plan | null;
  /** Undiscounted price, struck through beside the offer price. */
  originalPriceString: string | null;
  busy: boolean;
  onClaim: () => void;
  onDismiss: () => void;
}

/**
 * Exit-intent offer, shown once when the user first tries to leave the paywall
 * without buying. Presented as a bottom sheet so the dismissal stays one tap
 * away — a trap the user cannot escape converts worse and risks store review.
 */
export default function ExitOfferSheet({
  visible,
  discountPercent,
  offer,
  originalPriceString,
  busy,
  onClaim,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.spring(slide, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 4,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, slide]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        {/* Tapping the scrim is the same as declining. */}
        <Pressable style={styles.scrim} onPress={onDismiss} accessibilityElementsHidden />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [320, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />

          <View style={[styles.badge, { backgroundColor: theme.colors.danger }]}>
            <Tag size={13} color="#FFF" />
            <Text style={styles.badgeText}>{t('exitOffer.badge')}</Text>
          </View>

          <View style={[styles.iconCircle, { backgroundColor: theme.colors.accent }]}>
            <Sparkles size={30} color="#161821" />
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('exitOffer.title', { percent: discountPercent })}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {t('exitOffer.subtitle', { percent: discountPercent })}
          </Text>

          <View style={styles.priceRow}>
            {originalPriceString ? (
              <Text style={[styles.priceWas, { color: theme.colors.textMuted }]}>
                {t('exitOffer.priceWas', { price: originalPriceString })}
              </Text>
            ) : null}
            {offer ? (
              <Text style={[styles.priceNow, { color: theme.colors.text }]}>
                {t('exitOffer.priceNow', { price: offer.priceString })}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={onClaim}
            disabled={busy || !offer}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={[
              styles.claim,
              {
                backgroundColor: theme.colors.primary,
                opacity: busy || !offer ? 0.6 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.primaryText} />
            ) : (
              <Text style={[styles.claimText, { color: theme.colors.primaryText }]}>
                {t('exitOffer.claim', { percent: discountPercent })}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDismiss}
            disabled={busy}
            style={styles.decline}
            accessibilityRole="button"
          >
            <Text style={[styles.declineText, { color: theme.colors.textMuted }]}>
              {t('exitOffer.noThanks')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.legal, { color: theme.colors.textMuted }]}>
            {offer?.id === 'lifetime'
              ? t('paywall.legalOneTime')
              : t('paywall.legalRecurring')}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
    alignItems: 'center',
    gap: 8,
  },
  grabber: { width: 42, height: 5, borderRadius: 3, marginBottom: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
  priceWas: { fontSize: 15, textDecorationLine: 'line-through' },
  priceNow: { fontSize: 22, fontWeight: '900' },
  claim: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  claimText: { fontSize: 17, fontWeight: '800' },
  decline: { paddingVertical: 12, paddingHorizontal: 20 },
  declineText: { fontSize: 15, fontWeight: '600' },
  legal: { fontSize: 11, textAlign: 'center', lineHeight: 15, marginTop: 2 },
});
