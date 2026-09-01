import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Crown,
  ExternalLink,
  Globe,
  RotateCcw,
  Trophy,
  User,
  Users,
} from 'lucide-react-native';

import { RootStackParamList } from '../navigation';
import ScreenHeader from '../components/ScreenHeader';
import { Avatar, Card, GradientButton, SectionLabel } from '../components/ui';
import { useTheme } from '../theme';
import { useGame, FREE_PLAYER_LIMIT } from '../context/GameContext';
import { DISPLAY_NAME_MAX_LENGTH } from '../utils/persistence';
import * as haptics from '../utils/haptics';
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  getLanguageOverride,
  resetToDeviceLanguage,
  setAppLanguage,
  type SupportedLanguage,
} from '../i18n';
import { isMockMode, restorePurchases } from '../services/purchaseService';
import { track } from '../services/analyticsService';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/**
 * Deep links to the store's own subscription management. Both stores require
 * that cancellation is reachable from inside the app, and neither lets an app
 * cancel on the user's behalf — the only correct action is to hand them off.
 */
const MANAGE_SUBSCRIPTION_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  default: 'https://play.google.com/store/account/subscriptions',
});

export default function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { displayName, setDisplayName, isPro, unlockPro, stats } = useGame();

  // Editing is local so every keystroke is not trimmed and written to storage;
  // the context (and AsyncStorage) take the value on blur.
  const [nameDraft, setNameDraft] = useState(displayName);
  // `getLanguageOverride()` is a plain module value, so the selection is
  // mirrored here to drive re-rendering when the user picks a language.
  const [override, setOverride] = useState<SupportedLanguage | null>(getLanguageOverride);
  const [restoring, setRestoring] = useState(false);

  const commitName = () => setDisplayName(nameDraft);

  const chooseLanguage = async (lang: SupportedLanguage | null) => {
    const alreadyActive = override === lang;
    if (!alreadyActive) haptics.selection();
    setOverride(lang);
    if (lang === null) await resetToDeviceLanguage();
    else await setAppLanguage(lang);
  };

  const handleRestore = async () => {
    haptics.tap();
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);

    track({ name: 'purchases_restored', properties: { isPro: result.isPro, mock: isMockMode() } });

    if (result.error) {
      Alert.alert(t('paywall.purchaseFailedTitle'), result.error);
      return;
    }
    if (result.isPro) {
      unlockPro();
      Alert.alert(t('paywall.restoreDoneTitle'), t('paywall.restoreDoneMessage'));
    } else {
      Alert.alert(t('paywall.restoreNoneTitle'), t('paywall.restoreNoneMessage'));
    }
  };

  const openManageSubscriptions = () => {
    haptics.tap();
    Linking.openURL(MANAGE_SUBSCRIPTION_URL).catch(() => {
      // No browser or store app: the helper text above still tells them where
      // to go by hand, so there is nothing useful to raise here.
    });
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Profile */}
          <SectionRow icon={<User size={14} color={theme.colors.textFaint} />}>
            {t('settings.profile')}
          </SectionRow>
          <Card style={styles.card}>
            <View style={styles.profileRow}>
              <Avatar name={nameDraft.trim() || '?'} seed={nameDraft.trim() || 'me'} size={46} />
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                onBlur={commitName}
                onSubmitEditing={commitName}
                returnKeyType="done"
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                placeholder={t('settings.displayNamePlaceholder')}
                placeholderTextColor={theme.colors.textFaint}
                accessibilityLabel={t('settings.displayName')}
                style={[styles.nameInput, theme.type.body, { color: theme.colors.text }]}
              />
            </View>
            <Text style={[theme.type.caption, styles.hint, { color: theme.colors.textFaint }]}>
              {t('settings.displayNameHint')}
            </Text>
          </Card>

          {/* Subscription */}
          <SectionRow icon={<Crown size={14} color={theme.colors.textFaint} />}>
            {t('settings.subscription')}
          </SectionRow>
          <Card style={styles.card}>
            <View style={styles.tierRow}>
              <View
                style={[
                  styles.tierIcon,
                  {
                    borderRadius: theme.radii.sm,
                    backgroundColor: isPro ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                  },
                ]}
              >
                <Crown
                  size={20}
                  color={isPro ? theme.colors.gold : theme.colors.textMuted}
                  fill={isPro ? theme.colors.gold : 'transparent'}
                />
              </View>
              <View style={styles.flex}>
                <Text style={[theme.type.heading, { color: theme.colors.text }]}>
                  {isPro ? t('settings.tierPro') : t('settings.tierFree')}
                </Text>
                <Text style={[theme.type.label, { color: theme.colors.textMuted }]}>
                  {isPro
                    ? t('settings.tierProHint')
                    : t('settings.tierFreeHint', { count: FREE_PLAYER_LIMIT })}
                </Text>
              </View>
            </View>

            {!isPro ? (
              <GradientButton
                label={t('settings.upgrade')}
                onPress={() => {
                  haptics.tap();
                  navigation.navigate('Paywall', { trigger: 'settings' });
                }}
                height={48}
                icon={<Crown size={18} color={theme.colors.primaryText} />}
              />
            ) : null}

            <TouchableOpacity
              onPress={handleRestore}
              disabled={restoring}
              accessibilityRole="button"
              accessibilityState={{ disabled: restoring }}
              accessibilityLabel={t('settings.restore')}
              style={[
                styles.secondaryButton,
                {
                  borderRadius: theme.radii.md,
                  borderColor: theme.colors.borderStrong,
                  opacity: restoring ? 0.6 : 1,
                },
              ]}
            >
              <RotateCcw size={16} color={theme.colors.text} />
              <Text style={[theme.type.label, { color: theme.colors.text }]}>
                {restoring ? t('paywall.restoring') : t('settings.restore')}
              </Text>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <Text style={[theme.type.label, { color: theme.colors.text }]}>
              {t('settings.manageTitle')}
            </Text>
            <Text style={[theme.type.caption, styles.hint, { color: theme.colors.textFaint }]}>
              {Platform.OS === 'ios' ? t('settings.manageIos') : t('settings.manageAndroid')}
            </Text>
            <TouchableOpacity
              onPress={openManageSubscriptions}
              accessibilityRole="link"
              accessibilityLabel={t('settings.manageOpen')}
              style={styles.linkRow}
            >
              <ExternalLink size={15} color={theme.colors.primary} />
              <Text style={[theme.type.label, { color: theme.colors.primary }]}>
                {t('settings.manageOpen')}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Language */}
          <SectionRow icon={<Globe size={14} color={theme.colors.textFaint} />}>
            {t('settings.language')}
          </SectionRow>
          <Card style={styles.card}>
            <View style={styles.pills}>
              <LanguagePill
                label={t('settings.languageAuto')}
                selected={override === null}
                onPress={() => chooseLanguage(null)}
              />
              {SUPPORTED_LANGUAGES.map((lang) => (
                <LanguagePill
                  key={lang}
                  label={LANGUAGE_LABELS[lang]}
                  selected={override === lang}
                  onPress={() => chooseLanguage(lang)}
                />
              ))}
            </View>
            <Text style={[theme.type.caption, styles.hint, { color: theme.colors.textFaint }]}>
              {t('settings.languageAutoHint')}
            </Text>
          </Card>

          {/* Stats */}
          <SectionRow icon={<Trophy size={14} color={theme.colors.textFaint} />}>
            {t('settings.stats')}
          </SectionRow>
          <View style={styles.statRow}>
            <StatTile
              icon={<Trophy size={18} color={theme.colors.primary} />}
              value={stats.gamesPlayed}
              label={t('settings.statGames')}
            />
            <StatTile
              icon={<Users size={18} color={theme.colors.accent} />}
              value={stats.playersRecorded}
              label={t('settings.statPlayers')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Section heading with a leading glyph, matching the home screen's rhythm. */
function SectionRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      {icon}
      <SectionLabel>{children}</SectionLabel>
    </View>
  );
}

function LanguagePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.pill,
        {
          borderRadius: theme.radii.pill,
          backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text
        style={[
          theme.type.label,
          { color: selected ? theme.colors.primaryText : theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.statTile}>
      {icon}
      <Text style={[theme.type.title, { color: theme.colors.text }]}>{value}</Text>
      <Text
        style={[theme.type.label, styles.statLabel, { color: theme.colors.textMuted }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  card: { padding: 14, gap: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameInput: { flex: 1, height: 44, fontSize: 16, fontWeight: '600' },
  hint: { lineHeight: 16 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderWidth: 1,
  },
  divider: { height: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  statRow: { flexDirection: 'row', gap: 10 },
  statTile: { flex: 1, padding: 14, gap: 4, alignItems: 'flex-start' },
  statLabel: { fontWeight: '500' },
});
