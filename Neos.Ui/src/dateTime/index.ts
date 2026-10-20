import React, {type ComponentType} from 'react';

import type {Neos} from '../neos';
import dateTimeStyles from '../styles/date-time.css';
import {createDateInput, type DateInputProps} from './DateInput';
import {createDateTimeEditor} from './DateTimeEditor';
import {createDateTimePicker} from './DateTimePicker';

/** The editor registry of the Neos UI ('inspector' → 'editors') */
export type Editors = {
	set(key: string, editor: {component: ComponentType<any>}): void;
};

type HostPluginApi = Record<string, ((...args: unknown[]) => Record<string, unknown>) | undefined>;

/** set by registerDateTimeEditor (the bootstrap of the plugin); null: the pickers of the Neos UI stay */
let neos: Neos | null = null;
const DateTimePicker = createDateTimePicker(() => neos!);

/**
 * The DateInput of the Neos UI, as other plugins get it through the plugin API of the Neos UI (window['@Neos:HostPluginAPI']
 * ['@NeosProjectPackages']().ReactUiComponents), replaced by the picker of this package: plugins that render it as
 * a part of their own editors (e.g. the occurrences of NeosSvelte.Events) get it too.
 *
 * Has to run when this script is loaded, before the plugins that read it (Configuration/Settings.yaml: right after
 * Host.js). Its own editors of the Neos UI are not touched by it (see registerDateTimeEditor).
 */
export function replaceDateInputOfPlugins() {
	const api = (window as unknown as {'@Neos:HostPluginAPI'?: HostPluginApi})['@Neos:HostPluginAPI'];
	const packages = api?.['@NeosProjectPackages'];
	if (!api || !packages) {
		return;
	}
	const original = packages().ReactUiComponents as Record<string, unknown> | undefined;
	const OriginalDateInput = original?.DateInput as ComponentType<DateInputProps> | undefined;
	if (!original || !OriginalDateInput) {
		return;
	}
	const NewDateInput = createDateInput(DateTimePicker);
	// the setting is known with the bootstrap only, after the plugins read the component: decided when rendered
	const DateInput = (props: DateInputProps) => React.createElement(neos ? NewDateInput : OriginalDateInput, props);
	const ReactUiComponents = {...original, DateInput};

	// the entries of the plugin API are read-only, but configurable (neos-ui-extensibility/src/createConsumerApi.ts)
	Object.defineProperty(api, '@NeosProjectPackages', {
		value: (...args: unknown[]) => ({...packages(...args), ReactUiComponents}),
		writable: false,
		enumerable: false,
		configurable: true
	});
}

/** The DateTimeEditor of this package instead of the one of the Neos UI (in the inspector and the creation dialog) */
export function registerDateTimeEditor(editors: Editors, host: Neos) {
	neos = host;
	editors.set('Neos.Neos/Inspector/Editors/DateTimeEditor', {component: createDateTimeEditor(host, DateTimePicker)});

	const style = document.createElement('style');
	style.textContent = dateTimeStyles;
	document.head.appendChild(style);
}
