import React from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Crown, Trash2 } from 'lucide-react-native';

import { RootStackParamList } from '../navigation';
import { useTheme } from '../theme';
import { useGame, getLeader } from '../context/GameContext';
import ScreenHeader from '../components/ScreenHeader';
import { Game } from '../types';
import { getSpeechLocale } from '../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { completedGames, deleteGame, clearHistory } = useGame();

  const formatDate = (ts?: number) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString(getSpeechLocale(), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return new Date(ts).toLocaleDateString();
    }
  };

  const confirmDelete = (game: Game) => {
    Alert.alert(t('history.confirmDeleteTitle'), t('history.confirmDeleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteGame(game.id) },
    ]);
  };

  const confirmClearAll = () => {
    Alert.alert(t('history.confirmDeleteTitle'), t('history.confirmDeleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('history.clearAll'), style: 'destructive', onPress: () => clearHistory() },
    ]);
  };

  const renderItem = ({ item }: { item: Game }) => {
    const winner = getLeader(item.players, item.winCondition);
    const standings = [...item.players].sort((a, b) =>
      item.winCondition === 'highest' ? b.score - a.score : a.score - b.score
    );
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              {t(item.templateNameKey)}
            </Text>
            <Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
              {t('history.playedOn', { date: formatDate(item.completedAt ?? item.createdAt) })}
              {'  ·  '}
              {t('history.roundsPlayed', { count: item.rounds.length })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => confirmDelete(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={20} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={[styles.winnerRow, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Crown size={16} color={theme.colors.accent} />
          <Text style={[styles.winnerText, { color: theme.colors.text }]}>
            {winner ? t('history.winner', { name: winner.name }) : t('history.noWinner')}
          </Text>
        </View>

        {standings.map((p, index) => (
          <View key={p.id} style={styles.standingRow}>
            <Text style={[styles.standingRank, { color: theme.colors.textMuted }]}>
              {index + 1}.
            </Text>
            <Text style={[styles.standingName, { color: theme.colors.text }]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={[styles.standingScore, { color: theme.colors.text }]}>{p.score}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScreenHeader
        title={t('history.title')}
        onBack={() => navigation.goBack()}
        right={
          completedGames.length > 0 ? (
            <TouchableOpacity onPress={confirmClearAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.clearAll, { color: theme.colors.danger }]}>
                {t('history.clearAll')}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <FlatList
        // Re-render dates when language changes.
        extraData={i18n.language}
        data={completedGames}
        keyExtractor={(g) => g.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
            {t('history.empty')}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: 16, gap: 14 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardMeta: { fontSize: 12, marginTop: 4 },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  winnerText: { fontSize: 14, fontWeight: '700' },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  standingRank: { fontSize: 14, width: 24, fontWeight: '700' },
  standingName: { flex: 1, fontSize: 15 },
  standingScore: { fontSize: 15, fontWeight: '700' },
  clearAll: { fontSize: 14, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
});
