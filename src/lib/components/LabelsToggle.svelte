<script lang="ts">
  import { labelsEnabled } from '$lib/map/store';
</script>

<div class="field">
  <span class="field-label">Inspect features</span>
  <label class="toggle">
    <input type="checkbox" bind:checked={$labelsEnabled} />
    <span class="track"><span class="thumb"></span></span>
    <span class="text">{$labelsEnabled ? 'Labels' : 'Hover'}</span>
  </label>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
  }

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
