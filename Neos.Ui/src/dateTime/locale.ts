import type {Day, Locale, LocaleWidth, Month} from 'date-fns';
import {enUS} from 'date-fns/locale/en-US';

type Names = {formatting: string[]; standalone: string[]};

const MONTHS = Array.from({length: 12}, (_, month) => new Date(2001, month, 15));
// 2001-01-07 is a Sunday: the days in the order of date-fns (0 = Sunday)
const DAYS = Array.from({length: 7}, (_, day) => new Date(2001, 0, 7 + day));

const part = (date: Date, type: Intl.DateTimeFormatPartTypes, format: Intl.DateTimeFormat) =>
	format.formatToParts(date).find((part) => part.type === type)?.value ?? '';

/**
 * A date-fns locale of an interface language of the Neos UI (`de`, `pt_BR`, `zh-Hant`, …) by the Intl API of the
 * browser: the names of months and days (formatted and parsed), the first day of the week. The rest (ordinal numbers,
 * the long formats of the labels for screen readers) stays English; the locales of date-fns would be 250 kB.
 */
export function localeOf(language: string | undefined): Locale {
	const code = (language || 'en').replace('_', '-');
	let tag: string;
	try {
		tag = Intl.getCanonicalLocales(code)[0] ?? 'en';
	} catch {
		tag = 'en';
	}

	const months = (style: 'long' | 'short' | 'narrow'): Names => ({
		// in a date, many languages decline the month (Polish "października", alone "październik")
		formatting: MONTHS.map((date) => part(date, 'month', new Intl.DateTimeFormat(tag, {day: 'numeric', month: style}))),
		standalone: MONTHS.map((date) => part(date, 'month', new Intl.DateTimeFormat(tag, {month: style})))
	});
	const days = (style: 'long' | 'short' | 'narrow'): string[] =>
		DAYS.map((date) => part(date, 'weekday', new Intl.DateTimeFormat(tag, {weekday: style})));
	const monthNames: Record<LocaleWidth, Names> = {
		wide: months('long'),
		abbreviated: months('short'),
		short: months('short'),
		narrow: months('narrow'),
		any: months('long')
	};
	const dayNames: Record<LocaleWidth, string[]> = {
		wide: days('long'),
		abbreviated: days('short'),
		// the headers of the calendar: without the dot of the abbreviation ("Mo." in German)
		short: days('short').map((name) => name.replace(/\.$/, '')),
		narrow: days('narrow'),
		any: days('long')
	};
	const hour12 = new Intl.DateTimeFormat(tag, {hour: 'numeric', hour12: true});
	const dayPeriods = {
		am: part(new Date(2001, 0, 1, 9), 'dayPeriod', hour12) || 'AM',
		pm: part(new Date(2001, 0, 1, 21), 'dayPeriod', hour12) || 'PM'
	};

	/** the longest of the names at the start of a typed text (any case) */
	const matchName = (text: string, names: string[]) => {
		const lower = text.toLowerCase();
		let match: {index: number; length: number} | null = null;
		names.forEach((name, index) => {
			if (name && lower.startsWith(name.toLowerCase()) && name.length > (match?.length ?? 0)) {
				match = {index, length: name.length};
			}
		});
		return match as {index: number; length: number} | null;
	};

	return {
		...enUS,
		code: tag,
		options: {...enUS.options, weekStartsOn: weekStart(tag)},
		localize: {
			...enUS.localize,
			month: (month, options) => monthNames[options?.width ?? 'wide'][options?.context ?? 'formatting'][month],
			day: (day, options) => dayNames[options?.width ?? 'wide'][day],
			dayPeriod: (period, options) => {
				const name = period === 'am' || period === 'pm' ? dayPeriods[period] : enUS.localize.dayPeriod(period, options);
				return options?.width === 'narrow' ? name.toLowerCase() : name;
			}
		},
		match: {
			...enUS.match,
			month: (text) => {
				const all = Object.values(monthNames).flatMap((names) => [...names.formatting, ...names.standalone]);
				const match = matchName(text, all);
				return match ? {value: (match.index % 12) as Month, rest: text.slice(match.length)} : null;
			},
			day: (text) => {
				const match = matchName(text, Object.values(dayNames).flat());
				return match ? {value: (match.index % 7) as Day, rest: text.slice(match.length)} : null;
			}
		}
	};
}

/** The first day of the week of a language (0 = Sunday): by Intl where the browser knows it, else Monday */
function weekStart(tag: string): Day {
	try {
		const locale = new Intl.Locale(tag) as Intl.Locale & {getWeekInfo?(): {firstDay: number}; weekInfo?: {firstDay: number}};
		const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay;
		if (firstDay) {
			return (firstDay % 7) as Day;
		}
	} catch {
		// an unknown language
	}
	return tag.startsWith('en') ? 0 : 1;
}
