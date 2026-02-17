import { writable } from 'svelte/store';
import type maplibregl from 'maplibre-gl';

export const mapStore = writable<maplibregl.Map | null>(null);
export const selectedIso3 = writable<string>('');
