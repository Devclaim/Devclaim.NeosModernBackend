/**
 * The boxes around the selected and the hovered node: in a layer of their own (styles/outline.css), so overflow,
 * the frame and positioned content of the node cannot hide them.
 */
import {HIDE_DELAY, SHINE_THROUGH} from './constants';
import type {Options} from './options';

/** A box in page coordinates */
export type Rect = {x: number; y: number; width: number; height: number};

/**
 * The box around an element, null if it is not shown. Offset around the element, but kept inside the visible width and
 * the page (a gap to their edge): a node over the whole width keeps its outline, a node scrolled partly out of view
 * keeps its edge where it is.
 */
export function boxFor(element: Element | null, win: Window, options: Options): Rect | null {
	if (!element?.isConnected) {
		return null;
	}
	const rect = element.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) {
		return null;
	}
	const root = win.document.documentElement;
	const {offset, gap} = options;
	const left = Math.max(rect.left + win.scrollX - offset, win.scrollX + gap);
	const right = Math.min(rect.right + win.scrollX + offset, win.scrollX + root.clientWidth - gap);
	const top = Math.max(rect.top + win.scrollY - offset, gap);
	const bottom = Math.min(rect.bottom + win.scrollY + offset, root.scrollHeight - gap);

	return {x: left, y: top, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0)};
}

/** One box: shown around an element, moved (animated) or put there at once */
class OutlineBox {
	element: HTMLElement | null = null;
	private hideTimer = 0;
	private moving = false;
	private movingTimer = 0;
	private geometry = '';

	constructor(
		readonly box: HTMLElement,
		private readonly win: Window,
		private readonly options: Options,
		/** moved from node to node (the selected one) or always there at once (the hovered ones fade) */
		private readonly animated: boolean
	) {}

	get visible(): boolean {
		return this.box.hasAttribute('data-visible');
	}

	/** Around the element; returns where, and whether it is another node than before (null: nothing shown) */
	place(element: HTMLElement | null): {rect: Rect; toNode: boolean} | null {
		const rect = boxFor(element, this.win, this.options);
		if (!element || !rect) {
			// the Neos UI takes the class from one node before it gives it to the next: hidden only if no node follows
			// shortly, so the box can move over to it
			if (this.visible && !this.hideTimer) {
				this.hideTimer = this.win.setTimeout(() => this.hide(), HIDE_DELAY);
			}
			return null;
		}
		this.cancelHide();

		// animated only from node to node; appearing and resizing: at once (no trailing behind). While it moves to a
		// node, updates (the Neos UI renders its toolbar, the page changes) only retarget the movement: switching the
		// transition off would end it at once
		const toNode = this.element !== element;
		const instant = !this.animated || !this.visible || (!toNode && !this.moving);
		this.element = element;
		if (toNode && !instant) {
			this.moving = true;
			this.win.clearTimeout(this.movingTimer);
			this.movingTimer = this.win.setTimeout(() => (this.moving = false), this.options.duration + 50);
		}

		const geometry = [rect.x, rect.y, rect.width, rect.height].join();
		const changed = geometry !== this.geometry;
		this.geometry = geometry;
		if (changed) {
			this.box.toggleAttribute('data-instant', instant);
			// left/top, not a transform: anchor positioning (the toolbars) ignores transforms
			Object.assign(this.box.style, {
				left: `${rect.x}px`,
				top: `${rect.y}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`
			});
		}
		this.box.toggleAttribute('data-shine-through', element.classList.contains(SHINE_THROUGH));
		this.box.setAttribute('data-visible', '');
		if (instant && changed) {
			// applied without transition (reading the layout), then the transition is back for the next node
			void this.box.offsetWidth;
			this.box.removeAttribute('data-instant');
		}

		return {rect, toNode};
	}

	hide(): void {
		this.cancelHide();
		this.box.removeAttribute('data-visible');
		this.element = null;
		this.moving = false;
	}

	private cancelHide(): void {
		this.win.clearTimeout(this.hideTimer);
		this.hideTimer = 0;
	}
}

/** The selected node (one box, moving) and the hovered one (two boxes: one fades out while the other fades in) */
export class Outline {
	private readonly focus: OutlineBox;
	private readonly hover: [OutlineBox, OutlineBox];
	private hoverIndex = 0;

	constructor(layer: HTMLElement, win: Window, options: Options) {
		const box = (attribute: string) => {
			const element = win.document.createElement('div');
			element.setAttribute(attribute, '');
			layer.appendChild(element);
			return element;
		};
		this.hover = [
			new OutlineBox(box('data-hovered'), win, options, false),
			new OutlineBox(box('data-hovered'), win, options, false)
		];
		this.focus = new OutlineBox(box('data-focused'), win, options, true);
	}

	/** The box of the selected node: the anchor of the node toolbar (styles/node-toolbar.css) */
	get focusBox(): HTMLElement {
		return this.focus.box;
	}

	/** The selected node (null while there is none) */
	get focusedElement(): HTMLElement | null {
		return this.focus.element;
	}

	placeFocus(element: HTMLElement | null) {
		return this.focus.place(element);
	}

	placeHover(element: HTMLElement | null): void {
		let active = this.hover[this.hoverIndex];
		if (element && active.element && active.element !== element && active.visible) {
			// another node: this box fades out where it is, the other one takes over
			active.hide();
			this.hoverIndex = 1 - this.hoverIndex;
			active = this.hover[this.hoverIndex];
		}
		active.place(element);
	}
}
