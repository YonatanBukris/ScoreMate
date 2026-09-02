import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  BookmarkPlus,
  CalendarClock,
  ChevronRight,
  Club,
  Crown,
  Dices,
  History as HistoryIcon,
  Play,
  Plus,
  Repeat,
  Settings as SettingsIcon,
  Sliders,
  Spade,
  Target,
  Trophy,
  UserMinus,
  X,
} from 'lucide-react-native';

import { RootStackParamList } from '../navigation';
import DevBar from '../components/DevBar';
import { useTheme } from '../theme';
import {
  useGame,
  FREE_MONTHLY_GAME_LIMIT,
  FREE_PLAYER_LIMIT,
  FREE_PRESET_LIMIT,
} from '../context/GameContext';
import { GAME_TEMPLATES, getTemplate } from '../types/templates';
import type { Game, GameModeType, GamePreset, GameRules, GameTemplate } from '../types';
import { DEFAULT_CUSTOM_RULES, rulesFromTemplate } from '../utils/rules';
import { formatQuickButtons, rulesFromPreset } from '../utils/presets';
import { relativeTime } from '../utils/time';
import CustomRulesSheet from '../components/CustomRulesSheet';
import ResumeSessionsSheet from '../components/ResumeSessionsSheet';
import SavePresetSheet from '../components/SavePresetSheet';
import {
  Avatar,
  AvatarStack,
  Card,
  Chip,
  GradientButton,
  Pressable3D,
  SectionLabel,
} from '../components/ui';
import * as haptics from '../utils/haptics';
import { track } from '../services/analyticsService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const MAX_PLAYERS = 8;

/** One icon per built-in template, so the cards are scannable at a glance. */
const TEMPLATE_ICONS: Record<GameModeType, React.ComponentType<{ size: number; color: string }>> = {
  standard: Dices,
  skat: Spade,
  rummy: Club,
  custom: Sliders,
};

export default function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    activeGames,
    canSaveAnotherPreset,
    canStartGame,
    createGame,
    deletePreset,
    deleteGame,
    displayName,
    gamesRemainingThisMonth,
    gamesThisMonth,
    isPro,
    presets,
    resumeGame,
    savePreset,
  } = useGame();

  const [templateId, setTemplateId] = useState(GAME_TEMPLATES[0].id);
  // Seeded once from the saved profile name, so the player is not retyping
  // their own name every game. Later edits in settings leave a setup already in
  // progress alone rather than overwriting what is on screen.
  const [names, setNames] = useState<string[]>(() => [displayName, '']);
  // Held here rather than on the template so edits survive switching away to
  // another game mode and back again.
  const [customRules, setCustomRules] = useState<GameRules>(DEFAULT_CUSTOM_RULES);
  // A loaded preset carries its own rules, which need not match the template
  // it was built on, so it takes precedence until the setup is changed by hand.
  const [activePreset, setActivePreset] = useState<GamePreset | null>(null);
  const [setupVisible, setSetupVisible] = useState(false);
  const [sessionsVisible, setSessionsVisible] = useState(false);
  const [savePresetVisible, setSavePresetVisible] = useState(false);

  // The banner speaks for the session played most recently.
  const latestSession = activeGames[0] ?? null;
  const hasMultipleSessions = activeGames.length > 1;

  // Discarding the last paused game leaves nothing to pick from.
  useEffect(() => {
    if (sessionsVisible && activeGames.length === 0) setSessionsVisible(false);
  }, [sessionsVisible, activeGames.length]);

  const playerCap = isPro ? MAX_PLAYERS : FREE_PLAYER_LIMIT;

  // Losing Pro (a purchase reset, or the debug toggle) must re-apply the cap,
  // otherwise rows added while unlocked would still start an oversized game.
  useEffect(() => {
    setNames((prev) => (prev.length > playerCap ? prev.slice(0, playerCap) : prev));
  }, [playerCap]);

  const setName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const addPlayer = () => {
    if (names.length >= playerCap) {
      haptics.warning();
      if (!isPro) {
        Alert.alert(
          t('paywall.title'),
          t('home.freePlayerLimit', { count: FREE_PLAYER_LIMIT }),
          [
            { text: t('paywall.maybeLater'), style: 'cancel' },
            {
              text: t('paywall.unlock'),
              onPress: () => navigation.navigate('Paywall', { trigger: 'player_limit' }),
            },
          ]
        );
      }
      return;
    }
    haptics.tap();
    setNames((prev) => [...prev, '']);
  };

  const removePlayer = (index: number) => {
    haptics.tap();
    setNames((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  };

  /** "10m ago" for a session's last activity. */
  const lastPlayed = (game: Game) => {
    const when = relativeTime(game.updatedAt);
    return t(when.key, { count: when.count });
  };

  const openSession = (gameId: string) => {
    haptics.tap();
    resumeGame(gameId);
    setSessionsVisible(false);
    navigation.navigate('Game');
  };

  /**
   * One paused game resumes straight away; several open the picker, since the
   * banner cannot know which of them the player meant.
   */
  const pressResume = () => {
    if (!latestSession) return;
    if (hasMultipleSessions) {
      haptics.tap();
      setSessionsVisible(true);
      return;
    }
    openSession(latestSession.id);
  };

  /** Choosing "Custom" drops straight into its setup sheet. */
  const openCustomSetup = () => {
    haptics.tap();
    setSetupVisible(true);
  };

  const selectTemplate = (id: GameModeType) => {
    if (id !== templateId) haptics.selection();
    setTemplateId(id);
    // Picking a template by hand is the user overriding the loaded preset.
    setActivePreset(null);
    if (id === 'custom') setSetupVisible(true);
  };

  /** The rules the next game will actually be started with. */
  const setupRules: GameRules = useMemo(() => {
    if (activePreset) return rulesFromPreset(activePreset);
    if (templateId === 'custom') return customRules;
    return rulesFromTemplate(getTemplate(templateId));
  }, [activePreset, customRules, templateId]);

  /** The chips a template card shows: the live setup for the selected one. */
  const rulesForCard = (template: GameTemplate): GameRules => {
    if (template.id === templateId) return setupRules;
    return template.id === 'custom' ? customRules : rulesFromTemplate(template);
  };

  /**
   * The monthly quota bites here rather than at the end of a game, so nobody
   * plays a full round of Rummy only to be told it will not be saved.
   */
  const blockedByQuota = (from: 'setup' | 'rematch'): boolean => {
    if (canStartGame) return false;
    haptics.warning();
    track({
      name: 'game_quota_blocked',
      properties: { gamesThisMonth, limit: FREE_MONTHLY_GAME_LIMIT, from },
    });
    Alert.alert(
      t('quota.limitTitle'),
      t('quota.limitMessage', { count: FREE_MONTHLY_GAME_LIMIT }),
      [
        { text: t('paywall.maybeLater'), style: 'cancel' },
        {
          text: t('paywall.unlock'),
          onPress: () => navigation.navigate('Paywall', { trigger: 'game_quota' }),
        },
      ]
    );
    return true;
  };

  const startGame = () => {
    const filled = names.map((n, i) => n.trim() || t('home.playerNamePlaceholder', { number: i + 1 }));
    if (filled.length < 2) {
      haptics.warning();
      Alert.alert(t('app.title'), t('home.needTwoPlayers'));
      return;
    }
    if (blockedByQuota('setup')) return;
    haptics.success();
    createGame({ templateId, playerNames: filled, rules: setupRules });
    navigation.navigate('Game');
  };

  /** One tap restores a saved setup: rules, template and the table with it. */
  const loadPreset = (preset: GamePreset) => {
    haptics.success();
    const rules = rulesFromPreset(preset);
    setTemplateId(preset.templateId);
    setActivePreset(preset);
    // The custom card and its setup sheet both read `customRules`, so a preset
    // built on the custom template shows up there too.
    if (preset.templateId === 'custom') setCustomRules(rules);
    // A preset saved before the player cap changed must not reintroduce seats
    // the current tier cannot start a game with.
    if (preset.playerNames.length >= 2) setNames(preset.playerNames.slice(0, playerCap));
    track({ name: 'preset_loaded', properties: { templateId: preset.templateId } });
  };

  const confirmDeletePreset = (preset: GamePreset) => {
    haptics.warning();
    Alert.alert(
      t('presets.confirmDeleteTitle'),
      t('presets.confirmDeleteMessage', { name: preset.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deletePreset(preset.id);
            track({ name: 'preset_deleted', properties: { templateId: preset.templateId } });
          },
        },
      ]
    );
  };

  /**
   * The sheet opens even when the tier's slots are full, because saving over an
   * existing name is a replacement rather than a new preset — the free plan's
   * single slot has to stay editable. The tier check happens on save.
   */
  const handleSavePreset = (name: string) => {
    const result = savePreset({ name, templateId, rules: setupRules, playerNames: names });
    setSavePresetVisible(false);

    if (result.status === 'saved') {
      haptics.success();
      // Keep the just-saved preset selected, so the card reads as the setup.
      setActivePreset(result.preset);
      track({
        name: 'preset_saved',
        properties: {
          templateId: result.preset.templateId,
          playerCount: result.preset.playerNames.length,
          presetCount: presets.length,
        },
      });
      return;
    }
    if (result.status === 'limit') {
      haptics.warning();
      Alert.alert(
        t('presets.limitTitle'),
        t('presets.limitMessage', { count: FREE_PRESET_LIMIT }),
        [
          { text: t('paywall.maybeLater'), style: 'cancel' },
          {
            text: t('paywall.unlock'),
            onPress: () => navigation.navigate('Paywall', { trigger: 'preset_limit' }),
          },
        ]
      );
    }
    // 'invalid' cannot reach here: the sheet disables Save on an empty name.
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Masthead */}
          <View style={styles.titleRow}>
            <LinearGradient
              colors={[theme.gradients.primary[0], theme.gradients.primary[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.logo, { borderRadius: theme.radii.md }, theme.shadows.raised]}
            >
              <Trophy size={24} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.flex}>
              <Text
                style={[theme.type.title, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {t('app.title')}
              </Text>
              <Text
                style={[theme.type.label, { color: theme.colors.textMuted }]}
                numberOfLines={1}
              >
                {t('app.tagline')}
              </Text>
            </View>
            <Pressable3D
              onPress={() => {
                haptics.tap();
                navigation.navigate('Settings');
              }}
              accessibilityLabel={t('settings.title')}
              style={styles.iconButtonSlot}
            >
              <Card style={styles.iconButton}>
                <SettingsIcon size={20} color={theme.colors.textMuted} />
              </Card>
            </Pressable3D>
            <Pressable3D
              onPress={() => {
                haptics.tap();
                navigation.navigate('History');
              }}
              accessibilityLabel={t('home.viewHistory')}
              style={styles.iconButtonSlot}
            >
              <Card style={styles.iconButton}>
                <HistoryIcon size={20} color={theme.colors.textMuted} />
              </Card>
            </Pressable3D>
          </View>

          <DevBar />

          {/* Pro banner */}
          {!isPro ? (
            <Pressable3D
              onPress={() => {
                haptics.tap();
                navigation.navigate('Paywall', { trigger: 'banner' });
              }}
              accessibilityLabel={t('paywall.bannerTitle')}
              style={[styles.proBannerSlot, theme.shadows.raised]}
            >
              <LinearGradient
                colors={[theme.gradients.primary[0], theme.gradients.primary[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.proBanner, { borderRadius: theme.radii.lg }]}
              >
                <View style={styles.proIcon}>
                  <Crown size={22} color={theme.colors.gold} fill={theme.colors.gold} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.proTitle, { color: theme.colors.primaryText }]}>
                    {t('paywall.bannerTitle')}
                  </Text>
                  <Text style={[styles.proSubtitle, { color: theme.colors.primaryText }]}>
                    {t('paywall.bannerSubtitle')}
                  </Text>
                </View>
                <ChevronRight size={20} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            </Pressable3D>
          ) : null}

          {/* Resume a paused session */}
          {latestSession ? (
            <Pressable3D
              onPress={pressResume}
              accessibilityLabel={t('home.resumeTitle')}
              style={styles.resumeSlot}
            >
              <Card glowColor={theme.colors.success} style={styles.resumeCard}>
                <View style={[styles.resumeIcon, { backgroundColor: theme.colors.success }]}>
                  <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                </View>
                <View style={styles.flex}>
                  <Text style={[theme.type.heading, { color: theme.colors.text }]}>
                    {hasMultipleSessions ? t('session.pickerTitle') : t('home.resumeTitle')}
                  </Text>
                  <Text
                    style={[theme.type.label, { color: theme.colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {hasMultipleSessions
                      ? t('session.inProgress', { count: activeGames.length })
                      : `${t('home.resumeSubtitle', {
                          count: latestSession.players.length,
                        })}  ·  ${lastPlayed(latestSession)}`}
                  </Text>
                </View>
                <AvatarStack names={latestSession.players.map((p) => p.name)} size={28} />
              </Card>
            </Pressable3D>
          ) : null}

          {/* Template selector */}
          <View style={styles.sectionHead}>
            <SectionLabel>{t('home.selectTemplate')}</SectionLabel>
            {/* The quota only means something while it can run out. */}
            {gamesRemainingThisMonth !== null ? (
              <Chip
                label={t('quota.remainingShort', {
                  remaining: gamesRemainingThisMonth,
                  limit: FREE_MONTHLY_GAME_LIMIT,
                })}
                color={
                  gamesRemainingThisMonth === 0 ? theme.colors.danger : theme.colors.textMuted
                }
                icon={
                  <CalendarClock
                    size={10}
                    color={
                      gamesRemainingThisMonth === 0 ? theme.colors.danger : theme.colors.textMuted
                    }
                  />
                }
              />
            ) : null}
          </View>
          <View style={styles.templateGrid}>
            {GAME_TEMPLATES.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                rules={rulesForCard(tpl)}
                selected={tpl.id === templateId}
                onPress={() => selectTemplate(tpl.id)}
              />
            ))}
          </View>

          {/* Custom rules summary, with a way back into the setup sheet */}
          {templateId === 'custom' ? (
            <Pressable3D
              onPress={openCustomSetup}
              accessibilityLabel={t('customSetup.edit')}
              style={styles.customSummarySlot}
            >
              <Card style={styles.customSummary}>
                <View
                  style={[
                    styles.customSummaryIcon,
                    {
                      borderRadius: theme.radii.sm,
                      backgroundColor: theme.colors.primarySoft,
                    },
                  ]}
                >
                  <Sliders size={16} color={theme.colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={[theme.type.label, { color: theme.colors.text }]}>
                    {t('customSetup.edit')}
                  </Text>
                  <Text
                    style={[theme.type.caption, { color: theme.colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {formatQuickButtons(setupRules.quickButtons)}
                  </Text>
                </View>
                <ChevronRight size={18} color={theme.colors.textFaint} />
              </Card>
            </Pressable3D>
          ) : null}

          {/* Saved presets */}
          <View style={styles.sectionHead}>
            <SectionLabel>{t('presets.title')}</SectionLabel>
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                setSavePresetVisible(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('presets.save')}
              style={styles.savePresetButton}
            >
              <BookmarkPlus size={14} color={theme.colors.primary} />
              <Text style={[theme.type.label, { color: theme.colors.primary }]}>
                {t('presets.save')}
              </Text>
            </TouchableOpacity>
          </View>

          {presets.length === 0 ? (
            <Text style={[theme.type.caption, styles.presetsEmpty, { color: theme.colors.textFaint }]}>
              {t('presets.empty')}
            </Text>
          ) : (
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRow}
            >
              {presets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  selected={preset.id === activePreset?.id}
                  onPress={() => loadPreset(preset)}
                  onDelete={() => confirmDeletePreset(preset)}
                />
              ))}
            </ScrollView>
          )}

          {/* Players */}
          <View style={styles.sectionHead}>
            <SectionLabel>{t('common.players')}</SectionLabel>
            <Text style={[theme.type.label, { color: theme.colors.textFaint }]}>
              {names.length}/{playerCap}
            </Text>
          </View>

          {names.map((name, index) => (
            <Card key={index} style={styles.playerRow}>
              <Avatar
                name={name.trim() || `${index + 1}`}
                seed={`slot-${index}`}
                size={36}
              />
              <TextInput
                value={name}
                onChangeText={(v) => setName(index, v)}
                placeholder={t('home.playerNamePlaceholder', { number: index + 1 })}
                placeholderTextColor={theme.colors.textFaint}
                style={[styles.playerInput, theme.type.body, { color: theme.colors.text }]}
              />
              {names.length > 2 ? (
                <TouchableOpacity
                  onPress={() => removePlayer(index)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={t('home.removePlayer')}
                  accessibilityRole="button"
                >
                  <UserMinus size={20} color={theme.colors.danger} />
                </TouchableOpacity>
              ) : null}
            </Card>
          ))}

          <Pressable3D
            onPress={addPlayer}
            accessibilityLabel={t('home.addPlayer')}
            style={styles.addPlayerSlot}
          >
            <View
              style={[
                styles.addPlayer,
                { borderColor: theme.colors.borderStrong, borderRadius: theme.radii.lg },
              ]}
            >
              <Plus size={18} color={theme.colors.primary} />
              <Text style={[theme.type.label, { color: theme.colors.primary }]}>
                {t('home.addPlayer')}
              </Text>
            </View>
          </Pressable3D>
        </ScrollView>

        {/* Floating action bar: the primary CTA stays reachable while scrolling. */}
        <View style={styles.fabBar} pointerEvents="box-none">
          <LinearGradient
            colors={['transparent', theme.colors.background]}
            style={styles.fabFade}
            pointerEvents="none"
          />
          <GradientButton
            label={t('home.startGame')}
            onPress={startGame}
            height={58}
            icon={<Play size={20} color={theme.colors.primaryText} fill={theme.colors.primaryText} />}
            style={[styles.fab, theme.shadows.floating]}
          />
        </View>
      </KeyboardAvoidingView>

      <ResumeSessionsSheet
        visible={sessionsVisible}
        sessions={activeGames}
        onResume={openSession}
        onDiscard={deleteGame}
        onClose={() => setSessionsVisible(false)}
      />

      <CustomRulesSheet
        visible={setupVisible}
        rules={setupRules}
        onCancel={() => setSetupVisible(false)}
        onSave={(next) => {
          setCustomRules(next);
          // Hand-edited rules are no longer the preset's, whatever it held.
          setActivePreset(null);
          setSetupVisible(false);
        }}
      />

      <SavePresetSheet
        visible={savePresetVisible}
        existingNames={presets.map((p) => p.name)}
        suggestedName={t(getTemplate(templateId).nameKey)}
        limitHint={
          canSaveAnotherPreset ? null : t('presets.freeLimitHint', { count: FREE_PRESET_LIMIT })
        }
        onCancel={() => setSavePresetVisible(false)}
        onSave={handleSavePreset}
      />
    </SafeAreaView>
  );
}

/**
 * Segmented template card: icon, name, description and rule chips. The chips
 * read from `rules` rather than the template, so the custom card reflects the
 * settings the user has actually configured.
 */
function TemplateCard({
  template,
  rules,
  selected,
  onPress,
}: {
  template: GameTemplate;
  rules: GameRules;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const Icon = TEMPLATE_ICONS[template.id];
  const highest = rules.winCondition === 'highest';
  const WinIcon = highest ? ArrowUp : ArrowDown;

  return (
    <Pressable3D
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t(template.nameKey)}
      style={styles.templateSlot}
    >
      <Card
        elevated={selected}
        style={[
          styles.templateCard,
          selected ? { borderColor: theme.colors.primary, borderWidth: 2 } : null,
        ]}
      >
        <View
          style={[
            styles.templateIcon,
            {
              borderRadius: theme.radii.sm,
              backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt,
            },
          ]}
        >
          <Icon size={18} color={selected ? theme.colors.primaryText : theme.colors.textMuted} />
        </View>

        <Text style={[theme.type.heading, { color: theme.colors.text }]} numberOfLines={1}>
          {t(template.nameKey)}
        </Text>
        <Text
          style={[theme.type.label, styles.templateDesc, { color: theme.colors.textMuted }]}
          numberOfLines={2}
        >
          {t(template.descriptionKey)}
        </Text>

        <View style={styles.templateChips}>
          <Chip
            label={highest ? t('template.highestWins') : t('template.lowestWins')}
            color={highest ? theme.colors.success : theme.colors.primary}
            icon={
              <WinIcon size={10} color={highest ? theme.colors.success : theme.colors.primary} />
            }
          />
          {rules.targetScore ? (
            <Chip
              label={t('template.targetScore', { score: rules.targetScore })}
              color={theme.colors.accent}
              icon={<Target size={10} color={theme.colors.accent} />}
            />
          ) : null}
          {rules.maxRounds ? (
            <Chip
              label={t('template.maxRounds', { count: rules.maxRounds })}
              color={theme.colors.accent}
              icon={<Repeat size={10} color={theme.colors.accent} />}
            />
          ) : null}
        </View>
      </Card>
    </Pressable3D>
  );
}

/**
 * One saved setup. Tapping it loads the whole configuration; the delete button
 * is a sibling of the pressable rather than a child of it, so the two touch
 * targets cannot fight over the same gesture.
 */
function PresetCard({
  preset,
  selected,
  onPress,
  onDelete,
}: {
  preset: GamePreset;
  selected: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.presetSlot}>
      <Pressable3D
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={t('presets.loadNamed', { name: preset.name })}
        style={styles.flex}
      >
        <Card
          elevated={selected}
          style={[
            styles.presetCard,
            selected ? { borderColor: theme.colors.primary, borderWidth: 2 } : null,
          ]}
        >
          <View style={styles.presetTop}>
            <Bookmark
              size={13}
              color={theme.colors.primary}
              fill={selected ? theme.colors.primary : 'transparent'}
            />
            <Text
              style={[theme.type.label, styles.flex, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {preset.name}
            </Text>
          </View>
          <Text
            style={[theme.type.caption, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {formatQuickButtons(preset.quickButtons)}
          </Text>
          <Text
            style={[theme.type.caption, styles.presetMeta, { color: theme.colors.textFaint }]}
            numberOfLines={1}
          >
            {t(getTemplate(preset.templateId).nameKey)}
            {'  ·  '}
            {t('presets.slots', { players: preset.playerNames.length })}
          </Text>
        </Card>
      </Pressable3D>

      <TouchableOpacity
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('presets.delete')}
        style={styles.presetDelete}
      >
        <X size={13} color={theme.colors.textFaint} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  iconButtonSlot: { width: 42, height: 42 },
  iconButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  proBannerSlot: { height: 74 },
  proBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  proIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  proTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  proSubtitle: { fontSize: 12, fontWeight: '500', opacity: 0.9, marginTop: 1 },
  resumeSlot: { height: 72 },
  resumeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  resumeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  templateSlot: { width: '48%', minHeight: 152 },
  templateCard: { flex: 1, padding: 12, gap: 6 },
  templateIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  templateDesc: { fontWeight: '500' },
  templateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 'auto' },
  savePresetButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  presetsEmpty: { fontWeight: '500', paddingVertical: 2 },
  // Padded on the right so the last card is not flush against the screen edge.
  presetRow: { gap: 10, paddingRight: 4, paddingVertical: 2 },
  presetSlot: { width: 168, height: 88 },
  presetCard: { flex: 1, padding: 10, paddingRight: 26, gap: 3 },
  presetTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  presetMeta: { marginTop: 'auto' },
  presetDelete: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSummarySlot: { height: 58 },
  customSummary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  customSummaryIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  playerInput: { flex: 1, height: 42, fontSize: 16, fontWeight: '600' },
  addPlayerSlot: { height: 50 },
  addPlayer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  fabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    paddingBottom: 20,
    justifyContent: 'flex-end',
  },
  fabFade: {
    position: 'absolute',
    left: -16,
    right: -16,
    bottom: 0,
    height: 110,
  },
  fab: { width: '100%', height: 58 },
});
