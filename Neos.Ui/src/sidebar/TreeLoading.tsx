import React, {useEffect, useReducer, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import {selectors} from '@neos-project/neos-ui-redux-store';

import {isFrameContentPending, subscribeFrameContent} from '../frameContent';
import type {TreeType} from './useTreeActions';

/** first: nothing to show yet (hidden, fades in); reloading: the tree is there and reloads or searches (dimmed) */
export type TreeLoadingState = 'first' | 'reloading' | null;

type LoadingState = {
	ui?: {pageTree?: {loading?: string[]}; contentTree?: {loading?: string[]}; contentCanvas?: {isLoading?: boolean}};
	cr?: {nodes?: {byContextPath?: Record<string, unknown>}};
};
type RootNode = {contextPath: string; children?: Array<{contextPath: string}>};

/** ms a tree stays dimmed after it loaded again: loads that follow each other (a publish) are one, without flicker */
const RELOAD_HOLD = 150;

/**
 * The loading state of a whole tree. Expanding a node is left to the tree: the page tree loads the children of the node
 * then, a reload or search loads the site node (UI.PageTree.setAsLoading).
 */
export function useTreeLoading(treeType: TreeType): TreeLoadingState {
	const state = useCurrentTreeLoading(treeType);
	const [isHeld, setHeld] = useState(false);
	// set while rendering: the first render without loading is held already (no frame undimmed)
	const wasReloading = useRef(false);
	const holds = state === null && (wasReloading.current || isHeld);
	if (state !== null) {
		wasReloading.current = state === 'reloading';
	}
	useEffect(() => {
		if (state !== null || !wasReloading.current) {
			setHeld(false);
			return undefined;
		}
		wasReloading.current = false;
		setHeld(true);
		const timer = window.setTimeout(() => setHeld(false), RELOAD_HOLD);
		return () => window.clearTimeout(timer);
	}, [state]);

	return holds ? 'reloading' : state;
}

function useCurrentTreeLoading(treeType: TreeType): TreeLoadingState {
	const isPageTree = treeType === 'PageTree';
	const root = useSelector(isPageTree ? selectors.CR.Nodes.siteNodeSelector : selectors.CR.Nodes.documentNodeSelector) as
		| RootNode
		| undefined;
	const site = useSelector(selectors.CR.Nodes.siteNodeSelector) as RootNode | undefined;
	const isLoading = useSelector((state: LoadingState) =>
		isPageTree
			? Boolean(root && state.ui?.pageTree?.loading?.includes(root.contextPath))
			: selectors.UI.ContentTree.getIsLoading(state) ||
				Boolean(root && state.ui?.contentTree?.loading?.includes(root.contextPath)) ||
				// all nodes are loaded again (after a publish), then the same document reloads in the frame: its content
				// comes again with the page
				Boolean(site && state.ui?.pageTree?.loading?.includes(site.contextPath)) ||
				Boolean(state.ui?.contentCanvas?.isLoading)
	);
	// the content of a document comes with the page in the frame, after the document itself
	const hasChildren = useSelector((state: LoadingState) => {
		const first = root?.children?.[0];
		return !first || Boolean(state.cr?.nodes?.byContextPath?.[first.contextPath]);
	});
	// a document loaded again into the frame (reload, publish): its content comes with the page, all at once
	const [, update] = useReducer((count: number) => count + 1, 0);
	useEffect(() => (isPageTree ? undefined : subscribeFrameContent(update)), [isPageTree]);
	const isContentPending = !isPageTree && isFrameContentPending();
	// A content tree is loaded for one document only. When the document changes, its node is available before its
	// content children, so keep the completed load tied to the root instead of remembering it for the hook forever.
	const loadedRoot = useRef<string | null>(null);
	if (root && hasChildren && !isLoading && !isContentPending) {
		loadedRoot.current = root.contextPath;
	}

	if (!root || loadedRoot.current !== root.contextPath) {
		return 'first';
	}
	// the same document again (reload, publish): the tree keeps its content (frameContent.ts) until the page is there
	return isLoading || isContentPending || !hasChildren ? 'reloading' : null;
}

/** The blue progress line on top of the tree: while it loads the first time (it fades in then) and on reload or search */
export function TreeLoading({state}: {state: TreeLoadingState}) {
	return state ? (
		<div className="devclaim-tree-progress" role="progressbar">
			<span />
		</div>
	) : null;
}
