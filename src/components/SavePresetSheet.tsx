import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookmarkPlus } from 'lucide-react-native';

import { useTheme } from '../theme';
import { PRESET_NAME_MAX_LENGTH, normalizePresetName } from '../utils/presets';
import { Card, GradientButton, Pressable3D, SectionLabel } from './ui';
import * as haptics from '../utils/haptics';

/**
 * Naming sheet for a new preset. The name is the only thing being asked for —
 * everything else the preset stores is whatever the setup screen already has
 * on it, so there is nothing here to get out of step with.
 */
export default function SavePresetSheet({
  visible,
  existingNames,
  suggestedName,
  limitHint,
  onCancel,
  onSave,
}: {
  visible: boolean;
  /** Names already in use; typing one of them replaces that preset. */
  existingNames: string[];
  /** Placeholder fallback, so an unnamed save still reads as something. */
  suggestedName: string;
  /** Shown when the tier has no slot left, since replacing is the way in. */
  limitHint?: string | null;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [name, setName] = useState('');

  // Every visit starts from a blank field rather than the last thing typed.
  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  const trimmed = normalizePresetName(name);
  // Case-insensitive, matching how the context resolves a name to a preset.
  const replacing = useMemo(() => {
    const needle = trimmed.toLowerCase();
    if (!needle) return null;
    return existingNames.find((n) => n.toLowerCase() === needle) ?? null;
  }, [existingNames, trimmed]);

  const cancel = () => {
    haptics.tap();
    onCancel();
  };

  const save = () => {
    if (!trimmed) return;
    onSave(trimmed);
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
            <View style={styles.heading}>
              <View
                style={[
                  styles.headingIcon,
                  { backgroundColor: theme.colors.primary, borderRadius: theme.radii.sm },
                ]}
              >
                <BookmarkPlus size={18} color={theme.colors.primaryText} />
              </View>
              <View style={styles.flex}>
                <Text style={[theme.type.title, { color: theme.colors.text }]}>
                  {t('presets.saveTitle')}
                </Text>
                <Text style={[theme.type.label, { color: theme.colors.textMuted }]}>
                  {t('presets.saveSubtitle')}
                </Text>
              </View>
            </View>

            <View style={styles.block}>
              <SectionLabel>{t('presets.nameLabel')}</SectionLabel>
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={save}
                maxLength={PRESET_NAME_MAX_LENGTH}
                placeholder={suggestedName || t('presets.namePlaceholder')}
                placeholderTextColor={theme.colors.textFaint}
                accessibilityLabel={t('presets.nameLabel')}
                style={[
                  styles.nameInput,
                  {
                    color: theme.colors.text,
                    borderColor: theme.colors.borderStrong,
                    backgroundColor: theme.colors.surfaceAlt,
                    borderRadius: theme.radii.md,
                  },
                ]}
              />
              {replacing ? (
                <Text style={[theme.type.caption, { color: theme.colors.accent }]}>
                  {t('presets.replaces', { name: replacing })}
                </Text>
              ) : limitHint ? (
                <Text style={[theme.type.caption, styles.hint, { color: theme.colors.textFaint }]}>
                  {limitHint}
                </Text>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Pressable3D
                onPress={cancel}
                accessibilityLabel={t('common.cancel')}
                style={styles.actionSlot}
              >
                <View
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.lg },
                  ]}
                >
                  <Text style={[theme.type.heading, { color: theme.colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </View>
              </Pressable3D>
              <GradientButton
                label={t('presets.saveCta')}
                onPress={save}
                disabled={!trimmed}
                height={52}
                style={styles.actionSlot}
              />
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 20, gap: 18 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  block: { gap: 6 },
  hint: { lineHeight: 16 },
  nameInput: {
    height: 54,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '700',
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionSlot: { flex: 1, height: 52 },
  secondaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
