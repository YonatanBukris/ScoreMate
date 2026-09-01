import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lock, Unlock } from 'lucide-react-native';

import { useTheme } from '../theme';
import { useGame } from '../context/GameContext';
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
  const { isPro, unlockPro, resetPro } = useGame();

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
});
