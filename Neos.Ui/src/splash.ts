/**
 * The splash screen of the Neos UI: rendered into its app container, it is gone as soon as the app renders there - long
 * before the page in the content frame has loaded (an empty or half built backend shows), and without a transition.
 * Kept here as an overlay of its own (a copy, the app replaces the original) until the first page in the frame has
 * loaded, then faded out. At the latest after MAX_WAIT (no content frame, an error).
 */
const FADE = 300;
const MAX_WAIT = 15000;

/** Returns the release (fade out, then remove; once) */
export function holdSplashScreen(): () => void {
	const container = document.getElementById('appContainer');
	if (!container?.querySelector('.splash') || !document.body) {
		return () => {};
	}
	const overlay = document.createElement('div');
	overlay.setAttribute('data-devclaim-neos-modern-backend-splash', '');
	// the splash with its style (the animation of the logo)
	overlay.append(...Array.from(container.children, (child) => child.cloneNode(true)));
	Object.assign(overlay.style, {
		position: 'fixed',
		inset: '0',
		zIndex: '2147483647',
		transition: `opacity ${FADE}ms ease`
	});
	document.body.appendChild(overlay);

	let released = false;
	const release = () => {
		if (released) {
			return;
		}
		released = true;
		overlay.style.opacity = '0';
		overlay.style.pointerEvents = 'none';
		setTimeout(() => overlay.remove(), FADE);
	};
	setTimeout(release, MAX_WAIT);

	return release;
}

/** Calls then once the document of a frame has loaded (also its images, styles), after it was painted */
export function whenLoaded(frameWindow: Window, then: () => void): void {
	const painted = () => requestAnimationFrame(() => requestAnimationFrame(then));
	if (frameWindow.document.readyState === 'complete') {
		painted();
	} else {
		frameWindow.addEventListener('load', painted, {once: true});
	}
}
