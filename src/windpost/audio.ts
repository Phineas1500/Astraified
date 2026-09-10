export function createPostAudio() {
  let context: AudioContext | undefined;
  let enabled = false;
  const play = (
    kind: "pickup" | "talk" | "place" | "miss" | "success" | "finish",
  ) => {
    if (!enabled) return;
    try {
      context ??= new AudioContext();
      void context.resume();
      const notes = {
        pickup: [587, 880],
        talk: [392],
        place: [330, 440],
        miss: [233, 220],
        success: [523, 659, 784],
        finish: [392, 523, 659, 784, 1047],
      }[kind];
      notes.forEach((frequency, i) => {
        const oscillator = context!.createOscillator(),
          gain = context!.createGain(),
          time = context!.currentTime + i * 0.105;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.05, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
        oscillator.connect(gain);
        gain.connect(context!.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.38);
      });
    } catch {
      /* Silent mode remains fully playable. */
    }
  };
  return {
    play,
    setEnabled(value: boolean) {
      enabled = value;
    },
    dispose() {
      void context?.close();
    },
  };
}
