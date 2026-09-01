import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import GameScreen from '../screens/GameScreen';
import HistoryScreen from '../screens/HistoryScreen';
import PaywallModal from '../screens/PaywallModal';
import PodiumScreen from '../screens/PodiumScreen';
import SettingsScreen from '../screens/SettingsScreen';
import type { PaywallTrigger } from '../services/analyticsService';

export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  History: undefined;
  Settings: undefined;
  /** Final standings for a completed game. */
  Podium: { gameId: string };
  /** `trigger` attributes the impression in the conversion funnel. */
  Paywall: { trigger?: PaywallTrigger } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Game" component={GameScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen
        name="Podium"
        component={PodiumScreen}
        // The game is over: swiping back to the scoreboard makes no sense.
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallModal}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
