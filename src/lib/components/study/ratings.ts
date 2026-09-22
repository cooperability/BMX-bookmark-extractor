// Class strings stay literal so Tailwind can see them.
export const RATINGS = [
	{
		value: 1,
		label: 'Again',
		key: '1',
		class: 'border-again/40 bg-again/10 text-again hover:bg-again/20'
	},
	{
		value: 2,
		label: 'Hard',
		key: '2',
		class: 'border-hard/40 bg-hard/10 text-hard hover:bg-hard/20'
	},
	{
		value: 3,
		label: 'Good',
		key: '3',
		class: 'border-good/40 bg-good/10 text-good hover:bg-good/20'
	},
	{
		value: 4,
		label: 'Easy',
		key: '4',
		class: 'border-easy/40 bg-easy/10 text-easy hover:bg-easy/20'
	}
];

export const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);

export type AreaScore = { tag: string; cards: number; again: number; score: number };
export type Grades = { score: number | null; areas: AreaScore[]; strong: string[]; weak: string[] };
