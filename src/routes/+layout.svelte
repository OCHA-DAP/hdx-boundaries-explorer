<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
</script>

<svelte:head>
  <title>HDX Boundaries Explorer</title>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
