export function startOfWeek(date: Date): Date {
	const d = new Date(date);
	const dayIndex = (d.getDay() + 6) % 7; // Monday = 0
	d.setDate(d.getDate() - dayIndex);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function addDays(date: Date, days: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}

export function startOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function endOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
}

export function startOfMonth(date: Date): Date {
	const d = new Date(date.getFullYear(), date.getMonth(), 1);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function endOfMonth(date: Date): Date {
	const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
	d.setHours(23, 59, 59, 999);
	return d;
}
