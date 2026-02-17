<script lang="ts">
  import { labelsEnabled } from '$lib/map/store';
</script>

<label class="toggle">
  <input type="checkbox" bind:checked={$labelsEnabled} />
  <span class="track"><span class="thumb"></span></span>
  <span class="text">Labels</span>
</label>

<style>
  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .track {
    position: relative;
    width: 32px;
    height: 18px;
    background: #ccc;
    border-radius: 9px;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  input:checked ~ .track {
    background: #2060a0;
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    transition: transform 0.15s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  input:checked ~ .track .thumb {
    transform: translateX(14px);
  }

  .text {
    font-size: 13px;
    color: #1a1a1a;
  }
</style>
