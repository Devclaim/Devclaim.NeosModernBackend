import {type RefObject, useEffect, useRef} from 'react';
import {useSelector} from 'react-redux';
import {selectors} from '@neos-project/neos-ui-redux-store';

const MARGIN = 8;

/**
 * The nodes of the trees in the Neos UI scroll "their scrolling parent" into view when they get focused
 * (NodeTree/Node, scrollFocusedNodeIntoView): that is often an element around the node, not the node, and nodes up to
 * 50px inside the tree count as out of view, so the tree jumps on a click. Inside the sidebar of this package that call
 * does nothing; useRevealFocused scrolls instead.
 */
export function ignoreScrollIntoViewIn(selector: string) {
	const scrollIntoView = Element.prototype.scrollIntoView;
	Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element['scrollIntoView']>) {
		if (!this.closest(selector)) {
			scrollIntoView.apply(this, args);
		}
	};
}

/** Scrolls the tree in the element only as far as needed to show its focused row completely; false: no row shown yet */
function reveal(element: HTMLElement | null, behavior: ScrollBehavior): boolean {
	const row = element?.querySelector('[class*="_header__data--isFocused"]');
	const tree = row?.closest('[class*="_treeWrapper"]');
	if (!row || !tree || !tree.clientHeight) {
		return false;
	}
	const rowRect = row.getBoundingClientRect();
	const treeRect = tree.getBoundingClientRect();
	if (rowRect.top < treeRect.top) {
		tree.scrollBy({top: rowRect.top - treeRect.top - MARGIN, behavior});
	} else if (rowRect.bottom > treeRect.bottom) {
		tree.scrollBy({top: rowRect.bottom - treeRect.bottom + MARGIN, behavior});
	}
	return true;
}

function useReveal(element: RefObject<HTMLElement>, focused: string[], isLoading: boolean) {
	const key = focused.join('\n');
	const hasRevealed = useRef(false);
	useEffect(() => {
		// several nodes: selected in the tree with shift or cmd, it is in view already
		if (isLoading || focused.length !== 1) {
			return;
		}
		// the first time (the tree just appeared) at once, then smoothly
		const frame = requestAnimationFrame(() => {
			hasRevealed.current = reveal(element.current, hasRevealed.current ? 'smooth' : 'auto') || hasRevealed.current;
		});
		return () => cancelAnimationFrame(frame);
	}, [key, isLoading]);
}

/**
 * The focused node of each tree comes into view when it changes (also from the page) or the tree is loaded, if it is
 * not; `isFirstLoad` while the tree is not shown yet
 */
export function useRevealFocused(
	top: RefObject<HTMLElement>,
	bottom: RefObject<HTMLElement>,
	isFirstLoad: {pageTree: boolean; contentTree: boolean}
) {
	const pageTreeLoading = useSelector(selectors.UI.PageTree.getIsLoading) || isFirstLoad.pageTree;
	const contentTreeLoading = useSelector(selectors.UI.ContentTree.getIsLoading) || isFirstLoad.contentTree;
	useReveal(top, useSelector(selectors.UI.PageTree.getAllFocused), pageTreeLoading);
	useReveal(bottom, useSelector(selectors.CR.Nodes.focusedNodePathsSelector), contentTreeLoading);
}
