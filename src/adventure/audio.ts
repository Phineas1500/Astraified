type Cue =
  "pickup" | "success" | "wrong" | "talk" | "door" | "click" | "finish";
let context: AudioContext | undefined;
export function playCue(cue: Cue) {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const notes: Record<Cue, number[]> = {
      pickup: [587, 880],
      success: [523, 659, 784],
      wrong: [220, 196],
      talk: [350],
      door: [293, 349],
      click: [650],
      finish: [392, 523, 659, 784, 1047],
    };
    notes[cue].forEach((frequency, index) => {
      const oscillator = context!.createOscillator(),
        gain = context!.createGain();
      const time = context!.currentTime + index * 0.09;
      oscillator.type = cue === "door" ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(
        cue === "talk" ? 0.014 : 0.035,
        time + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.start(time);
      oscillator.stop(time + 0.2);
    });
  } catch {
    /* Browsers without audio still support the entire adventure. */
  }
}
