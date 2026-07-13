<script lang="ts">
  import type { OfficeType } from "$lib/parquet/officeType";
  import Badge from "./Badge.svelte";

  interface Props {
    officeType: OfficeType | null;
  }

  let { officeType }: Props = $props();

  // A blue -> teal -> green ramp, dark-to-light by tier — mirrors
  // RelevanceBadge's red -> orange -> yellow severity ramp, encoding
  // CO > RO > HAT (the same hierarchy the office-type sort uses). The hue
  // arc is deliberately as wide as the warm ramp's (~90°, vs. red-to-yellow's
  // ~50°): an earlier version kept all three stops within a ~15° teal band,
  // which the eye can barely resolve — narrow hue differences are much
  // harder to discriminate than the warm ramp's red/orange/yellow, which
  // read as culturally distinct color names, not just lightness steps.
  // Text color follows the same rule as the severity ramp: white on the
  // darker stops, dark text once the swatch (HAT) gets light enough that
  // white fails contrast.
  const COLORS: Record<OfficeType, { bg: string; fg: string }> = {
    CO: { bg: "#1959a8", fg: "#fff" },
    RO: { bg: "#0d7a64", fg: "#fff" },
    HAT: { bg: "#7cc47f", fg: "#1a1a1a" },
  };

  const LABELS: Record<OfficeType, string> = {
    CO: "Country Office",
    RO: "Regional Office",
    HAT: "Humanitarian Advisory Team",
  };

  // Exactly 2 letters, to match RelevanceBadge's 2-letter badges.
  const DISPLAY: Record<OfficeType, string> = {
    CO: "CO",
    RO: "RO",
    HAT: "HA",
  };
</script>

<Badge
  text={officeType ? DISPLAY[officeType] : null}
  bg={officeType ? COLORS[officeType].bg : ""}
  fg={officeType ? COLORS[officeType].fg : ""}
  tooltip={officeType ? LABELS[officeType] : ""}
/>
