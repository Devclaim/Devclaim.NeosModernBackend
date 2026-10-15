/**
 * Where the node toolbar of the Neos UI goes around the outline of the selected node. The script decides, the styles
 * place it (styles/node-toolbar.css) from two attributes on <html>, both words separated by spaces:
 * - -tab: top | top-inside | bottom | bottom-inside | float, plus narrow and overhang for small nodes,
 * - -plus: above | above-inside | below | below-inside | into, plus crowded and overhang for small nodes.
 * Changes fade (fadeSwitch), another node: at once.
 */
import {ATTRIBUTE, EDGE_MARGIN, PLUS, PLUS_SPACING, TAB_HEIGHT, TAB_INSET} from './constants';
import {createFadeSwitch} from './fadeSwitch';
import type {Rect} from './outline';

export class Toolbars {
	private readonly switchTab;
	private readonly switchPlus;

	constructor(private readonly win: Window) {
		const root = win.document.documentElement;
		this.switchTab = createFadeSwitch(win, root, `${ATTRIBUTE}-tab`, `${ATTRIBUTE}-tab-hidden`);
		this.switchPlus = createFadeSwitch(win, root, `${ATTRIBUTE}-plus`, `${ATTRIBUTE}-plus-hidden`);
	}

	/** For the box of the selected node (page coordinates); toNode: another node than before */
	place(rect: Rect, toNode: boolean): void {
		const doc = this.win.document;
		const context = doc.getElementById('neos-ContextToolbar');
		const structural = doc.querySelector<HTMLElement>('[class*="structuralToolBar__popover"]');
		const tabWidth = context?.offsetWidth ?? 0;

		const tab = this.tabPosition(rect);
		let tabFlags = '';
		let inset = TAB_INSET;
		// a small node: the tab flush with its right edge, framed all around where it is wider than the node
		if (tabWidth + TAB_INSET > rect.width) {
			inset = 0;
			tabFlags = ' narrow' + (tabWidth > rect.width && tab !== 'float' ? ' overhang' : '');
		}
		this.switchTab(tab + tabFlags, toNode);

		const plus = this.plusPosition(rect, structural);
		let plusFlags = '';
		// a small node: the plus in the middle would run into the tab on the same edge, so it goes next to the tab
		const sameEdge = (tab.startsWith('top') && plus.startsWith('above')) || (tab.startsWith('bottom') && plus.startsWith('below'));
		if (sameEdge && structural && context) {
			const plusRight = (rect.width + structural.offsetWidth) / 2;
			const tabLeft = rect.width - inset - tabWidth;
			if (plusRight + PLUS_SPACING > tabLeft) {
				plusFlags = ' crowded' + (tabLeft - PLUS_SPACING - structural.offsetWidth < 0 ? ' overhang' : '');
			}
		}
		this.switchPlus(plus + plusFlags, toNode);
	}

	/**
	 * On the top until it comes near the top of the frame, then below the outline once that is in view; a node bigger
	 * than the frame (neither edge in view): floating at the bottom of the frame. Inside the outline where the page ends.
	 */
	private tabPosition(rect: Rect): string {
		const {scrollY, innerHeight} = this.win;
		const pageHeight = this.win.document.documentElement.scrollHeight;
		const bottom = rect.y + rect.height;
		const topInside = rect.y < TAB_HEIGHT;
		const bottomInside = bottom + TAB_HEIGHT > pageHeight;

		// the margin only as far as the page has room above the tab: at the very top it stays
		const tabTop = topInside ? rect.y : rect.y - TAB_HEIGHT;
		if (tabTop - scrollY >= Math.min(EDGE_MARGIN, tabTop)) {
			return topInside ? 'top-inside' : 'top';
		}
		const tabBottom = (bottomInside ? bottom : bottom + TAB_HEIGHT) - scrollY;
		if (tabBottom <= innerHeight) {
			return bottomInside ? 'bottom-inside' : 'bottom';
		}

		return 'float';
	}

	/** Follows the insert position of the Neos UI (the classes of its structural toolbar) */
	private plusPosition(rect: Rect, structural: HTMLElement | null): string {
		const classes = structural?.className ?? '';
		if (classes.includes('--isInside')) {
			return 'into';
		}
		if (classes.includes('--isBelow')) {
			return rect.y + rect.height > this.win.document.documentElement.scrollHeight - PLUS ? 'below-inside' : 'below';
		}

		return rect.y < PLUS ? 'above-inside' : 'above';
	}
}
