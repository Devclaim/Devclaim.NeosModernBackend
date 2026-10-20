/** The content frame of the Neos UI; it is loaded again for every document, the element can be replaced */
const NAME = 'neos-content-main';

/** The window of the content frame, with its own globals (observers made there go away with its document) */
export type FrameWindow = Window & typeof globalThis;

/**
 * Calls onLoad with the window of the content frame for every document loaded into it: as soon as there is one, while
 * it is still being parsed (before it is painted: placeholders, styles), at the latest on its load event. Not for the
 * empty document of a new frame (about:blank). onLeave: a document is about to go (navigation, reload), as soon as it
 * starts (beforeunload, the request for the next one is still running) and at the latest when it goes (pagehide).
 */
export function watchGuestFrame(
	onLoad: (frameWindow: FrameWindow) => void,
	onLeave: (previous: Document) => void
): void {
	let current: HTMLIFrameElement | null = null;

	const handle = (frame: HTMLIFrameElement) => {
		const frameWindow = frame.contentWindow as FrameWindow | null;
		if (!frameWindow?.document.documentElement || frameWindow.location.href === 'about:blank') {
			return false;
		}
		onLoad(frameWindow);
		const doc = frameWindow.document;
		frameWindow.addEventListener('beforeunload', () => onLeave(doc), {once: true});
		// the next document: watched from when this one goes
		frameWindow.addEventListener(
			'pagehide',
			() => {
				onLeave(doc);
				waitForNextDocument(frame, doc);
			},
			{once: true}
		);
		return true;
	};

	const waitForNextDocument = (frame: HTMLIFrameElement, previous: Document) => {
		const poll = () => {
			if (frame !== current) {
				return;
			}
			const doc = frame.contentDocument;
			if (doc && doc !== previous && handle(frame)) {
				return;
			}
			requestAnimationFrame(poll);
		};
		requestAnimationFrame(poll);
	};

	// the load event too, in case the polling missed a document (attach only runs once per document)
	const handleLoad = (event: Event) => handle(event.target as HTMLIFrameElement);

	const check = () => {
		const frame = (document.getElementsByName(NAME)[0] as HTMLIFrameElement | undefined) ?? null;
		if (frame === current) {
			return;
		}
		current?.removeEventListener('load', handleLoad);
		current = frame;
		if (frame) {
			frame.addEventListener('load', handleLoad);
			// not there yet (the empty document of a new frame): the next one
			if (!handle(frame) && frame.contentDocument) {
				waitForNextDocument(frame, frame.contentDocument);
			}
		}
	};

	new MutationObserver(check).observe(document.body, {childList: true, subtree: true});
	check();
}
