/** What this package reads from the Neos UI (its store and registries), typed only as far as it is used */
export type Neos = {
	store: {
		getState(): {cr?: {nodes?: {byContextPath?: Record<string, {nodeType: string} | undefined>}}};
		dispatch(action: unknown): void;
	};
	nodeTypes: {get(nodeType: string): {label?: string} | undefined};
	i18n: {translate(id: string, fallback: string): string};
};
