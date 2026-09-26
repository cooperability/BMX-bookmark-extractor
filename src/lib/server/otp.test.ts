import { describe, expect, it } from 'vitest';
import { checkDevPassword } from './otp';

describe('checkDevPassword', () => {
	it('accepts the exact password', () => {
		expect(checkDevPassword('hunter2-long', 'hunter2-long')).toBe(true);
	});

	it('refuses a wrong, shorter or longer password', () => {
		expect(checkDevPassword('hunter2-lonG', 'hunter2-long')).toBe(false);
		expect(checkDevPassword('hunter2', 'hunter2-long')).toBe(false);
		expect(checkDevPassword('hunter2-long!', 'hunter2-long')).toBe(false);
	});

	it('refuses everything when DEV_PASSWORD is unset or empty', () => {
		expect(checkDevPassword('', undefined)).toBe(false);
		expect(checkDevPassword('', '')).toBe(false);
		expect(checkDevPassword('anything', undefined)).toBe(false);
	});
});
