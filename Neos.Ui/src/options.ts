/** The settings (Neos.Neos.Ui.frontendConfiguration.'Devclaim.NeosModernBackend', Configuration/Settings.yaml) */
export type Options = {
	/** px between the node and its outline; less where the frame has no room for it */
	offset: number;
	/** px kept free to the edge of the frame there */
	gap: number;
	/** the outline moves from node to node (off with prefers-reduced-motion) */
	animate: boolean;
	/** ms of that movement */
	duration: number;
	/** drag and drop of the selected node in the page (zooming out), instead of the native one of the Neos UI */
	dragAndDrop: boolean;
	/** the document and content tree in the left sidebar in the style of the inspector */
	sidebar: boolean;
};

export function readOptions(configuration: unknown): Options {
	const settings = (configuration ?? {}) as Partial<Record<keyof Options, unknown>>;
	const number = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);

	return {
		offset: number(settings.offset, 10),
		gap: number(settings.gap, 8),
		animate: settings.animate !== false,
		duration: number(settings.duration, 180),
		dragAndDrop: settings.dragAndDrop !== false,
		sidebar: settings.sidebar !== false
	};
}
