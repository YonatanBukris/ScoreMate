import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Minus } from 'lucide-react-native';

import { useTheme } from '../theme';
import { Player } from '../types';

interface Props {
  leader: Player | null;
  /** True before anyone has scored, which is not the same as a tie. */
  scoreless: boolean;
}

/**
 * Live standing indicator. Pulses whenever the lead actually changes hands, so
 * a takeover is noticeable without pulling attention on every single tap. It
 * fills with gold while someone leads and falls back to a quiet inset well
 * when the game is level.
 */
export default function LeaderBadge({ leader, scoreless }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const pulse = useRef(new Animated.Value(1)).current;
  const previousLeaderId = useRef<string | null>(leader?.id ?? null);

  useEffect(() => {
    const id = leader?.id ?? null;
    if (id === previousLeaderId.current) return;
    previousLeaderId.current = id;
    if (!id) return;

    const animation = Animated.sequence([
      Animated.spring(pulse, { toValue: 1.04, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 16 }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [leader?.id, pulse]);

  const label = leader
    ? `${t('game.leader')}: ${leader.name} (${leader.score})`
    : scoreless
      ? t('game.noLeaderYet')
      : t('game.tied');

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { borderRadius: theme.radii.md, transform: [{ scale: pulse }] },
        leader ? theme.shadows.glow(theme.colors.gold) : null,
      ]}
    >
      {leader ? (
        <LinearGradient
          colors={[theme.gradients.gold[0], theme.gradients.gold[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.banner, { borderRadius: theme.radii.md }]}
        >
          <Crown size={18} color="#3B2400" fill="#3B2400" />
          <Text style={[styles.text, styles.textOnGold]} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.banner,
            {
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Minus size={18} color={theme.colors.textFaint} />
          <Text style={[styles.text, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  text: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  textOnGold: { color: '#3B2400' },
});
