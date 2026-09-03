import { useCallback, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { useGame, FREE_MONTHLY_GAME_LIMIT } from '../context/GameContext';
import { track } from '../services/analyticsService';
import * as haptics from '../utils/haptics';

/**
 * Shared controller for the monthly quota sheet.
 *
 * Both places a game can start — the setup screen and the podium's rematch —
 * need the same block, the same analytics and the same hand-off to the
 * paywall, so all of it lives here rather than being written twice.
 */
export function useQuotaGate(from: 'setup' | 'rematch') {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { canStartGame, gamesThisMonth } = useGame();
  const [visible, setVisible] = useState(false);

  /**
   * Call before starting a game. Returns true when the quota is spent, having
   * raised the sheet, so the caller can simply bail out.
   */
  const blocked = useCallback((): boolean => {
    if (canStartGame) return false;
    haptics.warning();
    track({
      name: 'game_quota_blocked',
      properties: { gamesThisMonth, limit: FREE_MONTHLY_GAME_LIMIT, from },
    });
    setVisible(true);
    return true;
  }, [canStartGame, from, gamesThisMonth]);

  const dismiss = useCallback(() => {
    haptics.tap();
    setVisible(false);
  }, []);

  const upgrade = useCallback(() => {
    haptics.tap();
    setVisible(false);
    // The sheet is a native modal, and presenting the paywall while it is
    // still dismissing drops the navigation on iOS. Waiting for the dismissal
    // animation to settle is what keeps the hand-off reliable.
    InteractionManager.runAfterInteractions(() => {
      navigation.navigate('Paywall', { trigger: 'game_quota' });
    });
  }, [navigation]);

  return {
    /** Guard to run before creating a game. */
    blocked,
    /** Spread straight onto `<QuotaLimitModal />`. */
    modalProps: {
      visible,
      used: gamesThisMonth,
      limit: FREE_MONTHLY_GAME_LIMIT,
      onUpgrade: upgrade,
      onDismiss: dismiss,
    },
  };
}
