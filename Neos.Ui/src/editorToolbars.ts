/**
 * Only the toolbar of the text being edited is shown. The Neos UI hides a toolbar of CKEditor when its editor loses the
 * focus, which gets lost while one of its dropdowns is open. A toolbar stays while its property is focused (CKEditor:
 * ck-focused) or the focus is in the user interface of CKEditor (the toolbar, the link form outside of it).
 */
export function hideStaleEditorToolbars(doc: Document): void {
	doc.querySelectorAll<HTMLElement>('.neos-ck-anchored-toolbar--visible').forEach((toolbar) => {
		const anchor = toolbar.style.getPropertyValue('position-anchor');
		const property = anchor ? doc.querySelector(`[data-neos-inline-editor-anchor-name="${anchor}"]`) : null;
		const active = doc.activeElement;
		const inEditorUi = active && (toolbar.contains(active) || active.closest('.ck-body-wrapper, .ck-balloon-panel'));
		if (property && !property.classList.contains('ck-focused') && !inEditorUi) {
			toolbar.classList.remove('neos-ck-anchored-toolbar--visible');
		}
	});
}
