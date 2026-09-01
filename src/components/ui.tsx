import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { avatarColor, initialsOf, useTheme, type GradientPair } from '../theme';

/**
 * Shared visual primitives. Keeping the gradient, press-spring and surface
 * treatments in one place is what stops the screens drifting apart as they
 * evolve — a card here looks like a card there because it is the same card.
 */

// ---------------------------------------------------------------------------
// Press feedback
// ---------------------------------------------------------------------------

/**
 * Wraps children in a spring-scaled Pressable. Everything tappable in the
 * redesign uses this, so press feedback is uniform across the app.
 */
export function Pressable3D({
  onPress,
  children,
  style,
  disabled,
  scaleTo = 0.96,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'radio' | 'link';
  accessibilityState?: { selected?: boolean; disabled?: boolean };
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number, speed: number, bounciness: number) => {
    Animated.spring(scale, { toValue, useNativeDriver: true, speed, bounciness }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => !disabled && spring(scaleTo, 40, 0)}
        onPressOut={() => !disabled && spring(1, 18, 12)}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={styles.fill}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/** Standard layered card: soft fill, hairline border, resting shadow. */
export function Card({
  children,
  style,
  elevated,
  glowColor,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  /** When set, the card gains a tinted halo and a matching border. */
  glowColor?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: elevated ? theme.colors.cardElevated : theme.colors.card,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: glowColor ?? theme.colors.border,
        },
        glowColor ? theme.shadows.glow(glowColor) : theme.shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

/** Primary call to action, filled with the brand gradient. */
export function GradientButton({
  label,
  onPress,
  icon,
  gradient,
  height = 56,
  busy,
  disabled,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  gradient?: GradientPair;
  height?: number;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const colors = gradient ?? theme.gradients.primary;

  return (
    <Pressable3D
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityLabel={label}
      style={[
        { borderRadius: theme.radii.lg, opacity: disabled ? 0.5 : 1 },
        theme.shadows.raised,
        style,
      ]}
    >
      <LinearGradient
        colors={[colors[0], colors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientButton, { height, borderRadius: theme.radii.lg }]}
      >
        {busy ? (
          <ActivityIndicator color={theme.colors.primaryText} />
        ) : (
          <>
            {icon}
            <Text
              style={[
                theme.type.heading,
                styles.gradientButtonText,
                { color: theme.colors.primaryText },
                textStyle,
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </LinearGradient>
    </Pressable3D>
  );
}

/**
 * Pill-shaped score control. Positive deltas read as emerald, negative as
 * rose, and the neutral variant carries secondary actions like "Custom".
 */
export function ScorePill({
  label,
  onPress,
  variant,
  style,
}: {
  label: string;
  onPress: () => void;
  variant: 'positive' | 'negative' | 'neutral';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  if (variant === 'neutral') {
    return (
      <Pressable3D
        onPress={onPress}
        accessibilityLabel={label}
        style={[styles.pillWrapper, style]}
      >
        <View
          style={[
            styles.pill,
            {
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.pillText, { color: theme.colors.text }]}>{label}</Text>
        </View>
      </Pressable3D>
    );
  }

  const gradient =
    variant === 'positive' ? theme.gradients.positive : theme.gradients.negative;
  const glow = variant === 'positive' ? theme.colors.success : theme.colors.danger;

  return (
    <Pressable3D
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.pillWrapper, theme.shadows.glow(glow), style]}
    >
      <LinearGradient
        colors={[gradient[0], gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pill, { borderRadius: theme.radii.pill }]}
      >
        <Text style={[styles.pillText, styles.pillTextOnColor]}>{label}</Text>
      </LinearGradient>
    </Pressable3D>
  );
}

// ---------------------------------------------------------------------------
// Chips and avatars
// ---------------------------------------------------------------------------

/** Small labelled chip used for template metadata and status badges. */
export function Chip({
  label,
  color,
  icon,
  filled,
  style,
}: {
  label: string;
  color?: string;
  icon?: React.ReactNode;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const tint = color ?? theme.colors.textMuted;
  return (
    <View
      style={[
        styles.chip,
        {
          borderRadius: theme.radii.pill,
          backgroundColor: filled ? tint : theme.colors.surfaceAlt,
          borderWidth: filled ? 0 : 1,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          theme.type.caption,
          { color: filled ? '#FFFFFF' : tint },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Circular initials avatar, tinted deterministically from the player name. */
export function Avatar({
  name,
  size = 44,
  seed,
  ringColor,
}: {
  name: string;
  size?: number;
  /** Overrides the colour source; defaults to the name itself. */
  seed?: string;
  ringColor?: string;
}) {
  const theme = useTheme();
  const base = avatarColor(seed ?? name);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: base,
        borderWidth: ringColor ? 2 : 0,
        borderColor: ringColor,
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.38,
          fontWeight: '800',
          letterSpacing: -0.3,
        }}
      >
        {initialsOf(name)}
      </Text>
      {/* Keeps the avatar readable on light backgrounds without a shadow. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: theme.dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)',
          },
        ]}
      />
    </View>
  );
}

/**
 * Overlapping row of avatars. Yoga has no negative `gap`, so the overlap comes
 * from a negative left margin on every avatar after the first.
 */
export function AvatarStack({
  names,
  size = 28,
  max = 3,
  overlap = 8,
  ringColor,
}: {
  names: string[];
  size?: number;
  max?: number;
  overlap?: number;
  ringColor?: string;
}) {
  return (
    <View style={styles.avatarStack}>
      {names.slice(0, max).map((name, index) => (
        <View key={`${name}-${index}`} style={{ marginLeft: index === 0 ? 0 : -overlap }}>
          <Avatar name={name} size={size} ringColor={ringColor} />
        </View>
      ))}
    </View>
  );
}

/** Uppercase section label with generous tracking. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        theme.type.caption,
        { color: theme.colors.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  // `flex: 1` rather than `height: '100%'`: a percentage height needs a
  // definite parent height, and several wrappers are content-sized.
  fill: { flex: 1 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  gradientButtonText: { fontSize: 17, fontWeight: '800' },
  pillWrapper: { flexGrow: 1, flexBasis: '30%', height: 54 },
  pill: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  pillTextOnColor: { color: '#FFFFFF' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
});
