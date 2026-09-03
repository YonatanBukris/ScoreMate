import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Speech from 'expo-speech';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Medal, House, RotateCcw, Volume2 } from 'lucide-react-native';

import { RootStackParamList } from '../navigation';
import { useTheme, type Theme } from '../theme';
import {
  Avatar,
  AvatarStack,
  Card,
  Chip,
  GradientButton,
  Pressable3D,
  SectionLabel,
} from '../components/ui';
import { useGame } from '../context/GameContext';
import { getSpeechLocale } from '../i18n';
import { rankPlayers, type RankedPlayer } from '../utils/ranking';
import { rulesFromGame } from '../utils/rules';
import { useQuotaGate } from '../hooks/useQuotaGate';
import QuotaLimitModal from '../components/QuotaLimitModal';
import { Round } from '../types';
import * as haptics from '../utils/haptics';
import { track } from '../services/analyticsService';

type Props = NativeStackScreenProps<RootStackParamList, 'Podium'>;

/** Podium column heights, tallest for the winner. */
const PODIUM_HEIGHTS: Record<number, number> = { 1: 116, 2: 84, 3: 62 };
/** Depth of the faked 3D top face on each block. */
const BLOCK_DEPTH = 12;

function medalGradient(theme: Theme, rank: number) {
  if (rank === 1) return theme.gradients.gold;
  if (rank === 2) return theme.gradients.silver;
  return theme.gradients.bronze;
}

function medalColor(theme: Theme, rank: number) {
  if (rank === 1) return theme.colors.gold;
  if (rank === 2) return theme.colors.silver;
  return theme.colors.bronze;
}
/** Visual order puts 2nd on the left, the winner centre, 3rd on the right. */
const COLUMN_ORDER = [2, 1, 3];

export default function PodiumScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { games, createGame, isPro } = useGame();

  // A rematch is the most common place the quota runs out: the game that just
  // finished is the one that spent it.
  const quotaGate = useQuotaGate('rematch');

  const game = useMemo(
    () => games.find((g) => g.id === route.params.gameId) ?? null,
    [games, route.params.gameId]
  );

  const ranked = useMemo(
    () => (game ? rankPlayers(game.players, game.winCondition) : []),
    [game]
  );

  const winner = ranked[0] && !ranked[0].tied ? ranked[0] : null;
  // Only name a runner-up when second place is held outright.
  const secondPlace = ranked.filter((r) => r.rank === 2);
  const runnerUp = secondPlace.length === 1 ? secondPlace[0] : null;

  /**
   * Podium contents keyed by place. Players sharing a place share a column,
   * so a tie never drops anyone off the screen.
   */
  const podiumGroups = useMemo(() => {
    const byRank = new Map<number, RankedPlayer[]>();
    for (const entry of ranked) {
      if (entry.rank > 3) continue;
      const group = byRank.get(entry.rank) ?? [];
      group.push(entry);
      byRank.set(entry.rank, group);
    }
    return byRank;
  }, [ranked]);

  const speakCelebration = useCallback(() => {
    if (!game) return;
    Speech.stop();
    const lines: string[] = [];
    if (winner) {
      lines.push(
        t('voice.celebrationWinner', {
          name: winner.player.name,
          score: winner.player.score,
        })
      );
      if (runnerUp) {
        lines.push(
          t('voice.celebrationRunnerUp', {
            name: runnerUp.player.name,
            score: runnerUp.player.score,
          })
        );
      }
    } else if (ranked.length > 0) {
      lines.push(t('voice.celebrationTie', { score: ranked[0].player.score }));
    }
    if (lines.length === 0) return;
    // Higher and a touch slower than the in-game announcer, to sound upbeat.
    Speech.speak(lines.join(' '), {
      language: getSpeechLocale(),
      pitch: 1.15,
      rate: 0.95,
    });
  }, [game, ranked, runnerUp, t, winner]);

  // Celebrate once on arrival: haptic flourish for everyone, voice for Pro.
  const celebrated = useRef(false);
  const cancelHaptics = useRef<() => void>(() => {});
  useEffect(() => {
    if (!game || celebrated.current) return;
    celebrated.current = true;

    cancelHaptics.current = haptics.celebrate();
    if (isPro) speakCelebration();

    track({
      name: 'game_finished',
      properties: {
        templateId: game.templateId,
        playerCount: game.players.length,
        rounds: game.rounds.length,
        winnerScore: winner ? winner.player.score : null,
        tie: winner === null,
      },
    });
  }, [game, isPro, speakCelebration, winner]);

  // Teardown is mount-scoped so a dependency change cannot cut the flourish
  // short: only actually leaving the screen stops the buzz and the speech.
  useEffect(
    () => () => {
      cancelHaptics.current();
      Speech.stop();
    },
    []
  );

  const playAgain = () => {
    if (!game) return;
    // The game just finished counted against the quota, so a rematch is where
    // a free user most often runs into the limit.
    if (quotaGate.blocked()) {
      Speech.stop();
      return;
    }
    haptics.success();
    Speech.stop();
    createGame({
      templateId: game.templateId,
      playerNames: game.players.map((p) => p.name),
      // A rematch is the same game: carry the custom rules over rather than
      // falling back to the template defaults.
      rules: rulesFromGame(game),
    });
    navigation.replace('Game');
  };

  const goHome = () => {
    haptics.tap();
    Speech.stop();
    navigation.navigate('Home');
  };

  const replayCelebration = () => {
    haptics.tap();
    if (!isPro) {
      navigation.navigate('Paywall', { trigger: 'celebration' });
      return;
    }
    speakCelebration();
  };

  // The game can be missing if its history entry was deleted underneath us.
  if (!game) {
    return (
      <SafeAreaView
        style={[styles.safe, styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          {t('history.empty')}
        </Text>
        <GradientButton
          label={t('podium.newGame')}
          onPress={() => navigation.navigate('Home')}
          style={styles.emptyButton}
        />
      </SafeAreaView>
    );
  }

  const rest = ranked.filter((r) => r.rank > 3);

  const biggestRound = game.rounds.reduce<Round | null>(
    (best, round) =>
      !best || Math.abs(round.delta) > Math.abs(best.delta) ? round : best,
    null
  );
  const biggestRoundName = biggestRound
    ? game.players.find((p) => p.id === biggestRound.playerId)?.name
    : null;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>
          {t(game.templateNameKey)}
        </Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {winner
            ? t('podium.congratulations', { name: winner.player.name })
            : t('podium.tieTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {winner ? t('podium.title') : t('podium.tieSubtitle')}
        </Text>

        {/* Podium columns */}
        <View style={styles.podiumRow}>
          {COLUMN_ORDER.map((rank) => {
            const group = podiumGroups.get(rank);
            if (!group || group.length === 0) {
              return <View key={rank} style={styles.podiumSlot} />;
            }
            return (
              <PodiumColumn
                key={rank}
                entries={group}
                rank={rank}
                theme={theme}
                placeLabel={
                  group.length > 1
                    ? t('podium.sharedPlace', { rank })
                    : t('podium.place', { rank })
                }
              />
            );
          })}
        </View>

        {/* Everyone below third */}
        {rest.length > 0 ? (
          <View style={styles.restBlock}>
            <SectionLabel>{t('podium.otherPlayers')}</SectionLabel>
            {rest.map((entry) => (
              <Card key={entry.player.id} style={styles.restRow}>
                <Text style={[styles.restRank, { color: theme.colors.textFaint }]}>
                  {entry.rank}
                </Text>
                <Avatar name={entry.player.name} size={34} />
                <Text
                  style={[theme.type.heading, styles.restName, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {entry.player.name}
                </Text>
                <Text style={[styles.restScore, { color: theme.colors.text }]}>
                  {entry.player.score}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Game stats */}
        <View style={styles.statsRow}>
          <Chip label={t('podium.roundsPlayed', { count: game.rounds.length })} />
          {biggestRound && biggestRoundName ? (
            <Chip
              label={t('podium.biggestRound', {
                name: biggestRoundName,
                delta:
                  biggestRound.delta > 0 ? `+${biggestRound.delta}` : `${biggestRound.delta}`,
              })}
              color={theme.colors.success}
            />
          ) : null}
        </View>

        {/* Actions */}
        <GradientButton
          label={t('podium.playAgain')}
          onPress={playAgain}
          height={60}
          icon={<RotateCcw size={20} color={theme.colors.primaryText} />}
          style={styles.primaryButton}
        />
        <Text style={[theme.type.label, styles.playAgainHint, { color: theme.colors.textFaint }]}>
          {t('podium.playAgainHint')}
        </Text>

        <View style={styles.secondaryRow}>
          <Pressable3D
            onPress={goHome}
            accessibilityLabel={t('podium.newGame')}
            style={styles.secondarySlot}
          >
            <Card style={styles.secondaryInner}>
              <House size={18} color={theme.colors.text} />
              <Text style={[theme.type.label, { color: theme.colors.text }]}>
                {t('podium.newGame')}
              </Text>
            </Card>
          </Pressable3D>
          <Pressable3D
            onPress={replayCelebration}
            accessibilityLabel={t('podium.replay')}
            style={styles.secondarySlot}
          >
            <Card glowColor={theme.colors.accent} style={styles.secondaryInner}>
              <Volume2 size={18} color={theme.colors.accent} />
              <Text style={[theme.type.label, { color: theme.colors.accent }]}>
                {t('podium.replay')}
              </Text>
            </Card>
          </Pressable3D>
        </View>
      </ScrollView>

      <QuotaLimitModal {...quotaGate.modalProps} />
    </SafeAreaView>
  );
}

/**
 * One podium column, rising into place on mount and holding every tied player.
 * The block is drawn as a lit front face plus a darker skewed top face, which
 * reads as a solid 3D riser without pulling in a 3D dependency.
 */
function PodiumColumn({
  entries,
  rank,
  theme,
  placeLabel,
}: {
  entries: RankedPlayer[];
  rank: number;
  theme: Theme;
  placeLabel: string;
}) {
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.spring(grow, {
      toValue: 1,
      // The winner lands last so the eye finishes on the tallest column.
      delay: rank === 1 ? 260 : rank === 2 ? 60 : 160,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    });
    animation.start();
    return () => animation.stop();
  }, [grow, rank]);

  const gradient = medalGradient(theme, rank);
  const tint = medalColor(theme, rank);
  const isWinner = rank === 1;

  return (
    <Animated.View
      style={[
        styles.podiumSlot,
        {
          opacity: grow,
          transform: [
            { translateY: grow.interpolate({ inputRange: [0, 1], outputRange: [34, 0] }) },
          ],
        },
      ]}
    >
      {isWinner ? (
        <Crown size={26} color={tint} fill={tint} style={styles.crown} />
      ) : (
        <Medal size={20} color={tint} style={styles.crown} />
      )}

      <AvatarStack
        names={entries.map((e) => e.player.name)}
        size={isWinner ? 52 : 42}
        ringColor={tint}
      />

      {entries.map((entry) => (
        <Text
          key={entry.player.id}
          style={[theme.type.label, styles.podiumName, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {entry.player.name}
        </Text>
      ))}

      {/* Everyone in a column is on the same score by definition. */}
      <Text style={[styles.podiumScore, { color: theme.colors.text }]}>
        {entries[0].player.score}
      </Text>

      {/* Top face, drawn first so the front face overlaps its lower edge. */}
      <View
        style={[
          styles.blockTop,
          {
            height: BLOCK_DEPTH * 2,
            borderTopLeftRadius: theme.radii.sm,
            borderTopRightRadius: theme.radii.sm,
            backgroundColor: gradient[0],
          },
        ]}
      />
      <LinearGradient
        colors={[gradient[0], gradient[1]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          styles.blockFront,
          {
            height: PODIUM_HEIGHTS[rank],
            borderBottomLeftRadius: theme.radii.sm,
            borderBottomRightRadius: theme.radii.sm,
          },
          theme.shadows.raised,
        ]}
      >
        <Text style={styles.blockRank}>{rank}</Text>
        <Text style={styles.blockPlace} numberOfLines={2}>
          {placeLabel}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  emptyButton: { width: '100%', height: 56 },
  content: { padding: 16, paddingBottom: 36, gap: 6 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    marginTop: 22,
  },
  podiumSlot: { flex: 1, alignItems: 'center' },
  crown: { marginBottom: 4 },
  podiumName: { maxWidth: '100%', textAlign: 'center' },
  podiumScore: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  blockTop: {
    width: '92%',
    opacity: 0.55,
  },
  blockFront: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 2,
  },
  blockRank: { fontSize: 26, fontWeight: '900', color: '#3B2400' },
  blockPlace: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    color: 'rgba(59,36,0,0.75)',
  },
  restBlock: { marginTop: 24, gap: 8 },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  restRank: { fontSize: 14, fontWeight: '800', minWidth: 18 },
  restName: { flex: 1 },
  restScore: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 22,
  },
  primaryButton: { width: '100%', marginTop: 22 },
  playAgainHint: { textAlign: 'center', marginTop: 8 },
  secondaryRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondarySlot: { flex: 1, height: 52 },
  secondaryInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
