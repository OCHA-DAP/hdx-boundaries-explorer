<script lang="ts">
  import Badge from "./Badge.svelte";

  interface Props {
    rank: number;
    planType: string | null;
    planYear: number | null;
  }

  let { rank, planType, planYear }: Props = $props();

  const COLORS: Record<number, { bg: string; fg: string }> = {
    0: { bg: "#b3261e", fg: "#fff" },
    1: { bg: "#d3521a", fg: "#fff" },
    2: { bg: "#e8901a", fg: "#1a1a1a" },
    3: { bg: "#e8c61a", fg: "#1a1a1a" },
    4: { bg: "#d9d9d9", fg: "#1a1a1a" },
    5: { bg: "#f2f2f2", fg: "#999" },
  };

  // Exactly 2 letters, to match OfficeTypeBadge's 2-letter badges — first
  // 2 chars, except HNRP/HRP which'd otherwise collide on "HR".
  const LETTERS: Record<string, string> = {
    HNRP: "HN",
    HRP: "HR",
    FA: "FA",
    REG: "RE",
    Other: "OT",
  };

  let color = $derived(COLORS[rank] ?? COLORS[5]);
  let letters = $derived(
    planType ? (LETTERS[planType] ?? planType.slice(0, 2).toUpperCase()) : null,
  );
  let label = $derived(planType ? `${planType}${planYear ? ` ${planYear}` : ""}` : "No plan");
</script>

<Badge text={letters} bg={color.bg} fg={color.fg} tooltip={label} />
