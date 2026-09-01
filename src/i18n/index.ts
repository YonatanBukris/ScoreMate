import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './en';
import de from './de';
import nl from './nl';

export const SUPPORTED_LANGUAGES = ['en', 'de', 'nl'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Key holding a manual language override; absent means "follow the device". */
const LANGUAGE_KEY = 'scorekeeper/language/v1';

/** BCP 47 tags used by expo-speech for each supported language. */
const SPEECH_LOCALES: Record<SupportedLanguage, string> = {
  en: 'en-US',
  de: 'de-DE',
  nl: 'nl-NL',
};

/** Endonyms shown in the language picker, so each option reads natively. */
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  de: 'Deutsch',
  nl: 'Nederlands',
};

export const resources = {
  en: { translation: en },
  de: { translation: de },
  nl: { translation: nl },
} as const;

function isSupported(code: string | null | undefined): code is SupportedLanguage {
  return !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

function resolveDeviceLanguage(): SupportedLanguage {
  const deviceCode = getLocales()[0]?.languageCode ?? 'en';
  return isSupported(deviceCode) ? deviceCode : 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    // React already escapes values, so i18next escaping is unnecessary.
    escapeValue: false,
  },
});

/** The active language, normalized to one we actually ship. */
export function getCurrentLanguage(): SupportedLanguage {
  const lang = i18n.language?.split('-')[0];
  return isSupported(lang) ? lang : 'en';
}

/** Returns the BCP 47 locale tag for expo-speech based on the active language. */
export function getSpeechLocale(): string {
  return SPEECH_LOCALES[getCurrentLanguage()];
}

/**
 * Switches the app language now and remembers the choice across launches.
 * `getSpeechLocale()` reads the live i18next language, so voice announcements
 * follow along without any extra wiring.
 */
export async function setAppLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch (err) {
    console.warn('Failed to persist language', err);
  }
}

/** Drops the manual override and falls back to the device language. */
export async function resetToDeviceLanguage(): Promise<void> {
  await i18n.changeLanguage(resolveDeviceLanguage());
  try {
    await AsyncStorage.removeItem(LANGUAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear language override', err);
  }
}

/** Applies a previously saved override. Call once, before the first render. */
export async function restoreStoredLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (isSupported(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch (err) {
    console.warn('Failed to restore language', err);
  }
}

export default i18n;
