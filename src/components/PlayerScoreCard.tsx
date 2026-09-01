import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react-native';

import { useTheme } from '../theme';
import { Avatar, Pressable3D } from './ui';
import AnimatedScore from './AnimatedScore';
import type { Player } from '../types';

interface Props {
  player: Player;
  selected: boolean;
  isLeader: boolean;
  onPress: () => void;
  /** Bumped per scoring tap so the selected card can pop; 0 when idle. */
  pulseKey: number;
  lastDelta: number;
}

/**
 * A player's score module. The selected card is the scoring target, so it is
 * the loudest thing on screen; the leader carries a gold halo and a "1st
 * Place" badge that survives selection changes, so the standings stay legible
 * no matter who you are currently scoring.
 */
export default function PlayerScoreCard({
  player,
  selected,
  isLeader,
  onPress,
  pulseKey,
  lastDelta,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  // Fades the selection treatment rather than snapping between states.
  const emphasis = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.spring(emphasis, {
      toValue: selected ? 1 : 0,
      useNativeDriver: false,
      speed: 16,
      bounciness: 6,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, emphasis]);

  const borderColor = isLeader
    ? theme.colors.gold
    : selected
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <Pressable3D
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${player.name}, ${player.score}`}
      style={[
        styles.wrapper,
        isLeader ? theme.shadows.glow(theme.colors.gold) : theme.shadows.card,
      ]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            borderRadius: theme.radii.lg,
            backgroundColor: selected ? theme.colors.cardElevated : theme.colors.card,
            borderColor,
            borderWidth: emphasis.interpolate({
              inputRange: [0, 1],
              outputRange: [isLeader ? 1.5 : 1, 2],
            }),
          },
        ]}
      >
        <Avatar
          name={player.name}
          size={selected ? 52 : 44}
          ringColor={isLeader ? theme.colors.gold : undefined}
        />

        <View style={styles.info}>
          <Text
            style={[theme.type.heading, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {player.name}
          </Text>

          {isLeader ? (
            <View style={[styles.leaderBadge, { backgroundColor: theme.colors.gold }]}>
              <Crown size={11} color="#3B2400" fill="#3B2400" />
              <Text style={styles.leaderBadgeText}>{t('game.firstPlace')}</Text>
            </View>
          ) : (
            <Text style={[theme.type.label, { color: theme.colors.textFaint }]}>
              {t('common.points')}
            </Text>
          )}
        </View>

        {selected ? (
          <AnimatedScore
            score={player.score}
            color={theme.colors.text}
            positiveColor={theme.colors.success}
            negativeColor={theme.colors.danger}
            pulseKey={pulseKey}
            lastDelta={lastDelta}
            size={38}
          />
        ) : (
          <Text style={[theme.type.score, styles.idleScore, { color: theme.colors.textMuted }]}>
            {player.score}
          </Text>
        )}
      </Animated.View>
    </Pressable3D>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 78,
  },
  info: { flex: 1, gap: 4 },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  leaderBadgeText: {
    color: '#3B2400',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  idleScore: { fontSize: 28 },
});
