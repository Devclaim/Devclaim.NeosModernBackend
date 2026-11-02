/*
 * The menu of the backend modules stays open while the pointer merely leaves it. Its button, an intentional outside
 * click, or Escape closes it. Escape is captured before a module can consume it. Closed the way its button does
 * (Neos.Neos MenuPanel): the class on the body, the button no longer pressed.
 */
(() => {
	const isOpen = () => document.body.classList.contains('neos-menu-panel-open');
	const isEscape = (event) =>
		event.key === 'Escape' || event.key === 'Esc' || event.code === 'Escape' || event.keyCode === 27;

	const close = () => {
		document.body.classList.remove('neos-menu-panel-open');
		document.querySelectorAll('.neos-menu-button').forEach((button) => button.classList.remove('neos-pressed'));
	};

	window.addEventListener('keydown', (event) => {
		if (isEscape(event) && isOpen()) {
			event.preventDefault();
			event.stopPropagation();
			close();
		}
	}, true);

	window.addEventListener('click', (event) => {
		if (!isOpen() || !(event.target instanceof Element)) return;
		if (event.target.closest('.neos-menu-button, #neos-menu-panel, .neos-menu-panel')) return;
		close();
	}, true);
})();
