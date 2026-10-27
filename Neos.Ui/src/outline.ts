/**
 * The boxes around the selected and the hovered node: in a layer of their own (styles/outline.css), so overflow,
 * the frame and positioned content of the node cannot hide them.
 */
import {HIDE_DELAY, SHINE_THROUGH} from './constants';
import type {Options} from './options';

/** A box in page coordinates */
export type Rect = {x: number; y: number; width: number; height: number};

/** The edges of the area an element can be seen in, in the coordinates of the window */
type Edges = {left: number; right: number; top: number; bottom: number};

/**
 * Where the ancestors of an element let it be seen: every one that clips what overflows it (a scrolling row, a slider,
 * overflow: hidden) cuts the area down to its inside, on the axes it clips
 */
function visibleArea(element: Element, win: Window): Edges {
	const area: Edges = {left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity};
	const {body, documentElement} = win.document;
	let parent = element.parentElement;
	for (; parent && parent !== body && parent !== documentElement; parent = parent.parentElement) {
		const style = win.getComputedStyle(parent);
		if (style.overflowX === 'visible' && style.overflowY === 'visible') {
			continue;
		}
		const rect = parent.getBoundingClientRect();
		// inside the borders: the area the content is clipped to
		const left = rect.left + parent.clientLeft;
		const top = rect.top + parent.clientTop;
		if (style.overflowX !== 'visible') {
			area.left = Math.max(area.left, left);
			area.right = Math.min(area.right, left + parent.clientWidth);
		}
		if (style.overflowY !== 'visible') {
			area.top = Math.max(area.top, top);
			area.bottom = Math.min(area.bottom, top + parent.clientHeight);
		}
	}
	return area;
}

/**
 * The box around an element, null if it is not shown. Offset around the element, but kept inside the visible width and
 * the page (a gap to their edge): a node over the whole width keeps its outline, a node scrolled partly out of view
 * keeps its edge where it is. Inside an ancestor that clips it (a scrolling row): around the part that can be seen, an
 * edge cut by the ancestor right at its edge, so the box moves with the node while the row scrolls; none for a node
 * that cannot be seen at all.
 */
export function boxFor(element: Element | null, win: Window, options: Options): Rect | null {
	if (!element?.isConnected) {
		return null;
	}
	const rect = element.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) {
		return null;
	}
	const area = visibleArea(element, win);
	if (rect.right <= area.left || rect.left >= area.right || rect.bottom <= area.top || rect.top >= area.bottom) {
		return null;
	}
	const root = win.document.documentElement;
	const {offset, gap} = options;
	// an edge cut by an ancestor: at its edge; the others: offset around the node
	const edgeLeft = rect.left < area.left ? area.left : rect.left - offset;
	const edgeRight = rect.right > area.right ? area.right : rect.right + offset;
	const edgeTop = rect.top < area.top ? area.top : rect.top - offset;
	const edgeBottom = rect.bottom > area.bottom ? area.bottom : rect.bottom + offset;
	const left = Math.max(edgeLeft + win.scrollX, win.scrollX + gap);
	const right = Math.min(edgeRight + win.scrollX, win.scrollX + root.clientWidth - gap);
	const top = Math.max(edgeTop + win.scrollY, gap);
	const bottom = Math.min(edgeBottom + win.scrollY, root.scrollHeight - gap);

	return {x: left, y: top, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0)};
}

/** One box: shown around an element, moved (animated) or put there at once */
class OutlineBox {
	element: HTMLElement | null = null;
	/** the node it was last around: a box fading out (no longer hovered) stays on it while something scrolls */
	private last: HTMLElement | null = null;
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

	/**
	 * Around the element; returns where, and whether it is another node than before (null: nothing shown). follow: the
	 * node moved because something scrolled (a slider row): the box goes with it at once, a movement still running ends
	 */
	place(element: HTMLElement | null, follow = false): {rect: Rect; toNode: boolean} | null {
		const rect = boxFor(element, this.win, this.options);
		if (element?.isConnected && !rect) {
			// the node is there but cannot be seen (scrolled out of a row): no box left behind where it was
			this.hide();
			return null;
		}
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
		this.last = element;
		if (follow) {
			this.moving = false;
		}
		const instant = follow || !this.animated || !this.visible || (!toNode && !this.moving);
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

	/**
	 * Something scrolled: the box moves with the node it is or was around, at once (also while it waits to fade or
	 * fades out, the node no longer hovered), or is gone if that cannot be seen any more (scrolled out of a row),
	 * instead of staying behind
	 */
	track(): void {
		const node = this.element ?? this.last;
		if (!node) {
			return;
		}
		const rect = boxFor(node, this.win, this.options);
		if (!rect) {
			this.hide();
			this.last = null;
			return;
		}
		this.geometry = [rect.x, rect.y, rect.width, rect.height].join();
		this.box.setAttribute('data-instant', '');
		Object.assign(this.box.style, {
			left: `${rect.x}px`,
			top: `${rect.y}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`
		});
		void this.box.offsetWidth;
		this.box.removeAttribute('data-instant');
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

	/** follow: something scrolled, the boxes stay on their nodes without moving after them (see OutlineBox.place) */
	placeFocus(element: HTMLElement | null, follow = false) {
		const placed = this.focus.place(element, follow);
		if (follow && !placed) {
			this.focus.track();
		}
		return placed;
	}

	placeHover(element: HTMLElement | null, follow = false): void {
		let active = this.hover[this.hoverIndex];
		if (element && active.element && active.element !== element && active.visible) {
			// another node: this box fades out where it is, the other one takes over
			active.hide();
			this.hoverIndex = 1 - this.hoverIndex;
			active = this.hover[this.hoverIndex];
		}
		active.place(element, follow);
		// something scrolled: the boxes fading out move with their nodes (the hovered node scrolled from under the
		// pointer: the Neos UI took its class, the box fades where the node is now, not where it was)
		if (follow) {
			this.hover.forEach((box) => box.track());
		}
	}
}
