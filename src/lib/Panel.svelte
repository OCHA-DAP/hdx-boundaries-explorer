<div class="panel">
  <slot />
</div>

<style>
  .panel {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
    width: 280px;
    background: white;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    padding: 16px;
    font-family: sans-serif;
    font-size: 14px;
  }

  .panel :global(h1) {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    letter-spacing: -0.01em;
  }
</style>
