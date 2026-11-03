/*
 * The change between the content module and the backend modules, both ways (Transition.css). A click on a link to
 * another module (or the content module) leaves the page as it is while the next one is there soon: an instant change.
 * Only when it takes longer the splash screen of the Neos UI fades in over the page, and the next page keeps it from
 * its first paint (KEY in the session storage, read in the head of a module page: Templates/Backend/Module/Index.html)
 * until it has loaded, then fades it out. The content module shows that splash by itself (Neos.Ui/src/splash.ts).
 */
(() => {
	// also in Templates/Backend/Module/Index.html
	const KEY = 'devclaim-neos-modern-backend-transition';
	const ATTRIBUTE = 'data-devclaim-transition';
	// a page there sooner changes at once, without the splash
	const DELAY = 120;
	const FADE = 300;
	// the next page never came (a download, a cancelled navigation): the page is shown again
	const MAX_WAIT = 10000;

	const root = document.documentElement;
	let timer = 0;

	const hide = () => {
		clearTimeout(timer);
		if (!root.hasAttribute(ATTRIBUTE)) return;
		root.setAttribute(ATTRIBUTE, 'out');
		timer = setTimeout(() => root.removeAttribute(ATTRIBUTE), FADE);
	};

	// arriving with the splash on: off once the page has loaded (its styles, images) and been painted
	if (root.getAttribute(ATTRIBUTE) === 'on') {
		const painted = () => requestAnimationFrame(() => requestAnimationFrame(hide));
		if (document.readyState === 'complete') {
			painted();
		} else {
			window.addEventListener('load', painted, {once: true});
		}
		timer = setTimeout(hide, MAX_WAIT);
	}
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// no session storage: no splash on the next page, it is still dark from its first paint
	}

	// the module of a backend URL: /neos/management/workspace/… → neos/management/workspace, /neos/content → neos/content
	const moduleOf = (url) => url.pathname.split('/').slice(1, 4).join('/');

	// captured: the menu of the content module stops some clicks on its links (Drawer.js); whether a click navigates is
	// only known after all listeners, so it is checked once the delay is over (defaultPrevented)
	window.addEventListener(
		'click',
		(event) => {
			const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
			if (
				!(link instanceof HTMLAnchorElement)
				|| event.button !== 0
				|| event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
				|| link.hasAttribute('download')
				|| (link.target && link.target !== '_self')
			) return;

			const url = new URL(link.href, location.href);
			if (url.origin !== location.origin || !url.pathname.startsWith('/neos/') || moduleOf(url) === moduleOf(location)) return;

			clearTimeout(timer);
			timer = setTimeout(() => {
				if (event.defaultPrevented) return;
				root.setAttribute(ATTRIBUTE, 'in');
				try {
					sessionStorage.setItem(KEY, String(Date.now()));
				} catch {
					// the next page without the splash
				}
				timer = setTimeout(hide, MAX_WAIT);
			}, DELAY);
		},
		true,
	);

	// back to this page from the browser's cache: as it was, without the splash
	window.addEventListener('pageshow', (event) => {
		if (!event.persisted) return;
		clearTimeout(timer);
		root.removeAttribute(ATTRIBUTE);
	});
})();
