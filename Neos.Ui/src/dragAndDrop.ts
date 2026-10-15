/**
 * Drag and drop of the selected node in the content frame, instead of the native one of the Neos UI: the node itself
 * moves through the page while dragging (the others slide aside), and the page zooms out so big nodes and long pages
 * fit. From the drag handle of the node toolbar: pressed and dragged (dropped on release), or clicked (it follows the
 * pointer, the next click drops it). Only where the Neos UI allows the node (its selectors); on drop the move action of
 * the Neos UI (as its own drop does). Escape cancels.
 */
import {actions, selectors} from '@neos-project/neos-ui-redux-store';

import {
	ATTRIBUTE,
	DRAG_MIN_SCALE,
	DRAG_SCROLL_EDGE,
	DRAG_SCROLL_SPEED,
	DRAG_SLIDE,
	DRAG_THRESHOLD,
	DRAG_ZOOM
} from './constants';
import type {FrameWindow} from './guestFrame';
import type {Neos} from './neos';
import {typeLabel} from './nodeToolbar';

const NODE = '[data-__neos-node-contextpath]';
const HANDLE = '#neos-InlineToolbar-DragSelectedNode';
const DRAGGING = `${ATTRIBUTE}-dragging`;
const ZOOMING = `${ATTRIBUTE}-zooming`;
const DRAGGED = `${ATTRIBUTE}-dragged`;
/** ms to wait for the Neos UI to render the moved node at its new place (then ours is removed) */
const RENDER_TIMEOUT = 15000;
/** px the pointer has to move after a move of the node before it moves again (no jitter on a boundary) */
const MOVE_HYSTERESIS = 4;
/** ms after a drop in which a click is not passed on (the page would select the node under the pointer) */
const SWALLOW_CLICK = 600;

type Position = 'before' | 'after' | 'into';
/** A node the dragged one may go next to (alongside) or into (an empty collection) */
type Candidate = {element: HTMLElement; alongside: boolean; into: boolean};
/** A place in the DOM: before next in parent (next null: at the end) */
type Place = {parent: Node; next: Node | null};
/** The nodes of a list (a collection, a grid) and their places in it when the drag started, relative to the list */
type SortableList = {parent: HTMLElement; nodes: HTMLElement[]; slots: {x: number; y: number; width: number; height: number}[]};

const contextPathOf = (element: Element) => element.getAttribute('data-__neos-node-contextpath') ?? '';

function contains(rect: DOMRect, x: number, y: number): boolean {
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function distance(rect: DOMRect, x: number, y: number): number {
	const dx = Math.max(rect.left - x, 0, x - rect.right);
	const dy = Math.max(rect.top - y, 0, y - rect.bottom);
	return Math.hypot(dx, dy);
}

/** The list of the dragged node, before the page zooms (unscaled places) */
function sortableList(element: HTMLElement): SortableList | null {
	const parent = element.parentElement;
	if (!parent) {
		return null;
	}
	const origin = parent.getBoundingClientRect();
	const nodes = Array.from(parent.children).filter((child): child is HTMLElement => child.matches(NODE));
	const slots = nodes.map((node) => {
		const rect = node.getBoundingClientRect();
		return {x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height};
	});

	return {parent, nodes, slots};
}

/** The scale of <body> right now (also while it zooms) */
function currentScale(body: HTMLElement, win: FrameWindow): number {
	const transform = win.getComputedStyle(body).transform;
	return transform && transform !== 'none' ? new win.DOMMatrix(transform).a : 1;
}

/**
 * Where an element is once its slide (the FLIP animation of moveTo) is over: decisions on the final layout, right away
 * (on the moving one, a grid that reflows would move the dragged node back and forth)
 */
function settledRect(element: Element, win: FrameWindow, scale: number): DOMRect {
	const rect = element.getBoundingClientRect();
	if (element.getAnimations().length === 0) {
		return rect;
	}
	const [x = 0, y = 0] = win.getComputedStyle(element).translate.split(' ').map((value) => parseFloat(value) || 0);
	return new win.DOMRect(rect.x - x * scale, rect.y - y * scale, rect.width, rect.height);
}

/** Its siblings are side by side (columns, a row): before/after by x, otherwise by y */
function isInRow(element: HTMLElement, rectOf: (element: Element) => DOMRect): boolean {
	const rect = rectOf(element);
	return [element.previousElementSibling, element.nextElementSibling].some((sibling) => {
		const other = sibling && rectOf(sibling);
		return !!other && other.width > 0 && other.top < rect.bottom && other.bottom > rect.top && other.left !== rect.left;
	});
}

export class DragAndDrop {
	private readonly doc: Document;
	private pressed: {x: number; y: number} | null = null;
	private drag: {
		element: HTMLElement;
		contextPath: string;
		origin: Place;
		candidates: Candidate[];
		ghost: HTMLElement;
		x: number;
		y: number;
		frame: number;
		/** held: dropped on release; clicked: it follows the pointer until the next click */
		mode: 'hold' | 'click';
		/** where the pointer was at the last move of the node */
		movedAt: {x: number; y: number};
		/** the list it came from: its nodes and their places when the drag started (see sortedPlaceAt) */
		list: SortableList | null;
		/** puts the sticky elements of the page back */
		restoreSticky: () => void;
	} | null = null;

	constructor(
		private readonly win: FrameWindow,
		private readonly neos: Neos,
		private readonly layer: HTMLElement,
		/** the selected node */
		private readonly selected: () => HTMLElement | null,
		/** an update of the outline (it follows the node while it moves) */
		private readonly onFrame: () => void
	) {
		this.doc = win.document;
		// no native drag from the handle of the Neos UI
		this.doc.addEventListener('dragstart', (event) => {
			if ((event.target as Element | null)?.closest?.(`div:has(> ${HANDLE}), ${HANDLE}`)) {
				event.preventDefault();
			}
		}, true);
		this.doc.addEventListener('pointerdown', (event) => this.press(event), true);
		this.doc.addEventListener('pointermove', (event) => this.pointerMove(event), true);
		this.doc.addEventListener('pointerup', (event) => this.release(event), true);
		this.doc.addEventListener('pointercancel', () => this.cancel(), true);
		this.doc.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && this.drag) {
				event.preventDefault();
				event.stopPropagation();
				this.cancel();
			}
		}, true);
	}

	get dragging(): boolean {
		return this.drag !== null;
	}

	private press(event: PointerEvent): void {
		// clicked: the next click drops it
		if (this.drag?.mode === 'click') {
			event.preventDefault();
			event.stopPropagation();
			this.drop();
			return;
		}
		const handle = (event.target as Element | null)?.closest?.(HANDLE) as HTMLButtonElement | null;
		if (event.button !== 0 || !handle || handle.disabled || !this.selected()) {
			return;
		}
		event.preventDefault();
		this.pressed = {x: event.clientX, y: event.clientY};
	}

	private pointerMove(event: PointerEvent): void {
		if (this.pressed && !this.drag) {
			if (Math.hypot(event.clientX - this.pressed.x, event.clientY - this.pressed.y) >= DRAG_THRESHOLD) {
				this.start(event.clientX, event.clientY, 'hold');
			}
			return;
		}
		if (!this.drag) {
			return;
		}
		// held, but released outside of the frame
		if (this.drag.mode === 'hold' && event.buttons === 0) {
			this.drop();
			return;
		}
		this.drag.x = event.clientX;
		this.drag.y = event.clientY;
		this.drag.ghost.style.translate = `${event.clientX}px ${event.clientY}px`;
		this.follow();
	}

	private start(x: number, y: number, mode: 'hold' | 'click'): void {
		this.pressed = null;
		const element = this.selected();
		const contextPath = element && contextPathOf(element);
		if (!element || !contextPath || !element.parentNode) {
			return;
		}

		const ghost = this.doc.createElement('span');
		ghost.setAttribute('data-ghost', '');
		ghost.textContent = typeLabel(element, this.neos);
		ghost.style.translate = `${x}px ${y}px`;
		this.layer.appendChild(ghost);

		this.drag = {
			element,
			contextPath,
			origin: {parent: element.parentNode, next: element.nextSibling},
			candidates: this.candidates(element, contextPath),
			ghost,
			x,
			y,
			frame: 0,
			mode,
			movedAt: {x: -Infinity, y: -Infinity},
			list: sortableList(element),
			restoreSticky: this.unstick()
		};
		element.setAttribute(DRAGGED, '');
		this.doc.documentElement.setAttribute(DRAGGING, '');
		this.zoomOut(y);
		this.drag.frame = this.win.requestAnimationFrame(() => this.tick());
	}

	/** The nodes the dragged one may go next to or into, checked once with the selectors of the Neos UI */
	private candidates(element: HTMLElement, subject: string): Candidate[] {
		const state = this.neos.store.getState();
		const canGoAlongside = selectors.CR.Nodes.makeCanBeMovedAlongsideSelector(this.neos.nodeTypes);
		const canGoInto = selectors.CR.Nodes.makeCanBeMovedIntoSelector(this.neos.nodeTypes);

		return Array.from(this.doc.querySelectorAll<HTMLElement>(NODE))
			.filter((candidate) => candidate !== element && !element.contains(candidate))
			.map((candidate) => {
				const reference = contextPathOf(candidate);
				const query = {subject, reference, role: 'content' as const};
				return {
					element: candidate,
					alongside: canGoAlongside(state, query),
					// into only empty collections: in the others the dragged node goes next to their nodes
					into: !candidate.querySelector(NODE) && canGoInto(state, query)
				};
			})
			.filter((candidate) => candidate.alongside || candidate.into);
	}

	/**
	 * The page zooms out (a transform of <body>) so it fits the frame, at most down to DRAG_MIN_SCALE. It fits: from the
	 * top of the frame. It does not: around the pointer, as far as that leaves no empty space above or below the page.
	 * The layer of the outline is outside of <body>, it stays sharp.
	 */
	private zoomOut(pointerY: number): void {
		const {body, documentElement: root} = this.doc;
		const height = root.scrollHeight;
		const room = this.win.innerHeight - 2 * DRAG_SCROLL_EDGE;
		const scale = Math.max(DRAG_MIN_SCALE, Math.min(1, room / height));
		if (scale > 0.95) {
			return;
		}
		// the origin (page coordinates) that puts the top / the bottom of the page at the edge of the frame
		const top = (this.win.scrollY + DRAG_SCROLL_EDGE) / (1 - scale);
		const bottom = (this.win.scrollY + this.win.innerHeight - DRAG_SCROLL_EDGE - height * scale) / (1 - scale);
		const originY = height * scale <= room ? top : Math.min(top, Math.max(bottom, pointerY + this.win.scrollY));
		body.style.transformOrigin = `50% ${originY}px`;
		body.style.transform = `scale(${scale})`;
	}

	/**
	 * Sticky elements (a header) stay relative to the scrolling of the frame, not to the zoomed page: the zoom would put
	 * them somewhere in the middle. While dragging they stay where they are in the page (position: relative), like the
	 * rest of it. Fixed elements are fine: the transform of <body> makes them relative to the page. Returns the undo.
	 */
	private unstick(): () => void {
		const sticky = Array.from(this.doc.body.querySelectorAll<HTMLElement>('*')).filter(
			(element) => this.win.getComputedStyle(element).position === 'sticky'
		);
		const before = sticky.map((element) => [element.style.getPropertyValue('position'), element.style.getPropertyPriority('position')]);
		sticky.forEach((element) => element.style.setProperty('position', 'relative', 'important'));

		return () => sticky.forEach((element, i) => element.style.setProperty('position', before[i][0], before[i][1]));
	}

	private zoomIn(then: () => void): void {
		const {body, documentElement: root} = this.doc;
		if (!body.style.transform) {
			then();
			return;
		}
		root.setAttribute(ZOOMING, '');
		body.style.transform = '';
		this.win.setTimeout(() => {
			root.removeAttribute(ZOOMING);
			body.style.transformOrigin = '';
			then();
		}, DRAG_ZOOM);
	}

	/**
	 * Every frame while dragging: the page scrolls near the top and bottom of the frame (faster towards the edge, as fast
	 * on the screen whatever the zoom), the outline follows
	 */
	private tick(): void {
		if (!this.drag) {
			return;
		}
		const {y} = this.drag;
		const height = this.win.innerHeight;
		const depth = y < DRAG_SCROLL_EDGE ? y - DRAG_SCROLL_EDGE : y > height - DRAG_SCROLL_EDGE ? y - height + DRAG_SCROLL_EDGE : 0;
		if (depth) {
			const ratio = Math.min(1, Math.abs(depth) / DRAG_SCROLL_EDGE);
			const speed = (DRAG_SCROLL_SPEED * ratio * ratio) / currentScale(this.doc.body, this.win);
			this.win.scrollBy(0, Math.sign(depth) * Math.max(1, speed));
		}
		this.follow();
		this.onFrame();
		this.drag.frame = this.win.requestAnimationFrame(() => this.tick());
	}

	/** The dragged node moves to the place at the pointer (when it is another one, and the pointer moved on) */
	private follow(): void {
		const drag = this.drag;
		if (!drag || Math.hypot(drag.x - drag.movedAt.x, drag.y - drag.movedAt.y) < MOVE_HYSTERESIS) {
			return;
		}
		const place = this.placeAt(drag.x, drag.y);
		if (place && this.moveTo(place)) {
			drag.movedAt = {x: drag.x, y: drag.y};
		}
	}

	private placeAt(x: number, y: number): Place | null {
		const drag = this.drag;
		const scale = currentScale(this.doc.body, this.win);
		const rectOf = (element: Element) => settledRect(element, this.win, scale);
		// over the dragged node itself: it stays where it is
		if (!drag || contains(rectOf(drag.element), x, y)) {
			return null;
		}

		// the innermost node at the pointer, otherwise the nearest one (in the gaps between nodes)
		let target: Candidate | null = null;
		let targetArea = Infinity;
		let nearest: Candidate | null = null;
		let nearestDistance = Infinity;
		for (const candidate of drag.candidates) {
			if (!candidate.element.isConnected) {
				continue;
			}
			const rect = rectOf(candidate.element);
			if (contains(rect, x, y) && rect.width * rect.height < targetArea) {
				target = candidate;
				targetArea = rect.width * rect.height;
			}
			const away = distance(rect, x, y);
			if (away < nearestDistance) {
				nearest = candidate;
				nearestDistance = away;
			}
		}
		// in its own list (not deeper in it): by the places the nodes had when the drag started
		const list = drag.list;
		if (list?.parent.isConnected && contains(list.parent.getBoundingClientRect(), x, y)
			&& (!target || target.element.parentElement === list.parent || !list.parent.contains(target.element))) {
			return this.sortedPlaceAt(list, x, y, scale);
		}
		target ??= nearest;
		if (!target) {
			return null;
		}

		const {element} = target;
		if (target.into) {
			return {parent: element, next: null};
		}
		// another list: before or after the node by the half of it at the pointer
		const rect = rectOf(element);
		const before = isInRow(element, rectOf) ? x < rect.left + rect.width / 2 : y < rect.top + rect.height / 2;
		const position: Position = before ? 'before' : 'after';

		return {parent: element.parentNode as Node, next: position === 'before' ? element : element.nextSibling};
	}

	/**
	 * Like a sortable list (dnd-kit): the place under the pointer among the places the nodes had when the drag started
	 * (in the gaps: the nearest one) is the index of the dragged node. Fixed places, not the current layout: that
	 * changes with every move (a grid reflows), deciding on it would move the node back and forth.
	 */
	private sortedPlaceAt(list: SortableList, x: number, y: number, scale: number): Place {
		const origin = list.parent.getBoundingClientRect();
		const localX = (x - origin.left) / scale;
		const localY = (y - origin.top) / scale;
		let index = list.slots.findIndex((slot) => localX >= slot.x && localX <= slot.x + slot.width && localY >= slot.y && localY <= slot.y + slot.height);
		if (index === -1) {
			let nearest = Infinity;
			list.slots.forEach((slot, i) => {
				const away = Math.hypot(localX - (slot.x + slot.width / 2), localY - (slot.y + slot.height / 2));
				if (away < nearest) {
					nearest = away;
					index = i;
				}
			});
		}
		// the others keep their order: the dragged node goes before the one at that index (after the last one at the end)
		const others = list.nodes.filter((node) => node !== this.drag?.element && node.parentElement === list.parent);
		const next = others[index] ?? null;

		return {parent: list.parent, next: next ?? (others.length ? others[others.length - 1].nextSibling : null)};
	}

	/** Moves the dragged node in the DOM, the nodes around slide to their new places (FLIP); false: it is there */
	private moveTo(place: Place): boolean {
		const drag = this.drag;
		if (!drag) {
			return false;
		}
		const {element} = drag;
		if (place.next === element || (element.parentNode === place.parent && element.nextSibling === place.next)) {
			return false;
		}

		// from where they are on the screen (also mid-slide), to their new places without the slides still running
		const moving = [element, ...drag.candidates.map((candidate) => candidate.element)];
		const before = new Map(moving.map((node) => [node, node.getBoundingClientRect()]));
		moving.forEach((node) => node.getAnimations().forEach((animation) => animation.cancel()));
		place.parent.insertBefore(element, place.next);

		const scale = currentScale(this.doc.body, this.win);
		const reduceMotion = this.win.matchMedia('(prefers-reduced-motion: reduce)').matches;
		for (const node of moving) {
			const from = before.get(node);
			const to = node.getBoundingClientRect();
			if (reduceMotion || !from || !node.isConnected || to.width === 0 || (from.left === to.left && from.top === to.top)) {
				continue;
			}
			const dx = (from.left - to.left) / scale;
			const dy = (from.top - to.top) / scale;
			node.animate([{translate: `${dx}px ${dy}px`}, {translate: '0 0'}], {duration: DRAG_SLIDE, easing: 'cubic-bezier(.2, .8, .2, 1)'});
		}

		return true;
	}

	private release(event: PointerEvent): void {
		// a click on the handle: it follows the pointer until the next click
		if (this.pressed && !this.drag) {
			this.start(event.clientX, event.clientY, 'click');
			return;
		}
		this.pressed = null;
		if (this.drag?.mode === 'hold') {
			this.drop();
		}
	}

	private drop(): void {
		this.pressed = null;
		const drag = this.drag;
		if (!drag) {
			return;
		}
		const move = this.moveOf(drag.element, drag.contextPath, drag.origin);
		this.end();
		if (move) {
			this.neos.store.dispatch(actions.CR.Nodes.moveMultiple([drag.contextPath], move.reference, move.position));
			this.replaceWhenRendered(drag.element, drag.contextPath);
		} else {
			this.restore(drag.element, drag.origin);
		}
	}

	private cancel(): void {
		this.pressed = null;
		const drag = this.drag;
		if (drag) {
			this.end();
			this.restore(drag.element, drag.origin);
		}
	}

	/** The move for the Neos UI: next to the node before or after it, into its collection when alone; null: none */
	private moveOf(element: HTMLElement, subject: string, origin: Place): {reference: string; position: Position} | null {
		if (element.parentNode === origin.parent && element.nextSibling === origin.next) {
			return null;
		}
		const sibling = (from: Element | null, step: 'previousElementSibling' | 'nextElementSibling') => {
			let node = from;
			while (node && !node.matches(NODE)) {
				node = node[step];
			}
			return node;
		};
		const previous = sibling(element.previousElementSibling, 'previousElementSibling');
		const next = sibling(element.nextElementSibling, 'nextElementSibling');
		const collection = element.parentElement?.closest(NODE);
		const move = previous
			? {reference: contextPathOf(previous), position: 'after' as const}
			: next
				? {reference: contextPathOf(next), position: 'before' as const}
				: collection
					? {reference: contextPathOf(collection), position: 'into' as const}
					: null;
		if (!move) {
			return null;
		}

		const state = this.neos.store.getState();
		const query = {subject, reference: move.reference, role: 'content' as const};
		const allowed = move.position === 'into'
			? selectors.CR.Nodes.makeCanBeMovedIntoSelector(this.neos.nodeTypes)(state, query)
			: selectors.CR.Nodes.makeCanBeMovedAlongsideSelector(this.neos.nodeTypes)(state, query);

		return allowed ? move : null;
	}

	/** Ends the drag: the ghost goes, the page zooms in and shows the node; a click right after does not select */
	private end(): void {
		const drag = this.drag;
		if (!drag) {
			return;
		}
		this.drag = null;
		this.win.cancelAnimationFrame(drag.frame);
		drag.ghost.remove();
		drag.element.removeAttribute(DRAGGED);
		this.doc.documentElement.removeAttribute(DRAGGING);
		const swallowClick = (event: Event) => {
			event.preventDefault();
			event.stopPropagation();
		};
		this.doc.addEventListener('click', swallowClick, {capture: true, once: true});
		this.win.setTimeout(() => this.doc.removeEventListener('click', swallowClick, true), SWALLOW_CLICK);
		this.zoomIn(() => {
			drag.restoreSticky();
			this.scrollToNode(drag.contextPath);
			this.onFrame();
		});
	}

	/**
	 * Shows the node after the drop, centered unless it is in view: the one in the page now (by then the Neos UI may
	 * have rendered it again, ours is gone)
	 */
	private scrollToNode(contextPath: string): void {
		const node = this.doc.querySelector(`[data-__neos-node-contextpath="${CSS.escape(contextPath)}"]`);
		if (!node) {
			return;
		}
		const rect = node.getBoundingClientRect();
		if (rect.top < 0 || rect.bottom > this.win.innerHeight) {
			node.scrollIntoView({block: rect.height > this.win.innerHeight ? 'start' : 'center', behavior: 'smooth'});
		}
	}

	private restore(element: HTMLElement, origin: Place): void {
		if (origin.parent.isConnected) {
			origin.parent.insertBefore(element, origin.next && origin.next.parentNode === origin.parent ? origin.next : null);
		}
	}

	/**
	 * The Neos UI renders the moved node again at its new place (next to ours); then ours goes, as its own drop removes
	 * the node right away. Until then the page shows ours, without a gap.
	 */
	private replaceWhenRendered(element: HTMLElement, contextPath: string): void {
		const selector = `[data-__neos-node-contextpath="${CSS.escape(contextPath)}"]`;
		const observer = new this.win.MutationObserver(() => {
			const rendered = Array.from(this.doc.querySelectorAll(selector)).some((node) => node !== element && !element.contains(node));
			if (rendered) {
				element.remove();
				observer.disconnect();
			}
		});
		observer.observe(this.doc.documentElement, {childList: true, subtree: true});
		this.win.setTimeout(() => observer.disconnect(), RENDER_TIMEOUT);
	}
}
