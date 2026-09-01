import { useColorScheme } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Design tokens.
 *
 * Every colour the screens use comes from here, so the palette can be retuned
 * in one place. The `colors` keys are stable — screens and components address
 * them by name — while `gradients`, `radii`, `spacing`, `type` and `shadows`
 * carry the depth and rhythm that make the surfaces read as layered rather
 * than flat.
 */

export type GradientPair = readonly [string, string];

export interface ThemeColors {
  /** Deepest layer: the app background. */
  background: string;
  /** Raised panels and sheets. */
  surface: string;
  /** Inset wells — input backgrounds, muted chips. */
  surfaceAlt: string;
  /** Cards sitting on `background`. */
  card: string;
  /** A second card tone for nesting a card inside a card. */
  cardElevated: string;
  /** Hairline separators and card outlines. */
  border: string;
  /** A brighter outline for the focused or selected element. */
  borderStrong: string;
  text: string;
  textMuted: string;
  /** Lowest-emphasis text: legal lines, captions. */
  textFaint: string;
  primary: string;
  primaryText: string;
  /** Tinted primary wash for selected states, at low opacity. */
  primarySoft: string;
  accent: string;
  /** Leader/1st-place amber. */
  gold: string;
  silver: string;
  bronze: string;
  danger: string;
  success: string;
  overlay: string;
}

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  gradients: {
    /** Indigo → violet, the brand gradient. */
    primary: GradientPair;
    /** Emerald, for gains and confirmations. */
    positive: GradientPair;
    negative: GradientPair;
    gold: GradientPair;
    silver: GradientPair;
    bronze: GradientPair;
    /** Background wash behind hero sections. */
    hero: GradientPair;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  spacing: (steps: number) => number;
  type: {
    display: TextStyle;
    title: TextStyle;
    heading: TextStyle;
    body: TextStyle;
    label: TextStyle;
    caption: TextStyle;
    /** Tabular-ish numerals for scores. */
    score: TextStyle;
  };
  shadows: {
    /** Resting elevation for cards. */
    card: ViewStyle;
    /** Buttons and anything that floats above content. */
    raised: ViewStyle;
    /** Bottom sheets and the floating action bar. */
    floating: ViewStyle;
    /** Coloured halo; pass the colour to tint it. */
    glow: (color: string) => ViewStyle;
  };
}

const RADII = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

/** 4pt rhythm: `spacing(3)` is 12. */
const spacing = (steps: number) => steps * 4;

const TYPE: Theme['type'] = {
  display: { fontSize: 32, fontWeight: '900', letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  score: { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
};

/**
 * Shadows are tuned per scheme: on dark surfaces a black shadow is invisible,
 * so elevation there leans on the translucent borders instead and keeps only a
 * soft ambient depth.
 */
function makeShadows(dark: boolean): Theme['shadows'] {
  const shadowColor = dark ? '#000000' : '#0F172A';
  return {
    card: {
      shadowColor,
      shadowOpacity: dark ? 0.35 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    raised: {
      shadowColor,
      shadowOpacity: dark ? 0.45 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    floating: {
      shadowColor,
      shadowOpacity: dark ? 0.55 : 0.18,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    glow: (color: string) => ({
      shadowColor: color,
      shadowOpacity: dark ? 0.6 : 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    }),
  };
}

const light: Theme = {
  dark: false,
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF2F7',
    card: '#FFFFFF',
    cardElevated: '#F8FAFC',
    border: 'rgba(15,23,42,0.08)',
    borderStrong: 'rgba(15,23,42,0.16)',
    text: '#0F172A',
    textMuted: '#64748B',
    textFaint: '#94A3B8',
    primary: '#6366F1',
    primaryText: '#FFFFFF',
    primarySoft: 'rgba(99,102,241,0.10)',
    accent: '#F59E0B',
    gold: '#F59E0B',
    silver: '#94A3B8',
    bronze: '#C2703B',
    danger: '#E11D48',
    success: '#059669',
    overlay: 'rgba(15,23,42,0.45)',
  },
  gradients: {
    primary: ['#6366F1', '#8B5CF6'],
    positive: ['#10B981', '#059669'],
    negative: ['#F43F5E', '#E11D48'],
    gold: ['#FBBF24', '#D97706'],
    silver: ['#CBD5E1', '#94A3B8'],
    bronze: ['#D8A06B', '#B45309'],
    hero: ['#EEF2FF', '#F8FAFC'],
  },
  radii: RADII,
  spacing,
  type: TYPE,
  shadows: makeShadows(false),
};

const dark: Theme = {
  dark: true,
  colors: {
    background: '#0B0F19',
    surface: '#111827',
    surfaceAlt: '#1B2333',
    card: '#111827',
    cardElevated: '#1B2333',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    textFaint: '#64748B',
    primary: '#818CF8',
    primaryText: '#FFFFFF',
    primarySoft: 'rgba(129,140,248,0.16)',
    accent: '#FBBF24',
    gold: '#FBBF24',
    silver: '#CBD5E1',
    bronze: '#D8A06B',
    danger: '#FB7185',
    success: '#34D399',
    overlay: 'rgba(2,6,16,0.72)',
  },
  gradients: {
    primary: ['#6366F1', '#8B5CF6'],
    positive: ['#34D399', '#10B981'],
    negative: ['#FB7185', '#E11D48'],
    gold: ['#FBBF24', '#D97706'],
    silver: ['#E2E8F0', '#94A3B8'],
    bronze: ['#E0AE7C', '#B45309'],
    hero: ['#1B2333', '#0B0F19'],
  },
  radii: RADII,
  spacing,
  type: TYPE,
  shadows: makeShadows(true),
};

/** Returns the theme matching the current device color scheme. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

/**
 * Initials for an avatar chip. Takes the first letter of the first two words
 * so "Anna Maria" reads "AM" while a single name gives one strong letter.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Deterministic accent per player, so a name always gets the same colour. */
const AVATAR_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#F43F5E',
  '#84CC16',
] as const;

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
