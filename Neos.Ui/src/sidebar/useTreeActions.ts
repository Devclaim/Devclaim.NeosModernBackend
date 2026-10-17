import {useMemo} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';
import {actions, selectors} from '@neos-project/neos-ui-redux-store';

import type {Neos} from '../neos';

export type TreeType = 'PageTree' | 'ContentTree';

export type TreeAction = {
	id: string;
	icon: string;
	label: string;
	/** pressed: the selection is in the clipboard */
	isActive?: boolean;
	disabled?: boolean;
	/** the icon turns (refresh while the tree loads) */
	spin?: boolean;
	run(): void;
};

/** What the toolbar of the Neos UI knows about the selection of a tree (NodeTreeToolBar, makeMapStateToProps) */
function useSelection(treeType: TreeType, nodeTypes: Neos['nodeTypes']) {
	const isDocument = treeType === 'PageTree';
	const canBePastedSelector = useMemo(() => selectors.CR.Nodes.makeCanBePastedSelector(nodeTypes), [nodeTypes]);
	const canAddSelector = useMemo(() => selectors.CR.Nodes.makeIsAllowedToAddChildOrSiblingNodes(nodeTypes), [nodeTypes]);

	return useSelector((state: {cr?: {nodes?: {clipboardMode?: string}}}) => {
		const focused = isDocument ? selectors.UI.PageTree.getFocused(state) : selectors.CR.Nodes.focusedNodePathSelector(state);
		const allFocused = isDocument ? selectors.UI.PageTree.getAllFocused(state) : selectors.CR.Nodes.focusedNodePathsSelector(state);
		const nodes = allFocused.map((contextPath) => selectors.CR.Nodes.makeGetNodeByContextPathSelector(contextPath)(state));
		const focusedNode = selectors.CR.Nodes.makeGetNodeByContextPathSelector(focused)(state);
		const clipboard = selectors.CR.Nodes.clipboardNodesContextPathsSelector(state) ?? [];
		const nested = selectors.UI.PageTree.areFocusedNodesNestedInEachOther(state);
		const inClipboard = clipboard.length === allFocused.length && allFocused.every((path) => clipboard.includes(path));
		const role = focusedNode ? (nodeTypes.hasRole(focusedNode.nodeType, 'document') ? 'document' : 'content') : null;
		const destructiveDisabled =
			nested ||
			(isDocument
				? selectors.UI.PageTree.destructiveOperationsAreDisabledForPageTreeSelector(state)
				: selectors.CR.Nodes.destructiveOperationsAreDisabledForContentTreeSelector(state));

		return {
			focused,
			allFocused,
			isReadOnly: selectors.CR.Workspaces.isWorkspaceReadOnlySelector(state),
			isLoading: isDocument ? selectors.UI.PageTree.getIsLoading(state) : selectors.UI.ContentTree.getIsLoading(state),
			isHidden: Boolean(focusedNode?.properties?._hidden),
			canAdd: canAddSelector(state, {reference: focused, role}),
			canEdit: nodes.every((node) => node?.policy?.canEdit),
			canRemove: !nested && nodes.every((node) => node?.policy?.canRemove),
			canToggleVisibility: nodes.every((node) => !node?.policy?.disallowedProperties?.includes('_hidden')),
			canPaste:
				clipboard.length > 0 && clipboard.every((subject) => canBePastedSelector(state, {subject, reference: focused})),
			destructiveDisabled,
			isCut: inClipboard && state.cr?.nodes?.clipboardMode === 'Move',
			isCopied: inClipboard && state.cr?.nodes?.clipboardMode === 'Copy'
		};
	}, shallowEqual);
}

export type NodeActions = {
	add: TreeAction;
	/** hide, copy, cut, paste */
	edit: TreeAction[];
	remove: TreeAction;
};

const translator = (neos: Neos) => (id: string, fallback: string) => neos.i18n.translate(`Neos.Neos.Ui:Main:${id}`, fallback);

/**
 * The actions of the toolbar of a tree in the Neos UI for its selected node, enabled as the toolbar enables them
 * (computed once per tree: the row below the header, its context menu)
 */
export function useNodeActions(treeType: TreeType, neos: Neos): NodeActions {
	const dispatch = useDispatch();
	const s = useSelection(treeType, neos.nodeTypes);
	const t = translator(neos);
	const id = (name: string) => `neos-${treeType}-${name}`;
	const editable = !s.isReadOnly;
	const changeable = editable && !s.destructiveDisabled && s.canEdit;

	return {
		add: {
			id: id('AddNode'),
			icon: 'plus',
			label: t('createNew', 'Create new'),
			disabled: !editable || !s.canAdd,
			run: () => dispatch(actions.CR.Nodes.commenceCreation(s.focused, undefined, treeType === 'PageTree' ? 'after' : 'into'))
		},
		edit: [
			{
				id: id('HideSelectedNode'),
				icon: s.isHidden ? 'eye' : 'eye-slash',
				label: t('hideUnhide', 'Hide / Unhide'),
				disabled: !changeable || !s.canToggleVisibility,
				run: () => dispatch((s.isHidden ? actions.CR.Nodes.showMultiple : actions.CR.Nodes.hideMultiple)(s.allFocused))
			},
			{
				id: id('CopySelectedNode'),
				icon: 'far copy',
				label: t('copy', 'Copy'),
				isActive: s.isCopied,
				disabled: !editable,
				run: () => dispatch(actions.CR.Nodes.copyMultiple(s.allFocused))
			},
			{
				id: id('CutSelectedNode'),
				icon: 'cut',
				label: t('cut', 'Cut'),
				isActive: s.isCut,
				disabled: !changeable,
				run: () => dispatch(actions.CR.Nodes.cutMultiple(s.allFocused))
			},
			{
				id: id('PasteClipBoardNode'),
				icon: 'paste',
				label: t('paste', 'Paste'),
				disabled: !editable || !s.canPaste,
				run: () => dispatch(actions.CR.Nodes.paste(s.focused))
			}
		],
		remove: {
			id: id('DeleteSelectedNode'),
			icon: 'trash-alt',
			label: t('delete', 'Delete'),
			disabled: !changeable || !s.canRemove,
			run: () => dispatch(actions.CR.Nodes.commenceRemovalMultiple(s.allFocused))
		}
	};
}

/** Reloading the tree (in its header): only reads whether it loads */
export function useRefreshAction(treeType: TreeType, neos: Neos): TreeAction {
	const dispatch = useDispatch();
	const isLoading = useSelector(
		treeType === 'PageTree' ? selectors.UI.PageTree.getIsLoading : selectors.UI.ContentTree.getIsLoading
	);

	return {
		id: `neos-${treeType}-RefreshPageTree`,
		icon: 'sync',
		label: translator(neos)('refresh', 'Refresh'),
		disabled: isLoading,
		spin: isLoading,
		run: () =>
			dispatch(
				treeType === 'PageTree' ? actions.CR.Nodes.reloadState({merge: true}) : actions.UI.ContentTree.reloadTree({merge: true})
			)
	};
}
