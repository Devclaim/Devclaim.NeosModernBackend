/** Everything this package does in one document of the content frame */
import {ATTRIBUTE, cssVariables, FOCUSED, HOVERED} from './constants';
import {DragAndDrop} from './dragAndDrop';
import {hideStaleEditorToolbars} from './editorToolbars';
import type {FrameWindow} from './guestFrame';
import {insertBeforeOrAfterByHalves} from './insertPosition';
import type {Neos} from './neos';
import {closeMenuAfterAction, syncNodeToolbar} from './nodeToolbar';
import type {Options} from './options';
import {Outline} from './outline';
import {syncPlaceholders} from './placeholders';
import {Toolbars} from './toolbars';
import ckeditorStyles from './styles/ckeditor.css';
import dragStyles from './styles/drag.css';
import nodeToolbarStyles from './styles/node-toolbar.css';
import placeholderStyles from './styles/placeholders.css';
import outlineStyles from './styles/outline.css';

export function attach(win: FrameWindow, options: Options, neos: Neos): void {
	const doc = win.document;
	const root = doc.documentElement;
	if (!root || root.hasAttribute(`${ATTRIBUTE}-attached`)) {
		return;
	}
	root.setAttribute(`${ATTRIBUTE}-attached`, '');

	const style = doc.createElement('style');
	style.textContent = [outlineStyles, nodeToolbarStyles, ckeditorStyles, placeholderStyles, dragStyles].join('\n');
	// also while the page still loads (no <head> yet: on <html>)
	(doc.head ?? root).appendChild(style);
	for (const [name, value] of Object.entries(cssVariables(options.animate ? options.duration : 0))) {
		root.style.setProperty(name, value);
	}

	// a child of <html> before <body>: the layout of the page stays as it is, and the anchor of the toolbars comes
	// before them (in the body) in tree order
	const layer = doc.createElement('div');
	layer.setAttribute(ATTRIBUTE, '');
	layer.setAttribute('aria-hidden', 'true');
	root.insertBefore(layer, doc.body ?? null);

	const outline = new Outline(layer, win, options);
	const toolbars = new Toolbars(win);
	insertBeforeOrAfterByHalves(win, () => outline.focusedElement);
	closeMenuAfterAction(win);
	const dragAndDrop = options.dragAndDrop ? new DragAndDrop(win, neos, layer, () => outline.focusedElement, () => schedule()) : null;

	// the selected and the hovered node change size (inline editing, images loading)
	let observed: Element[] = [];
	const resizeObserver = new win.ResizeObserver(() => schedule());
	const observe = (elements: Element[]) => {
		if (elements.length === observed.length && elements.every((element, i) => element === observed[i])) {
			return;
		}
		resizeObserver.disconnect();
		observed = elements;
		observed.forEach((element) => resizeObserver.observe(element));
	};

	const update = () => {
		frame = 0;
		hideStaleEditorToolbars(doc);
		syncPlaceholders(doc, neos);
		const focused = doc.querySelector<HTMLElement>(FOCUSED);
		const hovered = doc.querySelector<HTMLElement>(HOVERED);
		const placed = outline.placeFocus(focused);
		if (focused && placed) {
			toolbars.place(placed.rect, placed.toNode);
			syncNodeToolbar(doc, focused, neos);
		}
		// no hover outline while dragging
		outline.placeHover(hovered === focused || dragAndDrop?.dragging ? null : hovered);
		observe([focused, hovered].filter((element): element is HTMLElement => element !== null));
	};
	let frame = 0;
	const schedule = () => {
		frame ||= win.requestAnimationFrame(update);
	};

	// the marker classes, inline editing and anything else that moves the nodes (not the layer itself); the placeholders
	// here, before the change is painted (new and re-rendered properties, CKEditor starting, typing)
	new win.MutationObserver((mutations) => {
		if (mutations.some((mutation) => !layer.contains(mutation.target))) {
			syncPlaceholders(doc, neos);
			schedule();
		}
	}).observe(root, {attributes: true, attributeFilter: ['class', 'style'], childList: true, subtree: true, characterData: true});
	// the Neos UI loaded the data of the nodes of the page: the placeholders of the ones it did not know yet
	const unsubscribe = neos.store.subscribe(() => syncPlaceholders(doc, neos));
	win.addEventListener('pagehide', unsubscribe, {once: true});
	syncPlaceholders(doc, neos);
	// page coordinates: scrolling only matters for the clamp to the visible width and where the toolbars go
	win.addEventListener('scroll', schedule, {capture: true, passive: true});
	win.addEventListener('resize', schedule, {passive: true});
	// the focus moves between texts and the toolbars of CKEditor
	doc.addEventListener('focusin', schedule);
	// images, fonts and the like change the layout once they are loaded
	doc.addEventListener('load', schedule, true);
	doc.fonts?.ready.then(schedule);
	win.addEventListener('transitionend', schedule, {passive: true});
	schedule();
}
