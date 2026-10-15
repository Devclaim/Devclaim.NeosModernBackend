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
	type Check = (state: unknown, query: {subject: string; reference: string; role: 'content'}) => boolean;

	export const selectors: {
		CR: {Nodes: {makeCanBeMovedAlongsideSelector(nodeTypes: unknown): Check; makeCanBeMovedIntoSelector(nodeTypes: unknown): Check}};
	};
	export const actions: {
		CR: {Nodes: {moveMultiple(nodes: string[], reference: string, position: 'before' | 'after' | 'into'): unknown}};
	};
}
