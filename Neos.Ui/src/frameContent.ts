import {actions} from '@neos-project/neos-ui-redux-store';
import {unstable_batchedUpdates as batchedUpdates} from 'react-dom';

import type {Neos} from './neos';

const FRAME_NAME = 'neos-content-main';
/** The nodes of the content of a page, if its backend delivers them (see README.md) */
const NODES_SELECTOR = 'script[type="application/json"][data-devclaim-neos-nodes]';
/** in case the Neos UI never gets the nodes of the page (an error in the frame): the trees do not load forever */
const TIMEOUT = 10000;

type Focus = {contextPaths: string[]; fusionPath: string | null};
type Dimensions = Record<string, unknown>;
type FrameState = {
	ui?: {contentCanvas?: {isLoading?: boolean}};
	cr?: {
		nodes?: {byContextPath?: Record<string, unknown>; focused?: Focus};
		contentDimensions?: {active?: Dimensions | null};
	};
};
type DocumentInformation = {metaData?: {documentNode?: string; contentDimensions?: {active?: Dimensions}}};

let pending = false;
let timer = 0;
const listeners = new Set<() => void>();

const setPending = (value: boolean) => {
	window.clearTimeout(timer);
	if (value) {
		timer = window.setTimeout(() => setPending(false), TIMEOUT);
	}
	if (pending !== value) {
		pending = value;
		listeners.forEach((listener) => listener());
	}
};

/** Whether a document is loaded again into the frame and the Neos UI does not have all its nodes yet */
export function isFrameContentPending(): boolean {
	return pending;
}

export function subscribeFrameContent(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

const frameDocument = () =>
	(document.getElementsByName(FRAME_NAME)[0] as HTMLIFrameElement | undefined)?.contentDocument ?? null;

/**
 * A document goes from the frame (navigation, reload, publish). The Neos UI starts loading on the unload event of the
 * frame, which browsers no longer fire reliably, so this starts it, as soon as the navigation starts. It stops loading
 * as soon as the next page is there, and only then gets the nodes of its content (after a publish all of them, the
 * nodes were reset): until they are in the store, the content is pending. A navigation that is cancelled (the
 * document stays, e.g. a download): stopped again.
 */
export function leaveFrameDocument(neos: Neos, previous: Document): void {
	const state = neos.store.getState() as FrameState;
	if (!state.ui?.contentCanvas?.isLoading) {
		neos.store.dispatch(actions.UI.ContentCanvas.startLoading());
	}
	setPending(true);
	window.setTimeout(() => {
		const isLoading = (neos.store.getState() as FrameState).ui?.contentCanvas?.isLoading;
		if (frameDocument() === previous && isLoading) {
			setPending(false);
			neos.store.dispatch(actions.UI.ContentCanvas.stopLoading());
		}
	}, TIMEOUT);
}

type NodeInfo = {isFullyLoaded?: boolean};

const documentInformation = (doc: Document) =>
	(doc.defaultView as {'@Neos.Neos.Ui:DocumentInformation'?: DocumentInformation} | null)?.[
		'@Neos.Neos.Ui:DocumentInformation'
	];

/** the nodes each page brought (see README.md), read once: empty if it brings none or they could not be read */
const pageNodes = new WeakMap<Document, Record<string, NodeInfo>>();

/**
 * The Neos UI gets the nodes of the content after the page loaded, with a request of its own (only those it does not
 * have fully loaded yet). When the page brings them along (optional, e.g. a headless frontend), they are put into the
 * store before: no second request, the content tree is complete together with the page. Read as JSON (not run in the
 * frame): plain objects of this window.
 */
function preloadPageNodes(neos: Neos, doc: Document): Record<string, NodeInfo> {
	const known = pageNodes.get(doc);
	if (known) {
		return known;
	}
	let nodes: Record<string, NodeInfo> = {};
	const script = doc.querySelector(NODES_SELECTOR);
	if (script) {
		try {
			nodes = JSON.parse(script.textContent ?? '') as Record<string, NodeInfo>;
		} catch (error) {
			console.error('Devclaim.NeosModernBackend: the nodes of the page could not be read', error);
		}
	}
	pageNodes.set(doc, nodes);
	if (Object.keys(nodes).length > 0) {
		neos.store.dispatch(actions.CR.Nodes.merge(nodes));
	}
	return nodes;
}

/**
 * Puts back what the store lost, e.g. after a publish: the Neos UI resets all nodes to those of the page tree (the
 * document without its content), then loads the same page again. The page still in the frame is unchanged, so the
 * content tree keeps its content meanwhile. Only the document and the nodes still marked in the page (a removed node
 * is not brought back), as they were in the store before the reset (with their policy and the changes since the page
 * loaded), else as the page brought them. Works with any frontend. Returns whether nodes were put back.
 */
function restoreLostNodes(
	neos: Neos,
	doc: Document,
	previousNodes: Record<string, unknown>,
	fromPage: Record<string, NodeInfo>
): boolean {
	const inStore = (neos.store.getState() as FrameState).cr?.nodes?.byContextPath ?? {};
	const contextPaths = [
		documentInformation(doc)?.metaData?.documentNode ?? null,
		...Array.from(doc.querySelectorAll('[data-__neos-node-contextpath]'), (element) =>
			element.getAttribute('data-__neos-node-contextpath')
		)
	];
	const restored: Record<string, unknown> = {};
	for (const contextPath of contextPaths) {
		if (!contextPath || contextPath in restored || (inStore[contextPath] as NodeInfo | undefined)?.isFullyLoaded) {
			continue;
		}
		const previous = previousNodes[contextPath] as NodeInfo | undefined;
		const node = previous?.isFullyLoaded ? previous : fromPage[contextPath];
		if (node) {
			restored[contextPath] = node;
		}
	}
	if (Object.keys(restored).length === 0) {
		return false;
	}
	neos.store.dispatch(actions.CR.Nodes.merge(restored));
	return true;
}

const adopted = new WeakSet<Document>();

/**
 * The Neos UI sets the active dimensions again for every page in the frame: new arrays, so a new object in the store
 * even if nothing changed, and everything depending on it loads again (e.g. the preview of the link editor shows
 * "Loading ..."). Values equal to those in the store are replaced by the arrays of the store before it reads them: it
 * assigns the same, the store keeps them.
 */
function adoptActiveDimensions(neos: Neos, doc: Document): void {
	if (adopted.has(doc)) {
		return;
	}
	adopted.add(doc);
	const fromPage = documentInformation(doc)?.metaData?.contentDimensions?.active;
	const inStore = (neos.store.getState() as FrameState).cr?.contentDimensions?.active;
	if (!fromPage || !inStore) {
		return;
	}
	for (const name of Object.keys(fromPage)) {
		if (name in inStore && JSON.stringify(fromPage[name]) === JSON.stringify(inStore[name])) {
			fromPage[name] = inStore[name];
		}
	}
}

const focusOf = (state: FrameState): Focus | null => {
	const focused = state.cr?.nodes?.focused;
	return focused && focused.contextPaths.length > 0 ? focused : null;
};

/**
 * Keeps the nodes of the page in the frame in the store, at the latest when the frame stops loading: the store notifies
 * its listeners before the Neos UI handles that action (and requests the nodes it is missing). Ends the pending content
 * once the page is loaded and the Neos UI has every node marked in it.
 */
export function watchFrameContent(neos: Neos): void {
	// the selection and the nodes before the last change of the store (a reset of the nodes clears them)
	let lastFocus: Focus | null = null;
	let lastNodes: Record<string, unknown> = {};
	const remember = () => {
		const state = neos.store.getState() as FrameState;
		lastFocus = focusOf(state);
		lastNodes = state.cr?.nodes?.byContextPath ?? {};
	};
	neos.store.subscribe(() => {
		const focusBefore = lastFocus;
		const nodesBefore = lastNodes;
		remember();
		const doc = frameDocument();
		if (!doc || doc.readyState === 'loading') {
			return;
		}
		adoptActiveDimensions(neos, doc);
		// The nodes were reset (a publish): the node selected before is selected again if it is still on the page. One
		// update for React: it never renders the store without the selection, the inspector and its editors stay
		// (remounted, they would load their previews again).
		batchedUpdates(() => {
			const fromPage = preloadPageNodes(neos, doc);
			if (restoreLostNodes(neos, doc, nodesBefore, fromPage) && focusBefore && !focusOf(neos.store.getState() as FrameState)) {
				const nodes = (neos.store.getState() as FrameState).cr?.nodes?.byContextPath ?? {};
				const [contextPath] = focusBefore.contextPaths;
				if (nodes[contextPath]) {
					neos.store.dispatch(actions.CR.Nodes.focus(contextPath, focusBefore.fusionPath));
				}
			}
		});
		remember();
		if (!pending) {
			return;
		}
		const state = neos.store.getState() as FrameState;
		if (state.ui?.contentCanvas?.isLoading) {
			return;
		}
		const nodes = state.cr?.nodes?.byContextPath ?? {};
		const contextPaths = Array.from(doc.querySelectorAll('[data-__neos-node-contextpath]'), (element) =>
			element.getAttribute('data-__neos-node-contextpath')
		);
		if (contextPaths.every((contextPath) => !contextPath || nodes[contextPath])) {
			setPending(false);
		}
	});
}
