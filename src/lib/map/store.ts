import type maplibregl from 'maplibre-gl';
import { writable } from 'svelte/store';

export const mapStore = writable<maplibregl.Map | null>(null);
export const selectedIso3 = writable<string>('');
export const selectedAdmin = writable<number>(1);
export const selectedSource = writable<string>('ocha');
export const labelsEnabled = writable<boolean>(true);
