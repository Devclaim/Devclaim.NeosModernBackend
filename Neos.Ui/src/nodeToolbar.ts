/** What the node toolbar of the Neos UI shows, beyond its styles (styles/node-toolbar.css) */
import {SHINE_THROUGH} from './constants';
import {type Neos, nodeOf} from './neos';

const MENU = '#neos-ContextToolbar-ContextMenu';

function syncShineThroughNotice(doc: Document, selected: HTMLElement, neos: Neos): void {
	const nodeLabel = doc.querySelector('#neos-ContextToolbar [class*="contextToolbar__nodeLabel"]');
	const wrapper = nodeLabel?.parentElement;
	const current = wrapper?.querySelector('[data-shine-through-notice]');
	if (!selected.classList.contains(SHINE_THROUGH)) {
		current?.remove();
		return;
	}
	if (!nodeLabel || !wrapper || current) {
		return;
	}

	const text = neos.i18n.translate(
		'Devclaim.NeosModernBackend:Main:content.shineThrough',
		'Content from a fallback dimension'
	);
	const notice = doc.createElement('span');
	notice.setAttribute('data-shine-through-notice', '');
	notice.setAttribute('aria-label', text);
	notice.title = text;

	const icon = doc.createElement('span');
	icon.setAttribute('data-shine-through-icon', '');
	icon.innerHTML =
		'<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z"/><path d="M12 8v6"/><circle cx="12" cy="17.5" r="1"/></svg>';

	notice.append(icon);
	wrapper.insertBefore(notice, nodeLabel);
}

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
	syncShineThroughNotice(doc, selected, neos);
	const tabLabel = doc.querySelector(
		'#neos-ContextToolbar [class*="contextToolbar__nodeLabel"] > span:not([data-shine-through-notice])'
	);
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
	// all of them. Decided here for the selected node, by the same rules: not tethered, no document, editable; and not
	// of a node type that stays where it is (ui.draggable: false).
	const handle = doc.querySelector<HTMLButtonElement>('#neos-InlineToolbar-DragSelectedNode');
	const node = nodeOf(selected, 'data-__neos-node-contextpath', neos);
	if (handle && node) {
		const canBeDragged =
			!node.isAutoCreated &&
			!neos.nodeTypes.hasRole(node.nodeType, 'document') &&
			node.policy?.canEdit !== false &&
			neos.nodeTypes.get(node.nodeType)?.ui?.draggable !== false;
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
