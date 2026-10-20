import React, {type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {DayPicker} from 'react-day-picker';
import {format as formatDate} from 'date-fns';
import {Icon} from '@neos-project/react-ui-components';

import type {Neos} from '../neos';
import {type Kind, parseTypedTime, splitFormat} from './format';
import {localeOf} from './locale';
import {TimeColumns} from './TimeColumns';

export type DateTimePickerProps = {
	id?: string;
	/** the date shown (a date without time: its day, at midnight where the editor is) */
	date: Date | null;
	onChange(date: Date | null): void;
	/** a date-fns format: its date part is shown in the date field, its time part in the time field */
	format: string;
	kind: Kind;
	placeholder: string;
	minuteStep: number;
	disabled?: boolean;
	className?: string;
	/** a further class of the clear button (the `theme` of the DateInput of the Neos UI: plugins hide it by it) */
	classNames?: {clear?: string};
};

type UserState = {user?: {preferences?: {interfaceLanguage?: string}}};
type Field = 'date' | 'time';

/** The years in the year dropdown of the calendar (and the dates it allows to pick) */
const START_MONTH = new Date(1900, 0);
const END_MONTH = new Date(new Date().getFullYear() + 30, 11);
/** px between the fields and the popover, and kept free to the edge of the window */
const GAP = 4;
const MARGIN = 8;
const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

/**
 * A date field and a time field side by side, with one popover for both: the calendar of react-day-picker and the
 * time as columns beside it, applied with its done button (Enter); the time can be typed too.
 * The popover floats in the top layer of the page, so it never changes the height of the inspector nor is cut off by
 * it. Used by the DateTimeEditor and in place of the DateInput of the Neos UI (src/dateTime/index.ts).
 */
export function createDateTimePicker(getNeos: () => Neos) {
	return function DateTimePicker({
		id,
		date,
		onChange,
		format,
		kind,
		placeholder,
		minuteStep,
		disabled = false,
		className: additionalClassName,
		classNames = {}
	}: DateTimePickerProps) {
		const neos = getNeos();
		const t = (key: string, fallback: string) => neos.i18n.translate(`Devclaim.NeosModernBackend:Main:dateTime.${key}`, fallback);
		// read, not subscribed: the interface language changes with a reload (and plugins may render it outside of redux)
		const language = (neos.store.getState() as UserState).user?.preferences?.interfaceLanguage;
		const locale = useMemo(() => localeOf(language), [language]);
		const formats = useMemo(() => splitFormat(format, kind), [format, kind]);
		// for screen readers, in the language of the interface (date-fns would label in English)
		const labels = useMemo(() => {
			const day = new Intl.DateTimeFormat(locale.code, {dateStyle: 'full'});
			return {
				labelDayButton: (date: Date, modifiers: Record<string, boolean>) =>
					modifiers.today ? `${t('today', 'Today')}, ${day.format(date)}` : day.format(date),
				labelPrevious: () => t('previousMonth', 'Previous month'),
				labelNext: () => t('nextMonth', 'Next month'),
				labelMonthDropdown: () => t('month', 'Month'),
				labelYearDropdown: () => t('year', 'Year')
			};
		}, [locale]);

		const [isOpen, setOpen] = useState(false);
		const [month, setMonth] = useState<Date>(date ?? new Date());
		// what is picked in the popover, until it is applied (undefined: the popover is closed)
		const [pending, setPending] = useState<Date | null | undefined>(undefined);
		// what is typed into the time field, until it is left or Enter is pressed; invalid: it cannot be read
		const [typed, setTyped] = useState<string | undefined>(undefined);
		const [isInvalid, setInvalid] = useState(false);
		const root = useRef<HTMLDivElement>(null);
		const fields = useRef<HTMLDivElement>(null);
		const popover = useRef<HTMLDivElement>(null);
		const inputs = {date: useRef<HTMLInputElement>(null), time: useRef<HTMLInputElement>(null)};

		/** the date shown: the one picked, while the popover is open */
		const current = pending !== undefined ? pending : date;
		const shown: Record<Field, string> = {
			date: current ? formatDate(current, formats.date, {locale}) : '',
			time: current ? formatDate(current, formats.time, {locale}) : ''
		};

		const open = () => {
			if (!disabled && !isOpen) {
				setMonth(date ?? new Date());
				setPending(date);
				setOpen(true);
			}
		};
		/** closed without applying what was picked */
		const cancel = () => {
			setPending(undefined);
			setTyped(undefined);
			setInvalid(false);
			setOpen(false);
		};
		const change = (next: Date | null) => {
			setTyped(undefined);
			setInvalid(false);
			onChange(next);
		};
		/** what is picked: shown until it is applied (while the popover is open), else the value */
		const pick = (next: Date | null) => {
			if (isOpen) {
				setTyped(undefined);
				setInvalid(false);
				setPending(next);
			} else {
				change(next);
			}
		};
		const confirm = () => {
			if (pending !== undefined && pending?.getTime() !== date?.getTime()) {
				change(pending);
			}
			setPending(undefined);
			setOpen(false);
		};

		// closed by a click outside of the fields and the popover (the popover is in the element, also in the top layer)
		useEffect(() => {
			if (!isOpen) {
				return undefined;
			}
			const onMouseDown = (event: MouseEvent) => {
				if (!root.current?.contains(event.target as Node)) {
					cancel();
				}
			};
			document.addEventListener('mousedown', onMouseDown);
			return () => document.removeEventListener('mousedown', onMouseDown);
		}, [isOpen]);

		// below the fields, at their right edge (above them where there is no room below), following them on scroll
		useLayoutEffect(() => {
			const element = popover.current;
			const anchor = fields.current;
			if (!isOpen || !element || !anchor) {
				return undefined;
			}
			if (supportsPopover) {
				element.showPopover();
			}
			const place = () => {
				const rect = anchor.getBoundingClientRect();
				const {offsetWidth: width, offsetHeight: height} = element;
				const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - MARGIN;
				const top = fitsBelow || rect.top - GAP - height < MARGIN ? rect.bottom + GAP : rect.top - GAP - height;
				const left = Math.max(MARGIN, Math.min(rect.right - width, window.innerWidth - MARGIN - width));
				element.style.minWidth = `${rect.width}px`;
				element.style.top = `${top}px`;
				element.style.left = `${left}px`;
			};
			place();
			window.addEventListener('scroll', place, true);
			window.addEventListener('resize', place);
			return () => {
				window.removeEventListener('scroll', place, true);
				window.removeEventListener('resize', place);
				if (supportsPopover && element.matches(':popover-open')) {
					element.hidePopover();
				}
			};
		}, [isOpen]);

		/** the time typed as the time: empty clears the value, what cannot be read stays (red) to be corrected */
		const applyTyped = () => {
			if (typed === undefined || typed === shown.time) {
				setTyped(undefined);
				return true;
			}
			if (!typed.trim()) {
				pick(null);
				return true;
			}
			const time = parseTypedTime(typed, formats.time, current ?? defaultDate(kind, minuteStep), locale);
			if (!time) {
				setInvalid(true);
				return false;
			}
			pick(time);
			return true;
		};

		const focusPopover = (field: Field) =>
			requestAnimationFrame(() =>
				popover.current
					?.querySelector<HTMLElement>(
						field === 'date'
							? '.rdp-selected .rdp-day_button, .rdp-today .rdp-day_button, .rdp-day_button'
							: '.devclaim-date-time__option[tabindex="0"]'
					)
					?.focus()
			);

		const onKeyDown = (field: Field) => (event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				open();
				focusPopover(field);
			} else if (event.key === 'Enter') {
				event.preventDefault();
				// the time: what is typed, and applied with what is picked
				if (field === 'time') {
					if (applyTyped() && isOpen) {
						confirm();
					}
				} else if (isOpen) {
					confirm();
				} else {
					open();
				}
			} else if (field === 'date' && event.key === ' ') {
				event.preventDefault();
				open();
			}
		};

		/** a day picked in the calendar, at the time already set (or the time of now, by the minute step) */
		const pickDay = (day: Date | undefined) => {
			if (!day) {
				return;
			}
			const time = current ?? defaultDate(kind, minuteStep);
			day.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
			pick(day);
		};

		const now = () => {
			const today = new Date();
			if (!kind.seconds) {
				today.setSeconds(0, 0);
			}
			pick(today);
			setMonth(today);
		};

		const renderField = (field: Field) => {
			// the date is picked in the calendar, the time typed (or picked)
			const isTyped = field === 'time';
			return (
				<div
					className={classes(
						`devclaim-date-time__field devclaim-date-time__field--${field}`,
						isTyped && 'devclaim-date-time__field--typed',
						isTyped && isInvalid && 'devclaim-date-time__field--invalid'
					)}
					onMouseDown={(event) => {
						// the whole field opens the popover and focuses its input (also the icon), the clear button does not
						if ((event.target as Element).closest('button')) {
							return;
						}
						if (event.target !== inputs[field].current) {
							event.preventDefault();
							inputs[field].current?.focus();
						}
						open();
					}}
				>
					<Icon icon={field === 'date' ? 'far calendar-alt' : 'far clock'} className="devclaim-date-time__icon" />
					<input
						ref={inputs[field]}
						id={field === 'date' || !kind.date ? id : undefined}
						type="text"
						autoComplete="off"
						spellCheck={false}
						readOnly={!isTyped}
						disabled={disabled}
						placeholder={field === 'date' || !kind.date ? placeholder : '--:--'}
						aria-label={field === 'date' ? t('date', 'Date') : t('time', 'Time')}
						aria-haspopup="dialog"
						aria-expanded={isOpen}
						aria-invalid={(isTyped && isInvalid) || undefined}
						value={isTyped && typed !== undefined ? typed : shown[field]}
						onChange={(event) => {
							setTyped(event.target.value);
							setInvalid(false);
						}}
						onKeyDown={onKeyDown(field)}
						onBlur={isTyped ? applyTyped : undefined}
					/>
					{field === 'date' && date && !disabled && (
						<button
							type="button"
							className={classes('devclaim-date-time__clear', classNames.clear)}
							title={t('clear', 'Clear')}
							aria-label={t('clear', 'Clear')}
							onClick={() => {
								cancel();
								change(null);
							}}
						>
							<Icon icon="times" />
						</button>
					)}
				</div>
			);
		};

		return (
			<div
				ref={root}
				className={classes(
					additionalClassName,
					'devclaim-date-time',
					isOpen && 'devclaim-date-time--open',
					disabled && 'devclaim-date-time--disabled'
				)}
				onKeyDown={(event) => {
					if (event.key === 'Escape' && isOpen) {
						event.stopPropagation();
						cancel();
					}
				}}
			>
				<div ref={fields} className="devclaim-date-time__fields">
					{kind.date && renderField('date')}
					{kind.time && renderField('time')}
				</div>
				{isOpen && (
					<div
						ref={popover}
						className="devclaim-date-time__popover"
						role="dialog"
						{...(supportsPopover ? {popover: 'manual'} : {})}
					>
						<div className="devclaim-date-time__body">
							{kind.date && (
								<DayPicker
									mode="single"
									className="devclaim-date-time__calendar"
									selected={current ?? undefined}
									onSelect={pickDay}
									month={month}
									onMonthChange={setMonth}
									locale={locale}
									labels={labels}
									captionLayout="dropdown"
									navLayout="around"
									startMonth={START_MONTH}
									endMonth={END_MONTH}
									showOutsideDays
									fixedWeeks
									components={{
										// month and year are words to click (their dropdowns without a chevron), the arrows of the navigation
										Chevron: ({orientation}) =>
											orientation === 'left' || orientation === 'right' ? <Icon icon={`chevron-${orientation}`} /> : <></>
									}}
								/>
							)}
							{kind.time && (
								<TimeColumns
									date={current}
									kind={kind}
									minuteStep={minuteStep}
									labels={{
										hours: t('hoursShort', 'Hr'),
										minutes: t('minutesShort', 'Min'),
										seconds: t('secondsShort', 'Sec'),
										period: ''
									}}
									onChange={pick}
								/>
							)}
						</div>
						<div className="devclaim-date-time__footer">
							<button
								type="button"
								className="devclaim-date-time__button"
								onClick={now}
							>
								{kind.time ? t('now', 'Now') : t('today', 'Today')}
							</button>
							<button type="button" className="devclaim-date-time__button" onClick={confirm}>
								{t('done', 'Done')}
							</button>
						</div>
					</div>
				)}
			</div>
		);
	};
}

const classes = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ');

/** The date a time is set on or a day is picked at, without a value yet: today, the time now (by the minute step) */
function defaultDate(kind: {time: boolean}, minuteStep: number) {
	const date = new Date();
	date.setSeconds(0, 0);
	date.setMinutes(Math.floor(date.getMinutes() / minuteStep) * minuteStep);
	if (!kind.time) {
		date.setHours(0, 0);
	}
	return date;
}
