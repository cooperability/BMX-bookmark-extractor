import { hasDb } from '../testing/db';
import { describe, expect, it } from 'vitest';

const grade = hasDb ? await import('../../../routes/api/review/grade/+server') : null;
const finish = hasDb ? await import('../../../routes/api/review/finish/+server') : null;

type Handler = (event: unknown) => Promise<Response>;
const call = (h: unknown, body: string) =>
	(h as Handler)({
		request: new Request('http://localhost/api', { method: 'POST', body }),
		locals: { user: { id: 'nobody', email: 'nobody@test.invalid' } }
	});

describe.skipIf(!hasDb)('review endpoints', () => {
	it.each([
		['grade', () => grade!.POST],
		['finish', () => finish!.POST]
	])('%s answers a malformed body with 400', async (_, h) => {
		await expect(call(h(), '{not json')).rejects.toMatchObject({ status: 400 });
		await expect(call(h(), '')).rejects.toMatchObject({ status: 400 });
	});
});
