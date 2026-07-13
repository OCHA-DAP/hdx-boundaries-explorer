<script lang="ts">
  interface Props {
    // null renders an invisible placeholder (preserves grid alignment when
    // a row has nothing to show); "" still renders the colored badge with
    // no visible text inside it.
    text: string | null;
    bg?: string;
    fg?: string;
    tooltip?: string;
  }

  let { text, bg = "", fg = "", tooltip = "" }: Props = $props();
</script>

{#if text !== null}
  <span class="badge tooltip" style="background:{bg}; color:{fg}">
    {text}
    {#if tooltip}
      <span class="tooltip-text">{tooltip}</span>
    {/if}
  </span>
{:else}
  <span class="badge" aria-hidden="true"></span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 4px 1px;
    border-radius: 8px;
    font-size: 10px;
    line-height: 1;
    font-weight: 600;
    white-space: nowrap;
    position: relative;
  }

  .tooltip .tooltip-text {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 400;
    white-space: nowrap;
    transition: opacity 0.15s;
    z-index: 10;
  }

  .tooltip:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }
</style>
