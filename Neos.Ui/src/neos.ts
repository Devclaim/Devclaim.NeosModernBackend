/** What this package reads from the Neos UI (its store and registries), typed only as far as it is used */
export type Neos = {
	store: {
		getState(): {cr?: {nodes?: {byContextPath?: Record<string, NeosNode | undefined>}}};
		dispatch(action: unknown): void;
		subscribe(listener: () => void): () => void;
	};
	nodeTypes: {
		get(nodeType: string): NodeType | undefined;
		getAllAsObject(): Record<string, NodeType | undefined>;
		hasRole(nodeType: string, role: string): boolean;
		getRole(role: string): string | null;
		getSubTypesOf(nodeType: string): string[];
	};
	i18n: {translate(id: string, fallback: string): string};
};

export type NeosNode = {
	nodeType: string;
	isAutoCreated?: boolean;
	properties?: {_hidden?: boolean};
	policy?: {canEdit?: boolean; canRemove?: boolean; disallowedProperties?: string[]};
};

type NodeType = {
	label?: string;
	abstract?: boolean;
	ui?: {icon?: string};
	properties?: Record<string, {ui?: {inline?: {editorOptions?: {placeholder?: string}}}} | undefined>;
};

/** A node of the Neos UI store by the context path in an attribute of an element */
export function nodeOf(element: Element, attribute: string, neos: Neos): NeosNode | undefined {
	const contextPath = element.getAttribute(attribute);
	return contextPath ? neos.store.getState().cr?.nodes?.byContextPath?.[contextPath] : undefined;
}
