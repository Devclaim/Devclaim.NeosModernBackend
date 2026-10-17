/** The styles are bundled as text (esbuild loader "text") and injected into the content frame */
declare module '*.css' {
	const css: string;
	export default css;
}

/** The part of the plugin API of the Neos UI this package uses (the package itself has no types) */
declare module '@neos-project/neos-ui-extensibility' {
	import type {Neos} from './neos';

	type Bootstrap = (
		globalRegistry: {get(key: string): unknown},
		context: {store: Neos['store']; frontendConfiguration: Record<string, unknown>}
	) => void;

	export default function manifest(identifier: string, options: object, bootstrap: Bootstrap): void;
}

/** Selectors and actions of the Neos UI store (only what this package uses) */
declare module '@neos-project/neos-ui-redux-store' {
	type State = unknown;
	type Selector<T> = (state: State) => T;
	type Check = (state: State, query: {subject: string; reference: string | null; role?: 'content'}) => boolean;
	type Paths = string[];

	export const selectors: {
		CR: {
			Nodes: {
				makeCanBeMovedAlongsideSelector(nodeTypes: unknown): Check;
				makeCanBeMovedIntoSelector(nodeTypes: unknown): Check;
				makeCanBePastedSelector(nodeTypes: unknown): Check;
				makeIsAllowedToAddChildOrSiblingNodes(
					nodeTypes: unknown
				): (state: State, query: {reference: string | null; role: 'document' | 'content' | null}) => boolean;
				makeGetNodeByContextPathSelector(contextPath: string | null): Selector<import('./neos').NeosNode | undefined>;
				siteNodeSelector: Selector<{contextPath: string} | undefined>;
				documentNodeSelector: Selector<{contextPath: string} | undefined>;
				focusedNodePathSelector: Selector<string | null>;
				focusedNodePathsSelector: Selector<Paths>;
				clipboardNodesContextPathsSelector: Selector<Paths>;
				destructiveOperationsAreDisabledForContentTreeSelector: Selector<boolean>;
			};
			Workspaces: {isWorkspaceReadOnlySelector: Selector<boolean>};
		};
		UI: {
			PageTree: {
				getFocused: Selector<string | null>;
				getAllFocused: Selector<Paths>;
				areFocusedNodesNestedInEachOther: Selector<boolean>;
				destructiveOperationsAreDisabledForPageTreeSelector: Selector<boolean>;
				getIsLoading: Selector<boolean>;
			};
			ContentTree: {getIsLoading: Selector<boolean>};
		};
	};
	export const actions: {
		CR: {
			Nodes: {
				moveMultiple(nodes: Paths, reference: string, position: 'before' | 'after' | 'into'): unknown;
				commenceCreation(reference: string | null, referenceNodeType: undefined, position: 'after' | 'into'): unknown;
				copyMultiple(nodes: Paths): unknown;
				cutMultiple(nodes: Paths): unknown;
				commenceRemovalMultiple(nodes: Paths): unknown;
				hideMultiple(nodes: Paths): unknown;
				showMultiple(nodes: Paths): unknown;
				paste(reference: string | null): unknown;
				reloadState(options: {merge: boolean}): unknown;
			};
		};
		UI: {
			ContentTree: {reloadTree(options: {merge: boolean}): unknown};
			PageTree: {commenceSearch(contextPath: string, options: {query: string; filterNodeType: string | null}): unknown};
			LeftSideBar: {toggle(): unknown; toggleContentTree(): unknown};
		};
	};
}

/** The components of the Neos UI (only what this package uses) */
declare module '@neos-project/react-ui-components' {
	import type {FC, MouseEventHandler} from 'react';

	export const Icon: FC<{icon: string; spin?: boolean; className?: string}>;
	export const IconButton: FC<{
		id?: string;
		icon: string;
		className?: string;
		title?: string;
		disabled?: boolean;
		hoverStyle?: 'clean' | 'brand' | 'darken';
		onClick?: MouseEventHandler<HTMLButtonElement>;
	}>;
}

/** The frontend configuration of the Neos UI (only what this package uses) */
declare module '@neos-project/neos-ui-configuration' {
	type Configuration = {
		nodeTree?: {presets?: Record<string, {baseNodeType?: string; ui?: {label?: string; icon?: string}} | undefined>};
	};

	export function getConfiguration<R>(selector: (configuration: Configuration) => R): R;
}
