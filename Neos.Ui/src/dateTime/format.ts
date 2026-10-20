import {format as formatDate, isValid, parse} from 'date-fns';
import type {Locale} from 'date-fns';

/** What a format of the DateTimeEditor (`editorOptions.format`, PHP date() letters) lets the editor pick */
export type Kind = {date: boolean; time: boolean; hour12: boolean; seconds: boolean};

/** The PHP date() letters (see the PropertyEditorReference of Neos) as date-fns tokens */
const TOKENS: Record<string, string> = {
	d: 'dd',
	D: 'EEE',
	j: 'd',
	l: 'EEEE',
	N: 'i',
	w: 'e',
	W: 'II',
	F: 'MMMM',
	m: 'MM',
	M: 'MMM',
	n: 'M',
	o: 'RRRR',
	Y: 'yyyy',
	y: 'yy',
	a: 'aaa',
	A: 'a',
	g: 'h',
	G: 'H',
	h: 'hh',
	H: 'HH',
	i: 'mm',
	s: 'ss',
	O: 'xx',
	P: 'xxx'
};

export function kindOf(phpFormat: string): Kind {
	const letters = phpFormat.replace(/\\./g, '');
	return {
		date: /[yYFmMntdDjlNSw]/.test(letters),
		time: /[gGhHis]/.test(letters),
		hour12: /[gh]/.test(letters) && !/[GH]/.test(letters),
		seconds: /s/.test(letters)
	};
}

/** A PHP date() format as a date-fns one: letters without a token (and escaped ones, `\x`) stay text */
export function toDateFnsFormat(phpFormat: string): string {
	let result = '';
	let text = '';
	const flush = () => {
		if (text) {
			result += `'${text.replace(/'/g, "''")}'`;
			text = '';
		}
	};
	for (let index = 0; index < phpFormat.length; index++) {
		const letter = phpFormat[index];
		if (letter === '\\') {
			text += phpFormat[++index] ?? '';
		} else if (letter === 'j' && phpFormat[index + 1] === 'S') {
			flush();
			result += 'do';
			index++;
		} else if (TOKENS[letter]) {
			flush();
			result += TOKENS[letter];
		} else if (!/[a-zA-Z]/.test(letter)) {
			text += letter;
		}
	}
	flush();
	return result;
}

/** The value of the property as the Neos UI keeps it (and the DateTimeEditor of the Neos UI committed it) */
export const toValue = (date: Date) => formatDate(date, "yyyy-MM-dd'T'HH:mm:ssxxx");

/**
 * A date as it is shown and picked: a date without time is midnight UTC (as the editors of the Neos UI save it),
 * shown as that day wherever the editor is.
 */
export const toShown = (date: Date, kind: Kind) =>
	kind.time ? date : new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** A date shown and picked as it is saved (the reverse of toShown) */
export const fromShown = (date: Date, kind: Kind) =>
	kind.time ? date : new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

/** A value of the property (an ISO 8601 string, or a Date) as the date shown */
export function fromValue(value: unknown, kind: Kind): Date | null {
	const date = value instanceof Date ? value : typeof value === 'string' && value ? new Date(value) : null;
	return date && isValid(date) ? toShown(date, kind) : null;
}

/** The date shown as the value to commit (the reverse of fromValue) */
export const commitValue = (date: Date, kind: Kind) => toValue(fromShown(date, kind));

/** The moment.js tokens of the `labelFormat` of the DateInput of the Neos UI, as date-fns tokens */
const MOMENT_TOKENS: Record<string, string> = {
	YYYY: 'yyyy',
	YY: 'yy',
	MMMM: 'MMMM',
	MMM: 'MMM',
	MM: 'MM',
	M: 'M',
	Do: 'do',
	DD: 'dd',
	D: 'd',
	dddd: 'EEEE',
	ddd: 'EEE',
	dd: 'EEEEEE',
	E: 'i',
	HH: 'HH',
	H: 'H',
	hh: 'hh',
	h: 'h',
	mm: 'mm',
	m: 'm',
	ss: 'ss',
	s: 's',
	A: 'a',
	a: 'aaa',
	ZZ: 'xx',
	Z: 'xxx'
};

/** A moment.js format as a date-fns one: `[…]` and letters without a token stay text */
export function momentToDateFnsFormat(momentFormat: string): string {
	let result = '';
	let text = '';
	const flush = () => {
		if (text) {
			result += `'${text.replace(/'/g, "''")}'`;
			text = '';
		}
	};
	for (const token of momentFormat.match(/\[[^\]]*\]|YYYY|YY|MMMM|MMM|MM|M|Do|DD|D|dddd|ddd|dd|E|HH|H|hh|h|mm|m|ss|s|A|a|ZZ|Z|[^]/g) ?? []) {
		if (MOMENT_TOKENS[token]) {
			flush();
			result += MOMENT_TOKENS[token];
		} else if (token.startsWith('[')) {
			text += token.slice(1, -1);
		} else if (!/[a-zA-Z]/.test(token)) {
			text += token;
		}
	}
	flush();
	return result;
}

/** What a date-fns format shows: date, time, 12 hours, seconds */
export function kindOfDateFnsFormat(dateFnsFormat: string): Kind {
	const letters = dateFnsFormat.replace(/'[^']*'/g, '');
	return {
		date: /[yMLdEec]/.test(letters),
		time: /[hHkKms]/.test(letters),
		hour12: /[hK]/.test(letters) && !/[Hk]/.test(letters),
		seconds: /s/.test(letters)
	};
}

/**
 * A date-fns format as the formats of the date field and the time field (`dd. MMM yyyy, HH:mm` → `dd. MMM yyyy` and
 * `HH:mm`); the text between them is left out. Formats with the time first get formats of their own.
 */
export function splitFormat(dateFnsFormat: string, kind: Kind): {date: string; time: string} {
	const tokens = dateFnsFormat.match(/'(?:[^']|'')*'|([a-zA-Z])\1*|[^a-zA-Z']+/g) ?? [];
	const isTime = (token: string) => /^[hHkKmsaBb]/.test(token);
	const isDate = (token: string) => /^[a-zA-Z]/.test(token) && !isTime(token);
	const first = tokens.findIndex(isTime);
	const fallback = {date: 'dd.MM.yyyy', time: kind.seconds ? 'HH:mm:ss' : kind.hour12 ? 'hh:mm a' : 'HH:mm'};
	if (first < 0) {
		return {date: dateFnsFormat, time: fallback.time};
	}
	if (tokens.slice(first).some(isDate)) {
		return fallback;
	}
	const date = tokens.slice(0, first);
	// without the text between date and time (", ", " at ")
	while (date.length && !isDate(date[date.length - 1])) {
		date.pop();
	}
	return {date: date.join('') || fallback.date, time: tokens.slice(first).join('')};
}

/**
 * What an editor typed: in the format, also with one digit where it has two (`5.3.2026` for `d.m.Y`, `9:05` for `H:i`).
 * Parts the format has no tokens for come from the reference (the date of a time, the time of a date).
 */
export function parseTyped(
	text: string,
	dateFnsFormat: string,
	reference: Date,
	locale: Locale,
	alternatives: string[] = []
): Date | null {
	const loose = dateFnsFormat.replace(/(?<![a-zA-Z])(dd|MM|HH|hh|mm|ss)(?![a-zA-Z])/g, (token) => token[0]);
	for (const candidate of [dateFnsFormat, loose, ...alternatives]) {
		const date = parse(text.trim(), candidate, reference, {locale});
		// `yyyy` reads `26` as the year 26: then a candidate with two digits of the year
		if (isValid(date) && date.getFullYear() >= 100) {
			return date;
		}
	}
	return null;
}

/** A typed time: in the format of the time field, or as hours and minutes (`9`, `905`, `9.05`) */
export const parseTypedTime = (text: string, timeFormat: string, reference: Date, locale: Locale) =>
	parseTyped(text, timeFormat, reference, locale, ['H:mm', 'H.mm', 'Hmm', 'H', 'h:mm a', 'h a']);
