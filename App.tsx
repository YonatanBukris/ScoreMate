import React from 'react';
import { ActivityIndicator, I18nManager, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Initialize i18next before any screen renders.
import './src/i18n';

/**
 * Pin the app to left-to-right.
 *
 * We ship English, German and Dutch, all LTR. Without this, a device set to
 * Hebrew or Arabic makes Android mirror every row — the scoreboard, the header
 * icons, the podium — even though not a word of the UI is right-to-left. Run at
 * module scope so it lands before the first render.
 *
 * On Android a change only takes full effect after a restart, so this is
 * deliberately called on every launch rather than guarded behind `isRTL`: the
 * first launch on an RTL device may still mirror, and every launch after it
 * will not.
 */
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

import { GameProvider, useGame } from './src/context/GameContext';
import RootNavigator from './src/navigation';
import { useTheme } from './src/theme';

function AppContent() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const { ready } = useGame();

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const mergedNavTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
    },
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={mergedNavTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </SafeAreaProvider>
  );
}
