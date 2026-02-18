<script lang="ts">
  import { splitMode } from '$lib/map/store';
</script>

<button class="split-toggle" onclick={() => splitMode.update((v) => !v)}>
  {$splitMode ? 'Single' : 'Split'}
</button>

<style>
  .split-toggle {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 20;
    padding: 6px 12px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #333;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }

  .split-toggle:hover {
    background: #f5f5f5;
    border-color: #bbb;
  }
</style>
