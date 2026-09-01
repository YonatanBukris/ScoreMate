import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface FloatingDelta {
  key: number;
  delta: number;
}

interface Props {
  score: number;
  color: string;
  positiveColor: string;
  negativeColor: string;
  /** Bumped by the parent on every scoring tap, so repeats still animate. */
  pulseKey: number;
  lastDelta: number;
  /** Font size of the readout; the float scales with it. */
  size?: number;
}

/**
 * The large score readout. Pops on change and floats the applied delta upward
 * so a tap is legible even when the number barely moves.
 */
export default function AnimatedScore({
  score,
  color,
  positiveColor,
  negativeColor,
  pulseKey,
  lastDelta,
  size = 56,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [floats, setFloats] = useState<FloatingDelta[]>([]);
  // The first render is the initial score, not a scoring event.
  const seenPulse = useRef(pulseKey);

  useEffect(() => {
    if (pulseKey === seenPulse.current || lastDelta === 0) return;
    seenPulse.current = pulseKey;

    Animated.sequence([
      Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
    ]).start();

    setFloats((prev) => [...prev, { key: pulseKey, delta: lastDelta }]);
  }, [pulseKey, lastDelta, scale]);

  const removeFloat = (key: number) =>
    setFloats((prev) => prev.filter((f) => f.key !== key));

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.value,
          { color, fontSize: size, lineHeight: size * 1.1, transform: [{ scale }] },
        ]}
      >
        {score}
      </Animated.Text>
      {floats.map((f) => (
        <FloatingLabel
          key={f.key}
          delta={f.delta}
          color={f.delta >= 0 ? positiveColor : negativeColor}
          size={size}
          onDone={() => removeFloat(f.key)}
        />
      ))}
    </View>
  );
}

function FloatingLabel({
  delta,
  color,
  size,
  onDone,
}: {
  delta: number;
  color: string;
  size: number;
  onDone: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 850,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => animation.stop();
    // Runs once per mounted label; `onDone` identity must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.float,
        {
          color,
          fontSize: Math.max(15, size * 0.46),
          opacity: progress.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0, 1, 0],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                // Stays inside the readout's own height so the rounded card
                // that hosts it cannot clip the label on Android.
                outputRange: [0, -(size * 0.9)],
              }),
            },
          ],
        },
      ]}
    >
      {delta > 0 ? `+${delta}` : delta}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  value: { fontWeight: '900', letterSpacing: -1 },
  float: {
    // Anchored to the bottom and rising less than the readout's height, so it
    // never escapes the rounded card (which clips children on Android).
    position: 'absolute',
    bottom: 2,
    fontWeight: '800',
  },
});
