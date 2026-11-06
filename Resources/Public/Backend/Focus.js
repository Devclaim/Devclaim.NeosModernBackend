/*
 * A search field of a backend module does not take the focus when the page opens (Neos sets autofocus on the ones of
 * the media and user modules): a phone would open its keyboard for it. It stays free until the user does something;
 * fields of forms keep their autofocus.
 */
(() => {
	const fields = [...document.querySelectorAll('input[type="search"][autofocus]')];
	let used = false;
	for (const type of ['pointerdown', 'keydown']) {
		window.addEventListener(type, () => (used = true), { capture: true, once: true });
	}
	fields.forEach((field) => {
		field.removeAttribute('autofocus');
		field.blur();
	});
	// the browser may already have noted the field for its first paint: focused then, without a focus event if the window
	// is in the background
	const release = () => {
		if (!used && fields.includes(document.activeElement)) {
			document.activeElement.blur();
		}
	};
	window.addEventListener('focusin', release, true);
	window.addEventListener('load', release);
	requestAnimationFrame(release);
})();
