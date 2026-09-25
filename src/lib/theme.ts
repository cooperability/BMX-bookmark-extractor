export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export function toTheme(value: unknown): Theme {
	return THEMES.includes(value as Theme) ? (value as Theme) : 'system';
}
