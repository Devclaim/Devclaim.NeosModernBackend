/** What the node toolbar of the Neos UI shows, beyond its styles (styles/node-toolbar.css) */
import {type Neos, nodeOf} from './neos';

const MENU = '#neos-ContextToolbar-ContextMenu';

/** The type of a node ("Text"), not its own label (generated from its content); '' if unknown */
export function typeLabel(element: HTMLElement, neos: Neos): string {
	const node = nodeOf(element, 'data-__neos-node-contextpath', neos);
	const label = node && neos.nodeTypes.get(node.nodeType)?.label;

	return label ? neos.i18n.translate(label, label) : '';
}

/**
 * The tab names the type of the selected node; the buttons of the menu get their short label as tooltip
 * ("Duplizieren", not the long title of the Neos UI). Set again whenever the Neos UI renders its toolbar again.
 */
export function syncNodeToolbar(doc: Document, selected: HTMLElement, neos: Neos): void {
	const tabLabel = doc.querySelector('#neos-ContextToolbar [class*="contextToolbar__nodeLabel"] > span');
	const label = typeLabel(selected, neos);
	if (tabLabel && label && tabLabel.textContent !== label) {
		tabLabel.textContent = label;
	}
	doc.querySelectorAll<HTMLButtonElement>(`${MENU} button`).forEach((button) => {
		const text = button.textContent?.trim();
		if (text && button.title !== text) {
			button.title = text;
		}
	});

	// The Neos UI (9.2) decides whether its drag handle is enabled only for the first node its toolbar shows (useMemo
	// without dependencies): after a reload of the page (publishing) on a node that cannot move, it stays disabled for
	// all of them. Decided here for the selected node, by the same rules: not tethered, no document, editable.
	const handle = doc.querySelector<HTMLButtonElement>('#neos-InlineToolbar-DragSelectedNode');
	const node = nodeOf(selected, 'data-__neos-node-contextpath', neos);
	if (handle && node) {
		const canBeDragged = !node.isAutoCreated && !neos.nodeTypes.hasRole(node.nodeType, 'document') && node.policy?.canEdit !== false;
		if (handle.disabled === canBeDragged) {
			handle.disabled = !canBeDragged;
		}
	}
}

/** The menu closes once an action is chosen (the popover of the Neos UI stays open) */
export function closeMenuAfterAction(win: Window): void {
	const doc = win.document;
	doc.addEventListener('click', (event) => {
		const item = (event.target as Element | null)?.closest?.(`${MENU} button`);
		const menu = item && doc.querySelector<HTMLElement>(MENU);
		if (menu?.matches(':popover-open')) {
			win.setTimeout(() => menu.hidePopover());
		}
	});
}
