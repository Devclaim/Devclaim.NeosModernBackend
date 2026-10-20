import React, {type KeyboardEvent, useEffect, useRef} from 'react';

import type {Kind} from './format';

type Part = 'hours' | 'minutes' | 'seconds' | 'period';

type TimeColumnsProps = {
	/** the date of which the time is shown and changed (today, if there is none yet) */
	date: Date | null;
	kind: Kind;
	minuteStep: number;
	labels: Record<Part, string>;
	onChange(date: Date): void;
};

type Option = {value: number; label: string};

const pad = (number: number) => String(number).padStart(2, '0');
const range = (count: number, step = 1) => Array.from({length: Math.ceil(count / step)}, (_, index) => index * step);

/**
 * The time as columns beside the calendar: hours, minutes by the minute step (and seconds, AM/PM), each a list that
 * scrolls to its value. Arrow keys move through a column; times off the steps can be typed into the time field.
 */
export function TimeColumns({date, kind, minuteStep, labels, onChange}: TimeColumnsProps) {
	const hours = date?.getHours();
	const now = new Date();

	const set = (part: Part, value: number) => {
		const next = date ? new Date(date) : startOfToday();
		if (part === 'hours') {
			next.setHours(kind.hour12 ? (value % 12) + (next.getHours() >= 12 ? 12 : 0) : value);
		} else if (part === 'period') {
			next.setHours((next.getHours() % 12) + value);
		} else if (part === 'minutes') {
			next.setMinutes(value);
		} else {
			next.setSeconds(value);
		}
		onChange(next);
	};

	/** the steps, and the value of the date where it is off them (14:07 with steps of 5 minutes) */
	const withValue = (values: number[], value: number | undefined) =>
		value === undefined || values.includes(value) ? values : [...values, value].sort((a, b) => a - b);

	// current: where a column without a value starts (at the time now)
	const columns: Array<{part: Part; options: Option[]; selected: number | undefined; current: number}> = [
		kind.hour12
			? {
					part: 'hours',
					options: [12, ...range(12).slice(1)].map((hour) => ({value: hour % 12, label: String(hour)})),
					selected: hours === undefined ? undefined : hours % 12,
					current: now.getHours() % 12
				}
			: {
					part: 'hours',
					options: range(24).map((hour) => ({value: hour, label: pad(hour)})),
					selected: hours,
					current: now.getHours()
				},
		{
			part: 'minutes',
			options: withValue(range(60, minuteStep), date?.getMinutes()).map((minute) => ({value: minute, label: pad(minute)})),
			selected: date?.getMinutes(),
			current: now.getMinutes()
		}
	];
	if (kind.seconds) {
		columns.push({
			part: 'seconds',
			options: range(60).map((second) => ({value: second, label: pad(second)})),
			selected: date?.getSeconds(),
			current: 0
		});
	}
	if (kind.hour12) {
		columns.push({
			part: 'period',
			options: [
				{value: 0, label: 'AM'},
				{value: 12, label: 'PM'}
			],
			selected: hours === undefined ? undefined : hours >= 12 ? 12 : 0,
			current: now.getHours() >= 12 ? 12 : 0
		});
	}

	return (
		<div className="devclaim-date-time__time">
			{columns.map((column) => (
				<TimeColumn
					key={column.part}
					label={labels[column.part]}
					options={column.options}
					selected={column.selected}
					current={column.current}
					onSelect={(value) => set(column.part, value)}
				/>
			))}
		</div>
	);
}

type TimeColumnProps = {
	label: string;
	options: Option[];
	selected: number | undefined;
	/** the value of now: where the column starts without a value */
	current: number;
	onSelect(value: number): void;
};

function TimeColumn({label, options, selected, current, onSelect}: TimeColumnProps) {
	const list = useRef<HTMLDivElement>(null);
	// picked in this column: the list stays where it is (it does not jump under the pointer)
	const isPickedHere = useRef(false);

	// the selected option (or the one of now) in the middle of the list, without scrolling the page: when the popover
	// opens (after it is shown, by the layout effect of the picker) and when the time is set elsewhere (now, typed)
	useEffect(() => {
		if (isPickedHere.current) {
			isPickedHere.current = false;
			return;
		}
		const element = list.current;
		const option =
			element?.querySelector<HTMLElement>('[aria-selected="true"]') ??
			element?.querySelector<HTMLElement>(`[data-now="true"]`);
		if (element && option) {
			element.scrollTop = option.offsetTop - element.clientHeight / 2 + option.offsetHeight / 2;
		}
	}, [selected]);

	const nowIndex = nearest(options, current);
	const select = (value: number) => {
		isPickedHere.current = value !== selected;
		onSelect(value);
	};
	const focusable = selected === undefined ? nowIndex : options.findIndex((option) => option.value === selected);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step = {ArrowDown: 1, ArrowUp: -1}[event.key];
		if (!step) {
			return;
		}
		event.preventDefault();
		const index = Math.min(Math.max(focusable + step, 0), options.length - 1);
		select(options[index].value);
		// focused: scrolled into view as far as needed
		requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
	};

	return (
		<div className="devclaim-date-time__column">
			<div className="devclaim-date-time__columnLabel">{label}</div>
			<div ref={list} className="devclaim-date-time__options" role="listbox" aria-label={label} onKeyDown={onKeyDown}>
				{options.map((option, index) => (
					<button
						key={option.value}
						type="button"
						role="option"
						className="devclaim-date-time__option"
						aria-selected={option.value === selected}
						data-now={selected === undefined && index === nowIndex}
						tabIndex={index === focusable ? 0 : -1}
						onClick={() => select(option.value)}
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	);
}

/** the index of the option nearest to a value */
function nearest(options: Option[], value: number) {
	let best = 0;
	options.forEach((option, index) => {
		if (Math.abs(option.value - value) < Math.abs(options[best].value - value)) {
			best = index;
		}
	});
	return best;
}

function startOfToday() {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return today;
}
