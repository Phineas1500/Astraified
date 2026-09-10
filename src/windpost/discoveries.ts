import type { WindpostState } from "./model";

export type DiscoveryId = "workshop-sketch" | "cargo-manifest";

export const DISCOVERIES: Record<
  DiscoveryId,
  { title: string; text: string; sourceIndices: readonly number[] }
> = {
  "workshop-sketch": {
    title: "Moss's workshop sketch",
    text: "A pencil sketch shows the same hanging weight on a short arm and a long arm. Moss has circled the longer arm: ‘More distance, more turning effect.’ Torque is weight force × perpendicular arm; with the same gravity, compare mass × distance on the two sides.",
    sourceIndices: [0],
  },
  "cargo-manifest": {
    title: "Bea's cargo manifest",
    text: "Today's cargo sheet lists the bridge's fixed load as 4 kg and the parcel lift's as 6 kg, each at 1 m. Both machines have a 2 kg counterweight. The lift needs a greater counterweight arm: opposing torques must match about the pivot.",
    sourceIndices: [1],
  },
};

export const isDiscoveryId = (id: unknown): id is DiscoveryId =>
  id === "workshop-sketch" || id === "cargo-manifest";

export function discoveryReply(
  npc: "moss" | "bea",
  state: WindpostState,
): string | undefined {
  if (npc === "moss" && state.discoveries.includes("workshop-sketch"))
    return "You found my sketch! A small weight can match a bigger one when its arm is longer. The meters measure from the pivot, not from the end of the beam.";
  if (npc === "bea" && state.discoveries.includes("cargo-manifest"))
    return "That manifest explains the change: this load is 6 kg, while Moss's was 4 kg. Keeping the same 2 kg counterweight means reconsidering its distance. The bridge's socket needn't balance the lift.";
  return undefined;
}
