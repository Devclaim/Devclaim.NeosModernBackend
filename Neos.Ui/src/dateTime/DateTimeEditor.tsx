import React, {type ComponentType, useMemo} from 'react';

import type {Neos} from '../neos';
import type {DateTimePickerProps} from './DateTimePicker';
import {commitValue, fromValue, kindOf, toDateFnsFormat} from './format';

/** The props of an editor of the inspector (and the creation dialog) of the Neos UI */
type EditorProps = {
	id?: string;
	value?: unknown;
	commit(value: string): void;
	options?: {format?: string; placeholder?: string; minuteStep?: number; disabled?: boolean};
};

/**
 * The DateTimeEditor of Neos (`Neos.Neos/Inspector/Editors/DateTimeEditor`): the format in PHP date() letters, the
 * value an ISO 8601 string (a date without time is midnight UTC), as the editor of the Neos UI keeps it.
 */
export function createDateTimeEditor(neos: Neos, DateTimePicker: ComponentType<DateTimePickerProps>) {
	return function DateTimeEditor({id, value, commit, options = {}}: EditorProps) {
		const phpFormat = options.format || 'd-m-Y';
		const kind = useMemo(() => kindOf(phpFormat), [phpFormat]);
		const format = useMemo(() => toDateFnsFormat(phpFormat), [phpFormat]);
		const placeholder = neos.i18n.translate(
			options.placeholder || 'Neos.Neos.Ui:Main:inspector.editors.dateTimeEditor.noDateSet',
			options.placeholder || 'No date set'
		);

		return (
			<DateTimePicker
				id={id}
				date={fromValue(value, kind)}
				onChange={(date) => commit(date ? commitValue(date, kind) : '')}
				format={format}
				kind={kind}
				placeholder={placeholder}
				minuteStep={options.minuteStep && options.minuteStep > 0 ? options.minuteStep : 5}
				disabled={options.disabled}
			/>
		);
	};
}
