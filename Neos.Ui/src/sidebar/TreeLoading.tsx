import React, {useRef} from 'react';
import {useSelector} from 'react-redux';
import {selectors} from '@neos-project/neos-ui-redux-store';

import type {TreeType} from './useTreeActions';

/** first: nothing to show yet (hidden, fades in); reloading: the tree is there and reloads or searches (dimmed) */
export type TreeLoadingState = 'first' | 'reloading' | null;

type LoadingState = {ui?: {pageTree?: {loading?: string[]}}; cr?: {nodes?: {byContextPath?: Record<string, unknown>}}};
type RootNode = {contextPath: string; children?: Array<{contextPath: string}>};

/**
 * The loading state of a whole tree. Expanding a node is left to the tree: the page tree loads the children of the node
 * then, a reload or search loads the site node (UI.PageTree.setAsLoading).
 */
export function useTreeLoading(treeType: TreeType): TreeLoadingState {
	const isPageTree = treeType === 'PageTree';
	const root = useSelector(isPageTree ? selectors.CR.Nodes.siteNodeSelector : selectors.CR.Nodes.documentNodeSelector) as
		| RootNode
		| undefined;
	const isLoading = useSelector((state: LoadingState) =>
		isPageTree
			? Boolean(root && state.ui?.pageTree?.loading?.includes(root.contextPath))
			: selectors.UI.ContentTree.getIsLoading(state)
	);
	// the content of a document comes with the page in the frame, after the document itself
	const hasChildren = useSelector((state: LoadingState) => {
		const first = root?.children?.[0];
		return !first || Boolean(state.cr?.nodes?.byContextPath?.[first.contextPath]);
	});
	const hasLoaded = useRef(false);
	if (root && hasChildren && !isLoading) {
		hasLoaded.current = true;
	}

	if (!hasLoaded.current) {
		return 'first';
	}
	return isLoading ? 'reloading' : null;
}

/** The blue progress line on top of the tree: while it loads the first time (it fades in then) and on reload or search */
export function TreeLoading({state}: {state: TreeLoadingState}) {
	return state ? (
		<div className="devclaim-tree-progress" role="progressbar">
			<span />
		</div>
	) : null;
}
