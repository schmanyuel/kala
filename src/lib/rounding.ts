/** Rounding steps offered when stopping the timer, in minutes (0 = exact). */
export const ROUNDING_STEPS = [0, 15, 30, 60] as const;
export type RoundingStep = (typeof ROUNDING_STEPS)[number];
export type RoundingDirection = 'down' | 'up';

export const isRoundingStep = (n: number): n is RoundingStep =>
	(ROUNDING_STEPS as readonly number[]).includes(n);

export const roundingLabel = (step: RoundingStep) =>
	({ 0: 'Genau', 15: '¼ h', 30: '½ h', 60: '1 h' })[step];

/** Rounds a duration to a multiple of `step` minutes. Rounding down never goes below one
 *  step, so a short entry rounded down still keeps time on it. */
export function roundDuration(seconds: number, step: number, direction: RoundingDirection) {
	if (!step) return seconds;
	const unit = step * 60;
	const down = Math.floor(seconds / unit) * unit;
	if (direction === 'down' && down > 0) return down;
	return Math.max(unit, Math.ceil(seconds / unit) * unit);
}

/** The direction that lands closest to the measured time (ties round up). */
export function nearestDirection(seconds: number, step: number): RoundingDirection {
	if (!step) return 'down';
	const unit = step * 60;
	return seconds < unit || seconds % unit >= unit / 2 ? 'up' : 'down';
}
