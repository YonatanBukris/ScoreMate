import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe, Lock, Unlock } from 'lucide-react-native';

import { useTheme } from '../theme';
import { useGame } from '../context/GameContext';
import * as haptics from '../utils/haptics';
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  setAppLanguage,
  type SupportedLanguage,
} from '../i18n';

/**
 * Testing controls: switch the UI/voice language without touching OS settings,
 * and flip the Pro entitlement to re-trigger the paywall. The Pro toggle is
 * stripped from release builds; the language picker ships to users.
 */
export default function DevBar() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { isPro, unlockPro, resetPro } = useGame();

  // `i18n.language` may carry a region suffix (e.g. "en-GB") we don't ship.
  const active = i18n.language?.split('-')[0] as SupportedLanguage;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.row}>
        <Globe size={16} color={theme.colors.textMuted} />
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          {t('settings.language')}
        </Text>
      </View>

      <View style={styles.pills}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const selected = lang === active;
          return (
            <TouchableOpacity
              key={lang}
              activeOpacity={0.8}
              onPress={() => {
                if (!selected) haptics.selection();
                setAppLanguage(lang);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={LANGUAGE_LABELS[lang]}
              style={[
                styles.pill,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: selected ? theme.colors.primaryText : theme.colors.text },
                ]}
              >
                {LANGUAGE_LABELS[lang]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {__DEV__ ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 14, fontWeight: '600' },
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
