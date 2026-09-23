// robots.txt (TDD §6.3). The harvester fetches one page a person bookmarked, not a
// crawl, but it still honours a site's Disallow for its agent or for '*'.

export const AGENT = 'remediatebot';

interface Rule {
	allow: boolean;
	path: string;
}

/** The rules that apply to AGENT: its own group if the file has one, else '*'. */
export function parseRobots(text: string): Rule[] {
	const groups: { agents: string[]; rules: Rule[] }[] = [];
	let current: { agents: string[]; rules: Rule[] } | null = null;
	let lastWasAgent = false;
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/#.*/, '').trim();
		const m = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
		if (!m) continue;
		const key = m[1].toLowerCase();
		const value = m[2].trim();
		if (key === 'user-agent') {
			if (!current || !lastWasAgent) {
				current = { agents: [], rules: [] };
				groups.push(current);
			}
			current.agents.push(value.toLowerCase());
			lastWasAgent = true;
			continue;
		}
		lastWasAgent = false;
		if (!current) continue;
		if (key === 'disallow' || key === 'allow') {
			// An empty Disallow allows everything; it adds no rule.
			if (value) current.rules.push({ allow: key === 'allow', path: value });
		}
	}
	const own = groups.filter((g) => g.agents.some((a) => a !== '*' && AGENT.includes(a)));
	const chosen = own.length ? own : groups.filter((g) => g.agents.includes('*'));
	return chosen.flatMap((g) => g.rules);
}

/** Whether a rule path (with `*` and a trailing `$`) matches the start of `path`. */
function matches(rule: string, path: string): boolean {
	const anchored = rule.endsWith('$');
	const body = anchored ? rule.slice(0, -1) : rule;
	const pattern = body
		.split('*')
		.map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
		.join('.*');
	return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(path);
}

/** Longest matching rule wins, and Allow wins a tie (RFC 9309). No rule means allowed. */
export function robotsAllow(rules: Rule[], url: string): boolean {
	const u = new URL(url);
	const path = `${u.pathname}${u.search}`;
	let best: Rule | null = null;
	for (const r of rules) {
		if (!matches(r.path, path)) continue;
		if (
			!best ||
			r.path.length > best.path.length ||
			(r.path.length === best.path.length && r.allow)
		)
			best = r;
	}
	return best ? best.allow : true;
}
