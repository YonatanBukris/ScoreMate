import React from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Trash2 } from 'lucide-react-native';

import { useTheme } from '../theme';
import type { Game } from '../types';
import { relativeTime } from '../utils/time';
import { AvatarStack, Card, Pressable3D } from './ui';
import * as haptics from '../utils/haptics';

/**
 * Picker for the paused sessions. Shown when more than one game is in
 * progress, so the resume banner leads somewhere useful instead of guessing
 * which game the player meant.
 */
export default function ResumeSessionsSheet({
  visible,
  sessions,
  onResume,
  onDiscard,
  onClose,
}: {
  visible: boolean;
  sessions: Game[];
  onResume: (gameId: string) => void;
  onDiscard: (gameId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const confirmDiscard = (game: Game) => {
    haptics.warning();
    Alert.alert(t('session.confirmDiscardTitle'), t('session.confirmDiscardMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('session.discardCta'),
        style: 'destructive',
        onPress: () => onDiscard(game.id),
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        {/* Tapping the dimmed area behind the sheet closes it. */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        />
        <Card
          elevated
          style={[styles.sheet, { borderRadius: theme.radii.xl }, theme.shadows.floating]}
        >
          <View style={styles.headingBlock}>
            <Text style={[theme.type.title, { color: theme.colors.text }]}>
              {t('session.pickerTitle')}
            </Text>
            <Text style={[theme.type.label, { color: theme.colors.textMuted }]}>
              {t('session.pickerSubtitle')}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {sessions.length === 0 ? (
              <Text style={[theme.type.body, styles.empty, { color: theme.colors.textFaint }]}>
                {t('session.empty')}
              </Text>
            ) : (
              sessions.map((game) => (
                <SessionRow
                  key={game.id}
                  game={game}
                  onResume={() => onResume(game.id)}
                  onDiscard={() => confirmDiscard(game)}
                />
              ))
            )}
          </ScrollView>

          <Pressable3D
            onPress={onClose}
            accessibilityLabel={t('common.close')}
            style={styles.closeSlot}
          >
            <View
              style={[
                styles.closeButton,
                { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.lg },
              ]}
            >
              <Text style={[theme.type.heading, { color: theme.colors.text }]}>
                {t('common.close')}
              </Text>
            </View>
          </Pressable3D>
        </Card>
      </View>
    </Modal>
  );
}

/** One paused session: who is playing, when it was last touched, and its fate. */
function SessionRow({
  game,
  onResume,
  onDiscard,
}: {
  game: Game;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const when = relativeTime(game.updatedAt);
  const names = game.players.map((p) => p.name).join(', ');

  return (
    <View style={styles.rowWrap}>
      <Pressable3D
        onPress={onResume}
        accessibilityLabel={t('session.resumeNamed', { name: t(game.templateNameKey) })}
        style={styles.rowSlot}
      >
        <Card style={styles.row}>
          <AvatarStack names={game.players.map((p) => p.name)} size={30} />
          <View style={styles.rowText}>
            <Text style={[theme.type.heading, { color: theme.colors.text }]} numberOfLines={1}>
              {t(game.templateNameKey)}
            </Text>
            <Text
              style={[theme.type.label, { color: theme.colors.textMuted }]}
              numberOfLines={1}
            >
              {names}
            </Text>
            <Text style={[theme.type.caption, { color: theme.colors.textFaint }]}>
              {t(when.key, { count: when.count })}
              {'  ·  '}
              {t('history.roundsPlayed', { count: game.rounds.length })}
            </Text>
          </View>
          <ChevronRight size={18} color={theme.colors.textFaint} />
        </Card>
      </Pressable3D>

      <TouchableOpacity
        onPress={onDiscard}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={t('session.discard')}
        accessibilityRole="button"
        style={styles.rowAction}
      >
        <Trash2 size={18} color={theme.colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  // Capped so a long list still shows the dimmed backdrop above it.
  sheet: { maxHeight: '82%', padding: 20, gap: 14 },
  headingBlock: { gap: 2 },
  list: { gap: 10, paddingBottom: 4 },
  empty: { textAlign: 'center', paddingVertical: 20 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowSlot: { flex: 1, minHeight: 74 },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: { flex: 1, gap: 1 },
  rowAction: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeSlot: { height: 50 },
  closeButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
