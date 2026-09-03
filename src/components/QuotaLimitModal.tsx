import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarClock, Crown, Hourglass } from 'lucide-react-native';

import { useTheme } from '../theme';
import { GradientButton } from './ui';

/** How far the sheet travels on its way in. */
const SLIDE_DISTANCE = 340;

/**
 * The monthly quota's own sheet, shown when a free user is out of games.
 *
 * Presented as a bottom sheet rather than a native alert so the moment carries
 * the app's own typography and the upgrade CTA reads as a real button. It is
 * modelled on `ExitOfferSheet` — same scrim, spring and grabber — so the two
 * paywall moments feel like one system. Dismissal stays one tap away: tapping
 * the scrim, the Android back button and "Maybe later" all decline.
 */
export default function QuotaLimitModal({
  visible,
  used,
  limit,
  onUpgrade,
  onDismiss,
}: {
  visible: boolean;
  /** Games already finished this month, for the counter pill. */
  used: number;
  limit: number;
  /** Closes the sheet, then opens the paywall. */
  onUpgrade: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        {/* Tapping the scrim is the same as "Maybe later". */}
        <Pressable style={styles.scrim} onPress={onDismiss} accessibilityElementsHidden />

        <Animated.View
          style={[
            styles.sheet,
            theme.shadows.floating,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              // The sheet sits flush with the bottom edge, so it owns the
              // home-indicator inset itself.
              paddingBottom: Math.max(24, insets.bottom + 12),
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SLIDE_DISTANCE, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />

          <View style={[styles.iconGlow, theme.shadows.glow(theme.colors.primary)]}>
            <LinearGradient
              colors={[theme.gradients.primary[0], theme.gradients.primary[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Hourglass size={30} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* The bare number, so "you are out" needs no reading. */}
          <View
            style={[
              styles.counter,
              {
                backgroundColor: theme.colors.surfaceAlt,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <CalendarClock size={12} color={theme.colors.danger} />
            <Text style={[theme.type.caption, { color: theme.colors.danger }]}>
              {t('quota.used', { used: Math.min(used, limit), limit })}
            </Text>
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>{t('quota.limitTitle')}</Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>
            {t('quota.limitMessage', { count: limit })}
          </Text>

          <GradientButton
            label={t('paywall.unlock')}
            onPress={onUpgrade}
            height={56}
            icon={<Crown size={19} color={theme.colors.primaryText} />}
            style={styles.cta}
          />

          <TouchableOpacity
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.maybeLater')}
            style={styles.decline}
          >
            <Text style={[styles.declineText, { color: theme.colors.textMuted }]}>
              {t('paywall.maybeLater')}
            </Text>
          </TouchableOpacity>

          <Text style={[theme.type.caption, styles.resets, { color: theme.colors.textFaint }]}>
            {t('quota.resetsHint')}
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
    // Only the three visible edges are rimmed; a border along the screen
    // bottom would read as a seam rather than an outline.
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 10,
    alignItems: 'center',
    gap: 8,
  },
  grabber: { width: 42, height: 5, borderRadius: 3, marginBottom: 12 },
  iconGlow: { borderRadius: 32 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    marginTop: 8,
  },
  title: { fontSize: 23, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  cta: { width: '100%', height: 56, marginTop: 14 },
  decline: { paddingVertical: 12, paddingHorizontal: 20 },
  declineText: { fontSize: 15, fontWeight: '600' },
  resets: { textAlign: 'center', fontWeight: '500' },
});
