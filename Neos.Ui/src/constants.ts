/**
 * The sizes shared by the script and the styles: the script writes them to the content frame as CSS variables
 * (--devclaim-modern-backend-*, see cssVariables), the styles (styles/*.css) only use those.
 */

/** The attribute of the layer of the boxes; with suffixes the state on <html> (-tab, -plus, …) */
export const ATTRIBUTE = 'data-devclaim-neos-modern-backend';

/** The classes of the Neos UI are CSS modules (with a hash prefix): matched by substring */
export const HOVERED = '[class*="markHoveredNodeAsHovered"]';
export const FOCUSED = '[class*="markActiveNodeAsFocused--focusedNode"]';
/** Shown from a fallback dimension (Neos draws these orange) */
export const SHINE_THROUGH = 'neos-contentelement-shine-through';

/** The tab of the selected node (the context toolbar of the Neos UI), its distance from the right corner */
export const TAB_HEIGHT = 44;
export const TAB_INSET = 16;
/** The plus (add, paste), the space to the tab when they share an edge (small nodes) */
export const PLUS = 44;
export const PLUS_SPACING = 6;
/** The frame of the outline, the tab and the plus: they overlap by it, so it reads as one line */
export const BORDER = 2;
/** The tab leaves the top of the frame before it reaches it; floating, its distance to the bottom of the frame */
export const EDGE_MARGIN = 8;
export const FLOAT_MARGIN = 16;

/** ms without a hovered/selected node before the box disappears (the Neos UI moves the class from node to node) */
export const HIDE_DELAY = 150;
/** ms of the fade of the hovered node */
export const FADE = 280;
/** ms the tab and the plus take to fade out before they move to another edge */
export const SWITCH_FADE = 140;
/** ms the menu takes to unfold out of the tab */
export const MENU_OPEN = 180;

/** Drag and drop: the page zooms out so the whole page fits in the frame, at most to this scale */
export const DRAG_MIN_SCALE = 0.3;
/**
 * ms of that zoom; px from the top/bottom of the frame where the page scrolls while dragging, and px per frame at the
 * very edge (on the screen: the zoomed page scrolls as fast)
 */
export const DRAG_ZOOM = 260;
export const DRAG_SCROLL_EDGE = 90;
export const DRAG_SCROLL_SPEED = 28;
/** px the pointer moves before a drag starts (a click on the handle stays a click) */
export const DRAG_THRESHOLD = 4;
/** ms the elements take to slide aside */
export const DRAG_SLIDE = 220;

/** The CSS variables of the styles, with the duration of the movement from node to node (settings) */
export function cssVariables(duration: number): Record<string, string> {
	const px = (value: number) => `${value}px`;
	const ms = (value: number) => `${value}ms`;

	return {
		'--devclaim-modern-backend-tab-height': px(TAB_HEIGHT),
		'--devclaim-modern-backend-tab-inset': px(TAB_INSET),
		'--devclaim-modern-backend-plus': px(PLUS),
		'--devclaim-modern-backend-plus-spacing': px(PLUS_SPACING),
		'--devclaim-modern-backend-border': px(BORDER),
		'--devclaim-modern-backend-float-margin': px(FLOAT_MARGIN),
		'--devclaim-modern-backend-duration': ms(duration),
		'--devclaim-modern-backend-fade': ms(FADE),
		'--devclaim-modern-backend-switch-fade': ms(SWITCH_FADE),
		'--devclaim-modern-backend-menu-open': ms(MENU_OPEN),
		'--devclaim-modern-backend-drag-zoom': ms(DRAG_ZOOM)
	};
}
