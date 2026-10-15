/** The content frame of the Neos UI; it is loaded again for every document, the element can be replaced */
const NAME = 'neos-content-main';

/** The window of the content frame, with its own globals (observers made there go away with its document) */
export type FrameWindow = Window & typeof globalThis;

/** Calls onLoad with the window of the content frame, for every document loaded into it */
export function watchGuestFrame(onLoad: (frameWindow: FrameWindow) => void): void {
	let current: HTMLIFrameElement | null = null;

	const handleLoad = (event: Event) => {
		const frame = event.target as HTMLIFrameElement;
		if (frame.contentWindow) {
			onLoad(frame.contentWindow as FrameWindow);
		}
	};

	const check = () => {
		const frame = (document.getElementsByName(NAME)[0] as HTMLIFrameElement | undefined) ?? null;
		if (frame === current) {
			return;
		}
		current?.removeEventListener('load', handleLoad);
		current = frame;
		if (frame) {
			frame.addEventListener('load', handleLoad);
			if (frame.contentWindow && frame.contentDocument?.readyState === 'complete') {
				onLoad(frame.contentWindow as FrameWindow);
			}
		}
	};

	new MutationObserver(check).observe(document.body, {childList: true, subtree: true});
	check();
}
