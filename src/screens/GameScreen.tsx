import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Speech from 'expo-speech';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Flag,
  Repeat,
  Target,
  Trash2,
  Undo2,
  Volume2,
} from 'lucide-react-native';

import { RootStackParamList } from '../navigation';
import { useTheme } from '../theme';
import { useGame, getLeader } from '../context/GameContext';
import { getSpeechLocale } from '../i18n';
import { Round } from '../types';
import { getCompletionReason, roundsCompleted } from '../utils/rules';
import PlayerScoreCard from '../components/PlayerScoreCard';
import LeaderBadge from '../components/LeaderBadge';
import {
  Card,
  Chip,
  GradientButton,
  Pressable3D,
  ScorePill,
  SectionLabel,
} from '../components/ui';
import * as haptics from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

export default function GameScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { activeGame, applyScore, undoLastRound, endGame, deleteGame, isPro } = useGame();

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [customVisible, setCustomVisible] = useState(false);
  const [customValue, setCustomValue] = useState('');
  // Drives the score pop; incremented per tap so repeat deltas still animate.
  const [pulse, setPulse] = useState({ key: 0, delta: 0 });

  // Ending the game routes to the podium, so suppress the generic bail-out.
  const endingRef = useRef(false);

  // If the game disappears for any other reason, leave the screen.
  useEffect(() => {
    if (!activeGame && !endingRef.current) navigation.goBack();
  }, [activeGame, navigation]);

  // Default the selection to the first player once the game is available.
  useEffect(() => {
    if (activeGame && !selectedPlayerId) {
      setSelectedPlayerId(activeGame.players[0]?.id ?? null);
    }
  }, [activeGame, selectedPlayerId]);

  // Stop any queued speech when leaving the screen.
  useEffect(() => () => { Speech.stop(); }, []);

  const completionReason = activeGame ? getCompletionReason(activeGame) : null;

  // A configured target score or round limit finishes the game on its own:
  // say which limit was hit, then hand straight over to the podium.
  useEffect(() => {
    if (!activeGame || !completionReason || endingRef.current) return;
    endingRef.current = true;
    haptics.success();
    Speech.stop();

    const message =
      completionReason === 'target'
        ? t('game.autoEndTarget', { score: activeGame.targetScore })
        : t('game.autoEndRounds', { count: activeGame.maxRounds });

    Alert.alert(
      t('game.autoEndTitle'),
      message,
      [
        {
          text: t('game.viewStandings'),
          onPress: () => {
            const gameId = endGame();
            if (gameId) {
              navigation.replace('Podium', { gameId });
            } else {
              endingRef.current = false;
              navigation.goBack();
            }
          },
        },
      ],
      // Dismissing without a decision would strand the game mid-completion.
      { cancelable: false }
    );
  }, [activeGame, completionReason, endGame, navigation, t]);

  const leader = useMemo(
    () => (activeGame ? getLeader(activeGame.players, activeGame.winCondition) : null),
    [activeGame]
  );

  if (!activeGame) return null;

  const selectedPlayer =
    activeGame.players.find((p) => p.id === selectedPlayerId) ?? activeGame.players[0];

  const score = (delta: number) => {
    if (!selectedPlayer || delta === 0) return;
    haptics.score(delta);
    applyScore(selectedPlayer.id, delta);
    setPulse((prev) => ({ key: prev.key + 1, delta }));
  };

  const submitCustom = () => {
    const parsed = parseInt(customValue, 10);
    if (!Number.isNaN(parsed) && parsed !== 0) score(parsed);
    setCustomValue('');
    setCustomVisible(false);
  };

  const announce = () => {
    haptics.tap();
    if (!isPro) {
      navigation.navigate('Paywall', { trigger: 'voice_announcer' });
      return;
    }
    Speech.stop();
    const parts: string[] = [];
    if (leader) {
      parts.push(t('voice.leading', { name: leader.name, score: leader.score }));
    } else {
      parts.push(t('voice.tied'));
    }
    parts.push(t('voice.standings'));
    for (const p of activeGame.players) {
      parts.push(t('voice.scoreLine', { name: p.name, score: p.score }));
    }
    Speech.speak(parts.join(' '), { language: getSpeechLocale() });
  };

  const confirmEnd = () => {
    haptics.warning();
    Alert.alert(t('game.confirmEndTitle'), t('game.confirmEndMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('game.endGame'),
        style: 'destructive',
        onPress: () => {
          Speech.stop();
          endingRef.current = true;
          const gameId = endGame();
          if (gameId) {
            navigation.replace('Podium', { gameId });
          } else {
            endingRef.current = false;
            navigation.goBack();
          }
        },
      },
    ]);
  };

  /**
   * Discarding throws the session away: no podium, no history entry. The
   * `endingRef` guard keeps the "game vanished" effect from racing us back a
   * screen before the explicit navigation runs.
   */
  const confirmDiscard = () => {
    haptics.warning();
    Alert.alert(t('session.confirmDiscardTitle'), t('session.confirmDiscardMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('session.discardCta'),
        style: 'destructive',
        onPress: () => {
          Speech.stop();
          endingRef.current = true;
          deleteGame(activeGame.id);
          navigation.navigate('Home');
        },
      },
    ]);
  };

  const playerName = (id: string) =>
    activeGame.players.find((p) => p.id === id)?.name ?? t('common.player');

  const renderRound = ({ item }: { item: Round }) => (
    <View style={[styles.roundRow, { borderBottomColor: theme.colors.border }]}>
      <Text
        style={[theme.type.body, styles.roundPlayer, { color: theme.colors.text }]}
        numberOfLines={1}
      >
        {playerName(item.playerId)}
      </Text>
      <Text
        style={[
          styles.roundDelta,
          { color: item.delta >= 0 ? theme.colors.success : theme.colors.danger },
        ]}
      >
        {item.delta > 0 ? `+${item.delta}` : item.delta}
      </Text>
      <Text style={[theme.type.label, styles.roundResult, { color: theme.colors.textFaint }]}>
        = {item.resultingScore}
      </Text>
    </View>
  );

  /**
   * Everything above the round log lives in the list header: one FlatList owns
   * the scroll, which avoids nesting virtualized lists and lets the whole
   * screen move as a single surface.
   */
  const header = (
    <View style={styles.headerBlock}>
      <LeaderBadge
        leader={leader}
        scoreless={activeGame.players.every((p) => p.score === 0)}
      />

      {/* The rules in force, so custom games stay legible mid-play. */}
      <View style={styles.rulesRow}>
        <Chip
          label={
            activeGame.winCondition === 'highest'
              ? t('template.highestWins')
              : t('template.lowestWins')
          }
          color={
            activeGame.winCondition === 'highest'
              ? theme.colors.success
              : theme.colors.primary
          }
          icon={
            activeGame.winCondition === 'highest' ? (
              <ArrowUp size={10} color={theme.colors.success} />
            ) : (
              <ArrowDown size={10} color={theme.colors.primary} />
            )
          }
        />
        {activeGame.targetScore ? (
          <Chip
            label={t('template.targetScore', { score: activeGame.targetScore })}
            color={theme.colors.accent}
            icon={<Target size={10} color={theme.colors.accent} />}
          />
        ) : null}
        {activeGame.maxRounds ? (
          <Chip
            label={t('game.roundProgress', {
              current: roundsCompleted(activeGame),
              total: activeGame.maxRounds,
            })}
            color={theme.colors.accent}
            icon={<Repeat size={10} color={theme.colors.accent} />}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('common.players')}</SectionLabel>
        <Text style={[theme.type.label, { color: theme.colors.textFaint }]}>
          {t('game.tapToScore')}
        </Text>
      </View>

      <View style={styles.playerList}>
        {activeGame.players.map((player) => (
          <PlayerScoreCard
            key={player.id}
            player={player}
            selected={player.id === selectedPlayer?.id}
            isLeader={leader?.id === player.id}
            onPress={() => {
              if (player.id !== selectedPlayer?.id) haptics.selection();
              setSelectedPlayerId(player.id);
            }}
            pulseKey={pulse.key}
            lastDelta={pulse.delta}
          />
        ))}
      </View>

      {/* Quick scoring, applied to the selected player */}
      <View style={styles.section}>
        <SectionLabel>{selectedPlayer?.name ?? t('common.player')}</SectionLabel>
      </View>
      <View style={styles.pillGrid}>
        {activeGame.quickButtons.map((delta, i) => (
          <ScorePill
            key={`${delta}-${i}`}
            label={delta > 0 ? `+${delta}` : `${delta}`}
            onPress={() => score(delta)}
            variant={delta >= 0 ? 'positive' : 'negative'}
          />
        ))}
        <ScorePill
          label={t('game.custom')}
          onPress={() => {
            haptics.tap();
            setCustomVisible(true);
          }}
          variant="neutral"
        />
      </View>

      {/* Secondary actions */}
      <View style={styles.actionRow}>
        <Pressable3D
          onPress={() => {
            haptics.tap();
            undoLastRound();
          }}
          disabled={activeGame.rounds.length === 0}
          accessibilityLabel={t('game.undo')}
          style={[styles.actionSlot, { opacity: activeGame.rounds.length === 0 ? 0.4 : 1 }]}
        >
          <Card style={styles.actionInner}>
            <Undo2 size={18} color={theme.colors.text} />
            <Text style={[theme.type.label, { color: theme.colors.text }]}>
              {t('game.undo')}
            </Text>
          </Card>
        </Pressable3D>

        <GradientButton
          label={t('game.announce')}
          onPress={announce}
          height={52}
          icon={<Volume2 size={18} color={theme.colors.primaryText} />}
          style={styles.actionSlot}
          textStyle={styles.actionButtonText}
        />
      </View>

      <View style={[styles.section, styles.historyHeading]}>
        <SectionLabel>{t('game.history')}</SectionLabel>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
        >
          <ChevronLeft size={26} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <Text
          style={[theme.type.heading, styles.topBarTitle, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {t(activeGame.templateNameKey)}
        </Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={confirmDiscard}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityLabel={t('session.discard')}
            accessibilityRole="button"
          >
            <Trash2 size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmEnd}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityLabel={t('game.endGame')}
            accessibilityRole="button"
          >
            <Flag size={21} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={[...activeGame.rounds].reverse()}
        keyExtractor={(r) => r.id}
        renderItem={renderRound}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[theme.type.body, styles.emptyHistory, { color: theme.colors.textFaint }]}>
            {t('game.noRounds')}
          </Text>
        }
      />

      {/* Custom points modal */}
      <Modal
        visible={customVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <Card elevated style={styles.modalCard}>
            <Text style={[theme.type.title, { color: theme.colors.text }]}>
              {t('game.customPoints')}
            </Text>
            <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
              {selectedPlayer?.name}
            </Text>
            <TextInput
              value={customValue}
              onChangeText={setCustomValue}
              keyboardType="numbers-and-punctuation"
              autoFocus
              placeholder="0"
              placeholderTextColor={theme.colors.textFaint}
              style={[
                styles.modalInput,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.borderStrong,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderRadius: theme.radii.md,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable3D
                onPress={() => {
                  setCustomValue('');
                  setCustomVisible(false);
                }}
                accessibilityLabel={t('common.cancel')}
                style={styles.modalButtonSlot}
              >
                <View
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: theme.colors.surfaceAlt,
                      borderRadius: theme.radii.md,
                    },
                  ]}
                >
                  <Text style={[theme.type.heading, { color: theme.colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </View>
              </Pressable3D>
              <GradientButton
                label={t('game.apply')}
                onPress={submitCustom}
                height={50}
                style={styles.modalButtonSlot}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  topBarTitle: { flex: 1, textAlign: 'center' },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  listContent: { paddingBottom: 28 },
  headerBlock: { gap: 12 },
  section: { paddingHorizontal: 16, gap: 2, marginTop: 6 },
  historyHeading: { marginTop: 18, marginBottom: 2 },
  playerList: { paddingHorizontal: 16, gap: 10 },
  rulesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 4 },
  actionSlot: { flex: 1, height: 52 },
  actionInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: { fontSize: 15 },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  roundPlayer: { flex: 1 },
  roundDelta: { fontSize: 16, fontWeight: '800', minWidth: 52, textAlign: 'right' },
  roundResult: { minWidth: 60, textAlign: 'right' },
  emptyHistory: { textAlign: 'center', marginTop: 20 },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', padding: 20, gap: 12 },
  modalInput: {
    height: 58,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalButtonSlot: { flex: 1, height: 50 },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
