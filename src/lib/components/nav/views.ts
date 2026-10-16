import type { Component } from 'svelte';
import Layers from '@lucide/svelte/icons/layers';
import Library from '@lucide/svelte/icons/library';
import MapIcon from '@lucide/svelte/icons/map';

/** The app's three views, in the order both the top nav and the phone tab bar draw them. */
export const VIEWS: {
	href: '/cards' | '/cards/browse' | '/quest';
	label: string;
	icon: Component<{ class?: string }>;
	match: (path: string) => boolean;
}[] = [
	{
		href: '/cards',
		label: 'Decks',
		icon: Layers,
		match: (p) => p === '/cards' || p.startsWith('/cards/deck')
	},
	{
		href: '/cards/browse',
		label: 'Browse',
		icon: Library,
		match: (p) => p.startsWith('/cards/browse')
	},
	{ href: '/quest', label: 'Quest', icon: MapIcon, match: (p) => p.startsWith('/quest') }
];
