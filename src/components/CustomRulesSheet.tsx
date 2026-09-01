import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, RotateCcw, Sliders } from 'lucide-react-native';

import { useTheme } from '../theme';
import type { GameRules, WinCondition } from '../types';
import {
  DEFAULT_CUSTOM_RULES,
  MAX_ROUNDS,
  MAX_TARGET_SCORE,
  QUICK_BUTTON_SLOTS,
  parseLimit,
  parseQuickButton,
} from '../utils/rules';
import { Card, GradientButton, Pressable3D, SectionLabel } from './ui';
import * as haptics from '../utils/haptics';

/** Optional limits are edited as text; an empty field means "no limit". */
function limitToText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

/**
 * Setup sheet for a custom game: the four quick point buttons, which direction
 * wins, and the optional limits that end the game on their own. Edits are held
 * locally and only handed back on save, so cancelling leaves the previously
 * configured rules untouched.
 */
export default function CustomRulesSheet({
  visible,
  rules,
  onCancel,
  onSave,
}: {
  visible: boolean;
  rules: GameRules;
  onCancel: () => void;
  onSave: (rules: GameRules) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [winCondition, setWinCondition] = useState<WinCondition>(rules.winCondition);
  const [quickText, setQuickText] = useState<string[]>(() =>
    rules.quickButtons.map((v) => String(v))
  );
  const [targetText, setTargetText] = useState(limitToText(rules.targetScore));
  const [roundsText, setRoundsText] = useState(limitToText(rules.maxRounds));

  // Reopening the sheet must show what is actually configured, not whatever
  // was left behind by the last editing session.
  useEffect(() => {
    if (!visible) return;
    setWinCondition(rules.winCondition);
    setQuickText(rules.quickButtons.map((v) => String(v)));
    setTargetText(limitToText(rules.targetScore));
    setRoundsText(limitToText(rules.maxRounds));
  }, [visible, rules]);

  const setQuick = (index: number, value: string) => {
    setQuickText((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const resetDefaults = () => {
    haptics.tap();
    setWinCondition(DEFAULT_CUSTOM_RULES.winCondition);
    setQuickText(DEFAULT_CUSTOM_RULES.quickButtons.map((v) => String(v)));
    setTargetText('');
    setRoundsText('');
  };

  const save = () => {
    // A blank or zero field keeps its previous value rather than dropping a
    // button, so the scoreboard always has the full set of quick actions.
    const quickButtons = Array.from({ length: QUICK_BUTTON_SLOTS }, (_, i) => {
      const parsed = parseQuickButton(quickText[i] ?? '');
      return parsed ?? rules.quickButtons[i] ?? DEFAULT_CUSTOM_RULES.quickButtons[i];
    });
    haptics.success();
    onSave({
      winCondition,
      quickButtons,
      targetScore: parseLimit(targetText, MAX_TARGET_SCORE),
      maxRounds: parseLimit(roundsText, MAX_ROUNDS),
    });
  };

  const cancel = () => {
    haptics.tap();
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
          <Card
            elevated
            style={[styles.sheet, { borderRadius: theme.radii.xl }, theme.shadows.floating]}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Heading */}
              <View style={styles.heading}>
                <View
                  style={[
                    styles.headingIcon,
                    { backgroundColor: theme.colors.primary, borderRadius: theme.radii.sm },
                  ]}
                >
                  <Sliders size={18} color={theme.colors.primaryText} />
                </View>
                <View style={styles.flex}>
                  <Text style={[theme.type.title, { color: theme.colors.text }]}>
                    {t('customSetup.title')}
                  </Text>
                  <Text style={[theme.type.label, { color: theme.colors.textMuted }]}>
                    {t('customSetup.subtitle')}
                  </Text>
                </View>
              </View>

              {/* Win condition */}
              <View style={styles.block}>
                <SectionLabel>{t('customSetup.winCondition')}</SectionLabel>
                <Text style={[theme.type.label, styles.hint, { color: theme.colors.textFaint }]}>
                  {t('customSetup.winConditionHint')}
                </Text>
                <View style={styles.segmented}>
                  <WinOption
                    label={t('template.highestWins')}
                    icon={ArrowUp}
                    tint={theme.colors.success}
                    selected={winCondition === 'highest'}
                    onPress={() => {
                      if (winCondition !== 'highest') haptics.selection();
                      setWinCondition('highest');
                    }}
                  />
                  <WinOption
                    label={t('template.lowestWins')}
                    icon={ArrowDown}
                    tint={theme.colors.primary}
                    selected={winCondition === 'lowest'}
                    onPress={() => {
                      if (winCondition !== 'lowest') haptics.selection();
                      setWinCondition('lowest');
                    }}
                  />
                </View>
              </View>

              {/* Quick point buttons */}
              <View style={styles.block}>
                <SectionLabel>{t('customSetup.quickButtons')}</SectionLabel>
                <Text style={[theme.type.label, styles.hint, { color: theme.colors.textFaint }]}>
                  {t('customSetup.quickButtonsHint')}
                </Text>
                <View style={styles.quickGrid}>
                  {Array.from({ length: QUICK_BUTTON_SLOTS }, (_, index) => {
                    const value = quickText[index] ?? '';
                    const parsed = parseQuickButton(value);
                    const tint =
                      parsed === null
                        ? theme.colors.textFaint
                        : parsed > 0
                          ? theme.colors.success
                          : theme.colors.danger;
                    return (
                      <View key={index} style={styles.quickSlot}>
                        <Text style={[theme.type.caption, { color: theme.colors.textFaint }]}>
                          {t('customSetup.buttonNumber', { number: index + 1 })}
                        </Text>
                        <TextInput
                          value={value}
                          onChangeText={(v) => setQuick(index, v)}
                          keyboardType="numbers-and-punctuation"
                          selectTextOnFocus
                          maxLength={5}
                          accessibilityLabel={t('customSetup.buttonNumber', { number: index + 1 })}
                          placeholder="0"
                          placeholderTextColor={theme.colors.textFaint}
                          style={[
                            styles.quickInput,
                            {
                              color: tint,
                              borderColor: theme.colors.borderStrong,
                              backgroundColor: theme.colors.surfaceAlt,
                              borderRadius: theme.radii.md,
                            },
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Optional limits */}
              <View style={styles.block}>
                <SectionLabel>{t('customSetup.limits')}</SectionLabel>
                <Text style={[theme.type.label, styles.hint, { color: theme.colors.textFaint }]}>
                  {t('customSetup.limitsHint')}
                </Text>

                <LimitField
                  label={t('customSetup.targetScore')}
                  hint={t('customSetup.targetScoreHint')}
                  value={targetText}
                  onChangeText={setTargetText}
                  placeholder={t('customSetup.noLimit')}
                />
                <LimitField
                  label={t('customSetup.maxRounds')}
                  hint={t('customSetup.maxRoundsHint')}
                  value={roundsText}
                  onChangeText={setRoundsText}
                  placeholder={t('customSetup.noLimit')}
                />
              </View>

              {/* Actions */}
              <Pressable3D
                onPress={resetDefaults}
                accessibilityLabel={t('customSetup.reset')}
                style={styles.resetSlot}
              >
                <View style={styles.reset}>
                  <RotateCcw size={15} color={theme.colors.textMuted} />
                  <Text style={[theme.type.label, { color: theme.colors.textMuted }]}>
                    {t('customSetup.reset')}
                  </Text>
                </View>
              </Pressable3D>

              <View style={styles.actions}>
                <Pressable3D
                  onPress={cancel}
                  accessibilityLabel={t('common.cancel')}
                  style={styles.actionSlot}
                >
                  <View
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: theme.colors.surfaceAlt,
                        borderRadius: theme.radii.lg,
                      },
                    ]}
                  >
                    <Text style={[theme.type.heading, { color: theme.colors.text }]}>
                      {t('common.cancel')}
                    </Text>
                  </View>
                </Pressable3D>
                <GradientButton
                  label={t('customSetup.save')}
                  onPress={save}
                  height={52}
                  style={styles.actionSlot}
                />
              </View>
            </ScrollView>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** One half of the win-condition segmented control. */
function WinOption({
  label,
  icon: Icon,
  tint,
  selected,
  onPress,
}: {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  tint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable3D
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.segmentSlot}
    >
      <View
        style={[
          styles.segment,
          {
            borderRadius: theme.radii.md,
            borderWidth: selected ? 2 : 1,
            borderColor: selected ? tint : theme.colors.border,
            backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surfaceAlt,
          },
        ]}
      >
        <Icon size={18} color={selected ? tint : theme.colors.textMuted} />
        <Text
          style={[
            theme.type.label,
            { color: selected ? theme.colors.text : theme.colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable3D>
  );
}

/** Labelled optional number field; blank means the limit is off. */
function LimitField({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.limitRow}>
      <View style={styles.flex}>
        <Text style={[theme.type.body, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[theme.type.caption, { color: theme.colors.textFaint }]}>{hint}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        selectTextOnFocus
        maxLength={6}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        style={[
          styles.limitInput,
          {
            color: theme.colors.text,
            borderColor: theme.colors.borderStrong,
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radii.md,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  // Capped so the sheet keeps a slice of the overlay visible on small screens.
  sheet: { maxHeight: '92%' },
  content: { padding: 20, paddingBottom: 24, gap: 18 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  block: { gap: 6 },
  hint: { fontWeight: '500' },
  segmented: { flexDirection: 'row', gap: 10, marginTop: 4 },
  segmentSlot: { flex: 1, height: 52 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  quickSlot: { width: '47%', flexGrow: 1, gap: 4 },
  quickInput: {
    height: 54,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  limitInput: {
    width: 104,
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  resetSlot: { height: 34, alignSelf: 'center' },
  reset: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionSlot: { flex: 1, height: 52 },
  secondaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
