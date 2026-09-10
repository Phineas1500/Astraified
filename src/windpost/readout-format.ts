import type { StationBinding } from "./episodes";

/** General lessons can have tiny or very large quantities; never display a
 * nonzero value as zero solely because its unit is smaller than a hundredth. */
export function formatStationReading(
  value: number,
  kind: StationBinding["kind"],
): string {
  return kind === "experiment"
    ? Number(value.toPrecision(6)).toString()
    : value.toFixed(2);
}
