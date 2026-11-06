/*
 * The compare of a change (Compare.fusion): every [data-compare] of the page, also ones added later (htmx of the
 * workspace module, older entries of the activity log). The frames load the node previews of the styleguide adapter
 * once the compare comes into view, a placeholder over them until they are ready; the views side by side and slider (a
 * line to drag); the changed words marked in the rendered website (the frames have the origin of the backend, so their
 * documents can be read). A side the website cannot show (data-node-preview-unavailable) is left out, the whole compare
 * when neither can.
 *
 * The window of a preview (rounded, sheet, placeholder, waiting for fonts) is the styleguide's: window.DevclaimPreview
 * (Preview.js of Devclaim.NeosStyleguide, loaded before this script).
 *
 * window.DevclaimCompare.markField(element): a changed field (data-old, data-new) with its changed words marked, for
 * the field lists of the modules.
 */
(() => {
	const MAX_CELLS = 250000;
	const preview = window.DevclaimPreview;

	/** words and the spaces between them, so a diff keeps the text as it was */
	const tokens = (text) => text.split(/(\s+)/).filter((token) => token !== '');

	/**
	 * A word diff (longest common subsequence): a list of [kind, text], kind "same", "del" or "ins". Too long texts:
	 * one deletion and one insertion
	 */
	function diff(oldText, newText) {
		const a = tokens(oldText);
		const b = tokens(newText);
		if (a.length * b.length > MAX_CELLS) {
			return [['del', oldText], ['ins', newText]];
		}
		const lengths = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
		for (let i = a.length - 1; i >= 0; i--) {
			for (let j = b.length - 1; j >= 0; j--) {
				lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
			}
		}
		const parts = [];
		const push = (kind, text) => {
			const last = parts[parts.length - 1];
			if (last && last[0] === kind) {
				last[1] += text;
			} else {
				parts.push([kind, text]);
			}
		};
		let i = 0;
		let j = 0;
		while (i < a.length && j < b.length) {
			if (a[i] === b[j]) {
				push('same', a[i]);
				i++;
				j++;
			} else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
				push('del', a[i++]);
			} else {
				push('ins', b[j++]);
			}
		}
		while (i < a.length) push('del', a[i++]);
		while (j < b.length) push('ins', b[j++]);
		return parts;
	}

	/** the parts of one side as nodes: the other side's changes left out */
	function fragment(document, parts, side) {
		const result = document.createDocumentFragment();
		for (const [kind, text] of parts) {
			if (kind === 'same') {
				result.append(text);
			} else if ((kind === 'del' && side !== 'after') || (kind === 'ins' && side !== 'before')) {
				const mark = document.createElement(kind);
				mark.textContent = text;
				result.append(mark);
			}
		}
		return result;
	}

	/** a changed field: old and new as one text with the changed words marked */
	function markField(field) {
		const parts = diff(field.dataset.old ?? '', field.dataset.new ?? '');
		field.replaceChildren(fragment(document, parts, 'both'));
	}

	const textNodes = (document) => {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) =>
				node.textContent.trim() === '' || node.parentElement?.closest('script, style')
					? NodeFilter.FILTER_REJECT
					: NodeFilter.FILTER_ACCEPT
		});
		const nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);
		return nodes;
	};

	const MARK_STYLE =
		'ins{background:#c9f0d4;color:#0b4a1f;text-decoration:none}' +
		'del{background:#fde1df;color:#7a1d16;text-decoration:line-through}';

	/**
	 * The changed words in the rendered website, before and after: only where both have the same text nodes (the same
	 * structure, the texts changed); a changed structure is shown as it is
	 */
	function markFrames(before, after) {
		const beforeNodes = textNodes(before);
		const afterNodes = textNodes(after);
		if (beforeNodes.length !== afterNodes.length) {
			return;
		}
		for (const document of [before, after]) {
			const style = document.createElement('style');
			style.textContent = MARK_STYLE;
			document.head.append(style);
		}
		beforeNodes.forEach((beforeNode, index) => {
			const afterNode = afterNodes[index];
			if (beforeNode.textContent === afterNode.textContent) {
				return;
			}
			const parts = diff(beforeNode.textContent, afterNode.textContent);
			beforeNode.replaceWith(fragment(before, parts, 'before'));
			afterNode.replaceWith(fragment(after, parts, 'after'));
		});
	}

	/**
	 * The height of the rendered node: its root element (data-styleguide-root, PROTOCOL.md of the styleguide), not the
	 * page, which may be as high as the frame (100vh) and would grow with it
	 */
	const rootOf = (document) => document?.querySelector('[data-styleguide-root]') ?? document?.body ?? null;

	const isUnavailable = (frame) => frame.contentDocument?.querySelector('[data-node-preview-unavailable]') != null;

	/**
	 * The zoom of the previews: the website renders at the width of the frame divided by it (at 50 % a frame of 650px
	 * shows the website at 1300px, its desktop layout) and is scaled down into the frame. One zoom for all compares of
	 * the page, remembered in the browser.
	 */
	const ZOOMS = [0.33, 0.5, 0.67, 0.75, 1];
	const ZOOM_KEY = 'devclaim-compare-zoom';
	let zoom = 0.5;
	try {
		const saved = Number(localStorage.getItem(ZOOM_KEY));
		if (ZOOMS.includes(saved)) {
			zoom = saved;
		}
	} catch {
		// no storage: the default
	}

	/** the room of the sheet around a frame, in px (padding in Compare.css) */
	const INSET = preview.inset;

	/** the frames at the zoom, as wide as their viewport allows: the width the website renders at */
	function place(frames) {
		let rendered = 0;
		for (const frame of frames) {
			const viewport = frame.closest('.dc-compare__viewport');
			rendered = Math.round((viewport.clientWidth - 2 * INSET) / zoom);
			frame.style.width = `${rendered}px`;
			frame.style.transform = `scale(${zoom})`;
		}
		return rendered;
	}

	function setHeight(frames, height) {
		for (const frame of frames) {
			frame.style.height = `${height}px`;
			frame.closest('.dc-compare__viewport').style.height = `${Math.ceil(height * zoom) + 2 * INSET}px`;
		}
	}

	/** the height of every view seen, by its nodes and width: a compare opened again has the right size at once */
	const heights = new Map();
	const heightKey = (frames, rendered) => {
		const refs = [...frames[0].closest('[data-pane]').querySelectorAll('iframe[data-ref]')].map((frame) => frame.dataset.ref);
		return `${refs.sort().join(' ')} ${rendered}`;
	};

	/** the frames of a view at the zoom, as high as the highest node, measured at the width they render at */
	function fit(frames) {
		const rendered = place(frames);
		const measured = frames.map((frame) => {
			const root = rootOf(frame.contentDocument);
			return root ? Math.ceil(root.getBoundingClientRect().bottom) : 0;
		});
		const height = Math.max(120, ...measured);
		heights.set(heightKey(frames, rendered), height);
		setHeight(frames, height);
	}

	/** all loaded frames of the page again, after the zoom or the width changed */
	function refitAll() {
		document.querySelectorAll('[data-compare] [data-pane]').forEach((pane) => {
			const frames = [...pane.querySelectorAll('iframe[data-ref][src]')].filter((frame) => !frame.closest('[hidden]'));
			if (frames.length > 0) {
				fit(frames);
			}
		});
		document.querySelectorAll('[data-zoom-value]').forEach((value) => (value.textContent = `${Math.round(zoom * 100)} %`));
	}

	function setZoom(step) {
		const index = ZOOMS.indexOf(zoom) + step;
		if (index < 0 || index >= ZOOMS.length) {
			return;
		}
		zoom = ZOOMS[index];
		try {
			localStorage.setItem(ZOOM_KEY, String(zoom));
		} catch {
			// not remembered
		}
		refitAll();
	}

	/**
	 * The element outlined in the colour of what happened to it: in its container (an entry of an accordion) the page
	 * of the adapter marks it with the attribute of its node (data-__neos-node-contextpath); rendered alone, a removed
	 * or new element is the whole preview (a changed one shows its changed words, an outline would add nothing)
	 */
	function markFocus(compare, document) {
		const removed = compare.classList.contains('dc-compare--removed');
		const added = !removed && compare.classList.contains('dc-compare--new');
		const inContainer = document?.querySelector('[data-__neos-node-contextpath]');
		const focus = inContainer ?? (removed || added ? rootOf(document) : null);
		if (!focus || !document?.head) {
			return;
		}
		const colour = removed ? '#e5484d' : added ? '#30a46c' : '#00adee';
		focus.setAttribute('data-dc-compare-focus', '');
		const style = document.createElement('style');
		// alone: inside the edge of the frame, which cuts off what lies outside
		style.textContent =
			`[data-dc-compare-focus]{outline:3px solid ${colour}!important;outline-offset:${inContainer ? '6px' : '-3px'};` +
			`background-color:color-mix(in srgb, ${colour} 8%, transparent)}`;
		document.head.append(style);
	}

	/**
	 * A preview is a picture of the website, not the website: nothing in it reacts to the pointer or submits (links,
	 * buttons, forms), as in the previews of the styleguide
	 */
	function makeInert(document) {
		if (!document?.head) {
			return;
		}
		const style = document.createElement('style');
		style.textContent = '*{cursor:default!important}a,button,input,select,textarea,label,summary,[role="button"]{pointer-events:none!important}';
		document.head.append(style);
		const stop = (event) => {
			event.preventDefault();
			event.stopPropagation();
		};
		document.addEventListener('click', stop, true);
		document.addEventListener('submit', stop, true);
		document.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
			element.setAttribute('tabindex', '-1');
		});
	}

	/** the frames of a view are ready: on the sheet of their page, the placeholders fade out over them */
	function reveal(pane, frames) {
		const color = frames[0]?.contentDocument ? preview.pageBackground(frames[0].contentDocument) : null;
		pane.querySelectorAll('.dc-compare__viewport, .dc-compare__clip').forEach((element) => {
			element.style.background = color ?? preview.sheet;
		});
		preview.hidePlaceholders(pane);
	}

	/** the page of the node previews of an adapter: its manifest (nodePreview), asked once per adapter */
	const manifests = new Map();
	function previewTemplate(adapter) {
		if (!adapter) {
			return Promise.resolve(null);
		}
		if (!manifests.has(adapter)) {
			manifests.set(
				adapter,
				fetch(`${adapter.replace(/\/$/, '')}/manifest`, { credentials: 'same-origin' })
					.then((response) => (response.ok ? response.json() : null))
					.then((data) => (typeof data?.nodePreview === 'string' ? data.nodePreview : null))
					.catch(() => null)
			);
		}
		return manifests.get(adapter);
	}

	/** the frames of a view; when loaded: their height, the sides the website cannot show, the changed words */
	async function load(compare, pane) {
		const frames = [...pane.querySelectorAll('iframe[data-ref]')];
		const pending = frames.filter((frame) => !frame.dataset.loading);
		if (pending.length === 0) {
			return;
		}
		pending.forEach((frame) => (frame.dataset.loading = 'true'));
		const template = await previewTemplate(compare.dataset.adapter);
		if (!template) {
			// the adapter cannot show nodes: the module shows what it has besides (the fields)
			compare.hidden = true;
			return;
		}
		// the width and, if seen before, the height from the start: the page does not change its layout after loading
		const known = heights.get(heightKey(frames, place(frames)));
		if (known) {
			setHeight(frames, known);
		}
		let loaded = 0;
		for (const frame of pending) {
			frame.addEventListener('load', async () => {
				makeInert(frame.contentDocument);
				markFocus(compare, frame.contentDocument);
				if (++loaded < pending.length) {
					return;
				}
				if (pane.dataset.pane === 'side') {
					leaveOutUnavailable(compare, frames);
				}
				const before = pane.querySelector('iframe[data-side="before"]');
				const after = pane.querySelector('iframe[data-side="after"]');
				if (before && after && !isUnavailable(before) && !isUnavailable(after)) {
					markFrames(before.contentDocument, after.contentDocument);
				}
				const shown = frames.filter((candidate) => !candidate.closest('[hidden]'));
				const documents = shown.map((candidate) => candidate.contentDocument).filter(Boolean);
				await Promise.all(documents.map(preview.settled));
				// htmx replaced the compare meanwhile
				if (shown.length === 0 || !pane.isConnected) {
					return;
				}
				fit(shown);
				reveal(pane, shown);
				const observer = new ResizeObserver(() => fit(shown));
				documents.forEach((document) => observer.observe(rootOf(document)));
			});
			frame.src = template
				.replace('{ref}', encodeURIComponent(frame.dataset.ref))
				.replace('{site}', encodeURIComponent(compare.dataset.site ?? ''));
		}
	}

	/**
	 * A side the website cannot show is left out (a deleted node has no after, a node of the page layout neither):
	 * without a before the compare is like new content, without both it is not shown at all
	 */
	function leaveOutUnavailable(compare, frames) {
		const unavailable = frames.filter(isUnavailable);
		if (unavailable.length === frames.length) {
			compare.hidden = true;
			return;
		}
		for (const frame of unavailable) {
			frame.closest('[data-figure]').hidden = true;
		}
		if (unavailable.some((frame) => frame.dataset.side === 'before')) {
			compare.classList.add('dc-compare--new');
			compare.querySelector('.dc-compare__views')?.remove();
			compare.querySelectorAll('figcaption').forEach((caption) => (caption.hidden = true));
		}
	}

	/** a view: side by side or slider (its frames load when it is shown) */
	function show(compare, view) {
		compare.querySelectorAll('[data-view]').forEach((button) => {
			button.classList.toggle('dc-compare__view--active', button.dataset.view === view);
		});
		compare.querySelectorAll('[data-pane]').forEach((pane) => {
			pane.hidden = pane.dataset.pane !== view;
			if (!pane.hidden) {
				load(compare, pane);
			}
		});
	}

	/**
	 * The line between before (left of it) and after: dragged with mouse, finger or pen, moved with the arrow keys.
	 * While dragging a shield lies over the frames, which would take the pointer events.
	 */
	function dragLine(handle) {
		const stack = handle.closest('.dc-compare__stack');
		const clip = stack.querySelector('.dc-compare__clip');
		const shield = stack.querySelector('.dc-compare__shield');
		const set = (percent) => {
			const value = Math.min(100, Math.max(0, percent));
			clip.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
			handle.style.left = `${value}%`;
			handle.setAttribute('aria-valuenow', String(Math.round(value)));
		};
		const follow = (event) => {
			const box = stack.getBoundingClientRect();
			set(((event.clientX - box.left) / box.width) * 100);
		};
		const stop = () => {
			shield.hidden = true;
			window.removeEventListener('pointermove', follow);
			window.removeEventListener('pointerup', stop);
			window.removeEventListener('pointercancel', stop);
		};
		handle.addEventListener('pointerdown', (event) => {
			event.preventDefault();
			shield.hidden = false;
			follow(event);
			window.addEventListener('pointermove', follow);
			window.addEventListener('pointerup', stop);
			window.addEventListener('pointercancel', stop);
		});
		handle.addEventListener('keydown', (event) => {
			const step = event.shiftKey ? 10 : 2;
			const now = Number(handle.getAttribute('aria-valuenow'));
			if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				event.preventDefault();
				set(now + (event.key === 'ArrowRight' ? step : -step));
			}
		});
	}

	/** loads a compare when it comes into view (a hidden one, e.g. of an entry not selected, waits) */
	const visible = new IntersectionObserver((records) => {
		for (const record of records) {
			if (record.isIntersecting) {
				visible.unobserve(record.target);
				const active = record.target.querySelector('.dc-compare__view--active');
				show(record.target, active ? active.dataset.view : 'side');
			}
		}
	});

	/** the width of the viewports: a narrower window, a pane that opened */
	const widths = new ResizeObserver(() => refitAll());

	function init(compare) {
		if (compare.dataset.compareReady) {
			return;
		}
		compare.dataset.compareReady = 'true';
		compare.querySelectorAll('[data-zoom]').forEach((button) => {
			button.addEventListener('click', () => setZoom(Number(button.dataset.zoom)));
		});
		compare.querySelectorAll('[data-zoom-value]').forEach((value) => (value.textContent = `${Math.round(zoom * 100)} %`));
		compare.querySelectorAll('.dc-compare__viewport').forEach((viewport) => {
			viewport.append(preview.placeholderElement());
			widths.observe(viewport);
		});
		compare.querySelectorAll('[data-view]').forEach((button) => {
			button.addEventListener('click', () => show(compare, button.dataset.view));
		});
		const handle = compare.querySelector('.dc-compare__handle');
		if (handle) {
			dragLine(handle);
		}
		visible.observe(compare);
	}

	function initAll(scope) {
		if (scope.matches?.('[data-compare]')) {
			init(scope);
		}
		scope.querySelectorAll?.('[data-compare]').forEach(init);
	}

	window.DevclaimCompare = { markField, diff };

	function start() {
		initAll(document);
		new MutationObserver((records) => {
			for (const record of records) {
				record.addedNodes.forEach((node) => node.nodeType === Node.ELEMENT_NODE && initAll(node));
			}
		}).observe(document.body, { childList: true, subtree: true });
	}

	// Neos loads the scripts of a module in the <head>
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
