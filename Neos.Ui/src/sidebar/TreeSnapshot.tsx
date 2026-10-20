import {Component, type RefObject} from 'react';

import type {TreeLoadingState} from './TreeLoading';

const SNAPSHOT = 'devclaim-tree-snapshot';
const LEAVING = 'devclaim-tree-snapshot--leaving';
/** ms of the crossfade to the new tree (styles/sidebar.css: devclaim-tree-in) */
const CROSSFADE = 260;
/** dimmed like a tree that reloads (styles/sidebar.css: --reloading) */
const DIMMED = 0.35;
const DIM = 150;

type Props = {state: TreeLoadingState; container: RefObject<HTMLElement>};
type Snapshot = {clone: HTMLElement; live: HTMLElement; scrollTop: number; opacity: number; height: number} | null;

const liveTree = (container: HTMLElement | null) =>
	container?.querySelector<HTMLElement>(`:scope > [class*="_treeWrapper"]:not(.${SNAPSHOT})`) ?? null;

/**
 * A tree that is loaded again from scratch (another document in the content tree, other dimensions) would disappear
 * until the new one is there. Instead it stays as it was, dimmed: a copy taken right before React changes it
 * (getSnapshotBeforeUpdate runs before the DOM of the commit is touched), in its place while the new tree loads hidden.
 * Then the copy fades out over the new tree fading in. The copy is inert (no ids, not in the accessibility tree).
 */
export class TreeSnapshot extends Component<Props> {
	private clone: HTMLElement | null = null;
	/** of the tree when it was copied: the copy keeps it while it fades out (the new tree may still settle) */
	private height = 0;

	getSnapshotBeforeUpdate(previous: Props): Snapshot {
		if (this.props.state !== 'first' || previous.state === 'first' || this.clone) {
			return null;
		}
		const live = liveTree(this.props.container.current);
		if (!live || !live.offsetHeight) {
			return null;
		}
		const clone = live.cloneNode(true) as HTMLElement;
		clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
		clone.classList.add(SNAPSHOT);
		clone.setAttribute('aria-hidden', 'true');
		clone.setAttribute('inert', '');
		return {
			clone,
			live,
			scrollTop: live.scrollTop,
			opacity: Number(getComputedStyle(live).opacity),
			height: live.offsetHeight
		};
	}

	componentDidUpdate(previous: Props, _state: unknown, snapshot: Snapshot) {
		const container = this.props.container.current;
		if (snapshot && container) {
			// in place of the tree: the same element, or the new one if the Neos UI mounted another
			const anchor = snapshot.live.isConnected ? snapshot.live : liveTree(container);
			container.insertBefore(snapshot.clone, anchor?.parentNode === container ? anchor : null);
			snapshot.clone.scrollTop = snapshot.scrollTop;
			// dimmed from where the tree was (it may be dimmed already: a reload before)
			snapshot.clone.animate([{opacity: snapshot.opacity}, {opacity: DIMMED}], {duration: DIM, easing: 'ease'});
			this.clone = snapshot.clone;
			this.height = snapshot.height;
		} else if (previous.state === 'first' && this.props.state !== 'first') {
			this.leave();
		}
	}

	componentWillUnmount() {
		this.clone?.remove();
		this.clone = null;
	}

	/** over the new tree (same place and size), fading out while that fades in */
	private leave() {
		const clone = this.clone;
		const container = this.props.container.current;
		this.clone = null;
		if (!clone || !container) {
			clone?.remove();
			return;
		}
		const scrollTop = clone.scrollTop;
		// out of the flow first: the new tree gets the whole place, the copy covers exactly that
		clone.classList.add(LEAVING);
		// offsets: relative to the area (positioned), inside its border and with its scrolling
		const place = liveTree(container) ?? clone;
		Object.assign(clone.style, {
			top: `${place.offsetTop}px`,
			left: `${place.offsetLeft}px`,
			width: `${place.offsetWidth}px`,
			height: `${this.height || place.offsetHeight}px`
		});
		clone.scrollTop = scrollTop;
		requestAnimationFrame(() => {
			clone.style.opacity = '0';
		});
		window.setTimeout(() => clone.remove(), CROSSFADE + 50);
	}

	render() {
		return null;
	}
}
