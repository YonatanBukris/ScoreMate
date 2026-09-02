import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarClock, Lock, Unlock } from 'lucide-react-native';

import { useTheme } from '../theme';
import { useGame, FREE_MONTHLY_GAME_LIMIT } from '../context/GameContext';
import * as haptics from '../utils/haptics';

/**
 * Debug-only controls. Flipping the Pro entitlement here is what lets the
 * paywall triggers be re-tested without a fresh install.
 *
 * The language picker that used to live here now ships to users on the
 * settings screen, so nothing in this component belongs in a release build and
 * the whole thing renders nothing outside `__DEV__`.
 */
export default function DevBar() {
  const theme = useTheme();
  const {
    gamesThisMonth,
    isPro,
    resetPro,
    setMonthlyQuotaFilled,
    unlockPro,
  } = useGame();
  const quotaSpent = gamesThisMonth >= FREE_MONTHLY_GAME_LIMIT;

  if (!__DEV__) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          haptics.warning();
          if (isPro) resetPro();
          else unlockPro();
        }}
        accessibilityRole="button"
        style={[
          styles.proToggle,
          {
            borderColor: isPro ? theme.colors.danger : theme.colors.success,
            backgroundColor: theme.colors.surfaceAlt,
          },
        ]}
      >
        {isPro ? (
          <Lock size={16} color={theme.colors.danger} />
        ) : (
          <Unlock size={16} color={theme.colors.success} />
        )}
        <Text
          style={[
            styles.proToggleText,
            { color: isPro ? theme.colors.danger : theme.colors.success },
          ]}
        >
          {isPro ? 'DEV: Lock Pro (reset paywall)' : 'DEV: Unlock Pro'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          haptics.warning();
          setMonthlyQuotaFilled(!quotaSpent);
        }}
        accessibilityRole="button"
        style={[
          styles.proToggle,
          styles.secondToggle,
          {
            borderColor: quotaSpent ? theme.colors.success : theme.colors.danger,
            backgroundColor: theme.colors.surfaceAlt,
          },
        ]}
      >
        <CalendarClock
          size={16}
          color={quotaSpent ? theme.colors.success : theme.colors.danger}
        />
        <Text
          style={[
            styles.proToggleText,
            { color: quotaSpent ? theme.colors.success : theme.colors.danger },
          ]}
        >
          {quotaSpent
            ? 'DEV: Refund monthly quota'
            : `DEV: Spend monthly quota (${gamesThisMonth}/${FREE_MONTHLY_GAME_LIMIT})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 14, borderWidth: 1 },
  proToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  proToggleText: { fontSize: 13, fontWeight: '700' },
  secondToggle: { marginTop: 8 },
});
