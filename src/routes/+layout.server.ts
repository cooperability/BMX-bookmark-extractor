import { toTheme } from '$lib/theme';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies }) => ({
	user: locals.user ? { email: locals.user.email } : null,
	theme: toTheme(cookies.get('theme'))
});
