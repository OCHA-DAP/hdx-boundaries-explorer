<script lang="ts">
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

  let color = $derived(COLORS[rank] ?? COLORS[5]);
  let label = $derived(planType ? `${planType}${planYear ? ` ${planYear}` : ""}` : "No plan");
</script>

<span class="badge" style="background:{color.bg}; color:{color.fg}">{label}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px 1px;
    border-radius: 10px;
    font-size: 11px;
    line-height: 1;
    font-weight: 600;
    white-space: nowrap;
  }
</style>
