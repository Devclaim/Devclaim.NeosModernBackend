/**
 * The Neos UI only offers "before" and "after" in the outer fifth of the selected node: it reads the mouse position
 * (pageY of mousemove on the window) against the node. For the selected node this reads the upper half as its top and
 * the lower half as its bottom, so the plus switches in the middle. Not for content collections ("into" in the middle).
 */
export function insertBeforeOrAfterByHalves(win: Window, selected: () => HTMLElement | null): void {
	win.addEventListener(
		'mousemove',
		(event) => {
			const element = selected();
			if (!element?.isConnected || element.classList.contains('neos-contentcollection')) {
				return;
			}
			const rect = element.getBoundingClientRect();
			const top = rect.top + win.scrollY;
			const bottom = rect.bottom + win.scrollY;
			const y = event.clientY + win.scrollY;
			Object.defineProperty(event, 'pageY', {value: y < (top + bottom) / 2 ? top + 1 : bottom - 1});
		},
		// before the listener of the Neos UI on the window
		true
	);
}
