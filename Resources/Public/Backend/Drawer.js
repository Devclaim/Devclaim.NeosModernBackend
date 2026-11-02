/*
 * The menu of the content module: a section opens and closes with its chevron only. The Neos UI makes its whole header
 * the toggle, so a click on the link of a section (Verwaltung) closed or opened it as well, and the backend modules
 * open with that state (both menus keep it in the same place). The click on such a link stays the link's: it does not
 * reach the header (the React handlers listen at the root, after this listener at the window). The drawer stays open
 * when the pointer leaves it; an intentional click outside it or Escape closes it.
 */
(() => {
	const isEscape = (event) =>
		event.key === 'Escape' || event.key === 'Esc' || event.code === 'Escape' || event.keyCode === 27;

	const closeDrawerOnEscape = (event) => {
		if (!isEscape(event)) return;

		if (closeDrawer()) {
			event.preventDefault();
			event.stopPropagation();
		}
	};

	const closeDrawer = () => {
		const toggle = document.querySelector("#neos-MenuToggler[aria-expanded='true']");
		if (!(toggle instanceof HTMLElement)) return false;
		toggle.click();
		return true;
	};

	const closeDrawerFromFrameClick = () => closeDrawer();

	const watchedFrames = new WeakSet();

	const listenForEscapeInFrame = (frame) => {
		try {
			frame.contentWindow?.addEventListener('keydown', closeDrawerOnEscape, true);
			frame.contentWindow?.addEventListener('click', closeDrawerFromFrameClick, true);
		} catch {
			// A cross-origin frame cannot expose its keyboard events to the backend frame.
		}
	};

	const watchFrame = (frame) => {
		if (!watchedFrames.has(frame)) {
			watchedFrames.add(frame);
			frame.addEventListener('load', () => listenForEscapeInFrame(frame));
		}
		listenForEscapeInFrame(frame);
	};

	const watchFramesIn = (root) => {
		if (root instanceof HTMLIFrameElement) watchFrame(root);
		if (root instanceof Element || root instanceof Document) root.querySelectorAll('iframe').forEach(watchFrame);
	};

	window.addEventListener(
		'click',
		(event) => {
			const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
			if (link && link.closest("[class*='_drawer__menuItem__header']") && !link.closest("[class*='_panel__toggleBtn']")) {
				event.stopPropagation();
			}
		},
		true,
	);

	// Neos closes its drawer after a short mouse-leave timeout. Stop that delegated React event at the window.
	window.addEventListener(
		'mouseout',
		(event) => {
			const drawer = event.target instanceof Element ? event.target.closest("[class*='_drawer']:not([class*='_drawer_'])") : null;
			if (drawer && (!(event.relatedTarget instanceof Element) || !drawer.contains(event.relatedTarget))) {
				event.stopPropagation();
			}
		},
		true,
	);

	window.addEventListener(
		'click',
		(event) => {
			const toggle = document.querySelector("#neos-MenuToggler[aria-expanded='true']");
			const target = event.target instanceof Element ? event.target : null;
			if (!(toggle instanceof HTMLElement) || !target || toggle.contains(target)) return;

			const drawer = document.querySelector("[class*='_drawer']:not([class*='_drawer_'])");
			if (!(drawer instanceof Element) || !drawer.contains(target)) closeDrawer();
		},
		true,
	);

	window.addEventListener('keydown', closeDrawerOnEscape, true);

	// Keyboard events do not bubble out of the editable preview iframe. Neos adds that iframe after this script has
	// loaded and replaces its document while editing, so watch both insertion and each subsequent frame load.
	watchFramesIn(document);
	new MutationObserver((mutations) => {
		mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => watchFramesIn(node)));
	}).observe(document.documentElement, {childList: true, subtree: true});
})();

/*
 * A section without entries (Moderation) has no chevron: there is nothing to open (Chrome.css). The page cannot tell
 * (a closed section shows no entries either), the menu of the Neos UI can: its data (#initialData, "menu": the
 * sections in the order of the menu, each with its children) marks the sections without children.
 */
(() => {
	// per section of the menu whether it has no children; null until the data is on the page
	let empty = null;
	const readMenu = () => {
		const data = document.getElementById('initialData');
		if (!data) {
			return null;
		}
		try {
			const menu = JSON.parse(data.textContent ?? '{}').menu ?? {};
			return Object.values(menu).map((section) => !Array.isArray(section?.children) || section.children.length === 0);
		} catch {
			return [];
		}
	};

	const mark = () => {
		empty ??= readMenu();
		const wrapper = empty && empty.includes(true)
			? document.querySelector("[class*='_drawer__menuItemGroupsWrapper']")
			: null;
		if (!wrapper) {
			return;
		}
		Array.from(wrapper.children).forEach((section, index) => {
			section.toggleAttribute('data-dc-empty', empty[index] === true);
		});
	};

	new MutationObserver(mark).observe(document.documentElement, { childList: true, subtree: true });
	mark();
})();
