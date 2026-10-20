import React, {type ComponentType, useMemo} from 'react';

import type {DateTimePickerProps} from './DateTimePicker';
import {fromShown, kindOfDateFnsFormat, momentToDateFnsFormat, toShown} from './format';

/** The props of the DateInput of the Neos UI (@neos-project/react-ui-components) */
export type DateInputProps = {
	value?: Date | string | null;
	onChange(date: Date | null): void;
	id?: string;
	className?: string;
	placeholder?: string;
	/** a moment.js format */
	labelFormat?: string;
	dateOnly?: boolean;
	timeOnly?: boolean;
	is24Hour?: boolean;
	timeConstraints?: {minutes?: {step?: number}};
	disabled?: boolean;
	theme?: {closeCalendarIconBtn?: string};
};

/**
 * The DateInput of the Neos UI, as plugins use it (e.g. the occurrences of NeosSvelte.Events): same props, the picker
 * of this package. A date only is midnight UTC (as react-datetime picks it in the DateInput of the Neos UI).
 */
export function createDateInput(DateTimePicker: ComponentType<DateTimePickerProps>) {
	return function DateInput({
		value,
		onChange,
		id,
		className,
		placeholder = '',
		labelFormat = 'DD-MM-YYYY hh:mm A',
		dateOnly,
		timeOnly,
		is24Hour,
		timeConstraints,
		disabled,
		theme
	}: DateInputProps) {
		const format = useMemo(() => momentToDateFnsFormat(labelFormat), [labelFormat]);
		const kind = useMemo(() => {
			const shown = kindOfDateFnsFormat(format);
			return {
				date: !timeOnly,
				time: !dateOnly,
				// the time as the format shows it; without time in the format, as is24Hour says
				hour12: shown.time ? shown.hour12 : !is24Hour,
				seconds: shown.seconds
			};
		}, [format, dateOnly, timeOnly, is24Hour]);
		const parsed = value ? new Date(value) : null;
		const date = parsed && !Number.isNaN(parsed.getTime()) ? toShown(parsed, kind) : null;

		return (
			<DateTimePicker
				id={id}
				className={className}
				date={date}
				onChange={(next) => onChange(next ? fromShown(next, kind) : null)}
				format={format}
				kind={kind}
				placeholder={placeholder}
				minuteStep={timeConstraints?.minutes?.step ?? 5}
				disabled={disabled}
				// the today button stays: the picked date is applied with the done button, today is one click less
				classNames={{clear: theme?.closeCalendarIconBtn}}
			/>
		);
	};
}
