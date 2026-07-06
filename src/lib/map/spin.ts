import type maplibregl from "maplibre-gl";

const SPIN_SPEED = 6; // degrees per second

export function createSpin(getMap: () => maplibregl.Map | undefined) {
  let spinning = false;
  let animFrame: number | undefined;
  let lastTime: number | undefined;

  function spinStep(timestamp: number) {
    const map = getMap();
    if (!spinning || !map) return;

    if (lastTime !== undefined) {
      const delta = (timestamp - lastTime) / 1000;
      const center = map.getCenter();
      center.lng -= SPIN_SPEED * delta;
      map.setCenter(center);
    }
    lastTime = timestamp;

    animFrame = requestAnimationFrame(spinStep);
  }

  function start() {
    if (spinning) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    spinning = true;
    lastTime = undefined;
    animFrame = requestAnimationFrame(spinStep);
  }

  function stop() {
    if (!spinning) return;
    spinning = false;
    if (animFrame !== undefined) cancelAnimationFrame(animFrame);
  }

  return { start, stop };
}
