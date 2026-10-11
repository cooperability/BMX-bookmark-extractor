import { defineEnvVars } from '@sveltejs/kit/env';

// Kit rejects an undeclared-schema variable that is unset, at build and at start. All
// three stay optional: db/index.ts throws on use rather than at import (see there), and
// the allowlist and dev password are off when unset.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	DATABASE_URL: { schema: optional },
	ALLOWED_EMAILS: { schema: optional },
	DEV_PASSWORD: { schema: optional }
});
