import {SWITCH_FADE} from './constants';

/**
 * Sets an attribute on an element to a value (e.g. where the tab is); a change fades out first (hiddenAttribute,
 * styles/node-toolbar.css), then moves and fades in again. Back to the shown value while fading out: it fades in again.
 * Returns the setter; immediate: no fade (another node).
 */
export function createFadeSwitch(win: Window, element: HTMLElement, attribute: string, hiddenAttribute: string) {
	let shown: string | null = null;
	let target: string | null = null;
	let timer = 0;

	const show = (value: string) => {
		shown = value;
		element.setAttribute(attribute, value);
	};
	const stopFading = () => {
		win.clearTimeout(timer);
		timer = 0;
		element.removeAttribute(hiddenAttribute);
	};

	return (value: string, immediate: boolean) => {
		target = value;
		if (immediate || shown === null) {
			stopFading();
			show(value);
			return;
		}
		if (value === shown) {
			if (timer) {
				stopFading();
			}
			return;
		}
		if (timer) {
			// fading out already: it moves to the latest target
			return;
		}
		element.setAttribute(hiddenAttribute, '');
		timer = win.setTimeout(() => {
			timer = 0;
			show(target as string);
			win.requestAnimationFrame(() => element.removeAttribute(hiddenAttribute));
		}, SWITCH_FADE);
	};
}
