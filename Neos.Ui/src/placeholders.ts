/**
 * The placeholders of the inline editable properties ("Bitte Text eingeben"), owned by this package for the whole life
 * of a property, instead of CKEditor's own (hidden, styles/placeholders.css). CKEditor only adds its placeholder once it
 * started (after the Neos UI loaded the data of the nodes), replaces the property with an empty paragraph meanwhile,
 * hides it on focus and starts again after a re-render ("Übernehmen"): each time it is gone for a moment and the page
 * jumps. Here a property is empty as long as it has no text (also CKEditor's empty paragraph), checked on every change
 * before it is painted; an empty one keeps the height of a line and shows the placeholder over it until there is text.
 *
 * The text right away, also before the Neos UI loaded the nodes of a page (it only knows their types after a request):
 * by the name of the property, from all node types the Neos UI has from the start - a property has the same placeholder
 * in all of them ("text": "Bitte Text eingeben"). The type of the node, once known, decides; a name with different
 * placeholders in different node types waits for it.
 */
import {ATTRIBUTE} from './constants';
import {type Neos, nodeOf} from './neos';

const PLACEHOLDER = `${ATTRIBUTE}-placeholder`;
const EMPTY = `${ATTRIBUTE}-empty`;
/** The property is inline (a span): an inline block while it is empty */
const INLINE = `${ATTRIBUTE}-inline`;
/** The placeholder is the one of the type of its node (not guessed by the name of the property) */
const BY_TYPE = `${ATTRIBUTE}-placeholder-checked`;
/** Content without text that still is content */
const MEDIA = 'img, picture, video, audio, iframe, object, embed, svg, canvas, hr, table, figure';

type NodeTypes = Neos['nodeTypes'];

const configuredPlaceholder = (nodeTypes: NodeTypes, nodeType: string, name: string) =>
	nodeTypes.get(nodeType)?.properties?.[name]?.ui?.inline?.editorOptions?.placeholder;

/** Per name of a property: its placeholder in all node types that have one, null if they differ (per registry) */
const byName = new WeakMap<NodeTypes, Map<string, string | null>>();

function placeholdersByName(nodeTypes: NodeTypes): Map<string, string | null> {
	let placeholders = byName.get(nodeTypes);
	if (!placeholders) {
		placeholders = new Map();
		for (const [nodeType, definition] of Object.entries(nodeTypes.getAllAsObject())) {
			for (const name of Object.keys(definition?.properties ?? {})) {
				const placeholder = configuredPlaceholder(nodeTypes, nodeType, name);
				if (placeholder) {
					placeholders.set(name, placeholders.has(name) && placeholders.get(name) !== placeholder ? null : placeholder);
				}
			}
		}
		byName.set(nodeTypes, placeholders);
	}

	return placeholders;
}

/** Like the Neos UI: translated, without tags (a legacy placeholder may be "<p>…</p>"), its line breaks kept */
function text(placeholder: string, doc: Document, neos: Neos): string {
	const element = doc.createElement('div');
	element.innerHTML = neos.i18n.translate(placeholder, placeholder);
	element.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
	element.querySelectorAll('p, div, li').forEach((block) => block.append('\n'));

	return element.textContent?.trim() ?? '';
}

/** The text; '' without one; null while it depends on the type of the node and the Neos UI does not know the node yet */
function placeholderOf(property: HTMLElement, neos: Neos): string | null {
	const name = property.getAttribute('data-__neos-property') ?? '';
	const node = nodeOf(property, 'data-__neos-editable-node-contextpath', neos);
	if (node) {
		const placeholder = configuredPlaceholder(neos.nodeTypes, node.nodeType, name);
		return placeholder ? text(placeholder, property.ownerDocument, neos) : '';
	}
	const placeholder = placeholdersByName(neos.nodeTypes).get(name);

	return placeholder ? text(placeholder, property.ownerDocument, neos) : null;
}

function isEmpty(property: HTMLElement): boolean {
	return (property.textContent ?? '').replace(/[\s​ ]/g, '') === '' && !property.querySelector(MEDIA);
}

/** Every property: empty or not, its placeholder once the Neos UI knows its node (cheap: only attributes that change) */
export function syncPlaceholders(doc: Document, neos: Neos): void {
	doc.querySelectorAll<HTMLElement>('[data-__neos-property]').forEach((property) => {
		const empty = isEmpty(property);
		// before it is a block (styles/placeholders.css): how it is displayed by itself
		if (empty && !property.hasAttribute(EMPTY) && getComputedStyle(property).display.startsWith('inline')) {
			property.setAttribute(INLINE, '');
		}
		if (property.hasAttribute(EMPTY) !== empty) {
			property.toggleAttribute(EMPTY, empty);
		}
		// set once by the type of the node; by the name of the property until the node is known
		if (!property.hasAttribute(BY_TYPE)) {
			const placeholder = placeholderOf(property, neos);
			if (placeholder !== null && property.getAttribute(PLACEHOLDER) !== placeholder) {
				property.setAttribute(PLACEHOLDER, placeholder);
			}
			if (nodeOf(property, 'data-__neos-editable-node-contextpath', neos)) {
				property.setAttribute(BY_TYPE, '');
			}
		}
	});
}
