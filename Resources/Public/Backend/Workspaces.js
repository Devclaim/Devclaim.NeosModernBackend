/*
 * The workspace module in three panes (Resources/Private/Fusion/Backend/Workspaces): after every page and every htmx
 * swap, the selected workspace is marked in the tree and its header filled from the tree's template of it (who and
 * what it is, outdated, its actions); in the review, a change is selected for the right pane and the pages are
 * selected for publishing or discarding (the fields of the form of Neos, its dialogs read them).
 */
(() => {
	/** the header of the selected workspace, from the template of the tree (the tree may arrive later: htmx) */
	function fillHeader(main) {
		const name = main.dataset.selected;
		const template = name ? document.querySelector(`template[data-dc-ws-template="${CSS.escape(name)}"]`) : null;
		document.querySelectorAll('[data-dc-ws-item]').forEach((item) => {
			item.classList.toggle('dc-ws-item--selected', item.dataset.dcWsItem === name);
		});
		if (!template || main.dataset.headerFilled) {
			return;
		}
		main.dataset.headerFilled = 'true';
		const part = (key) => template.content.querySelector(`[data-part="${key}"]`);
		const meta = main.querySelector('[data-dc-ws-meta]');
		if (meta && part('meta')) {
			meta.textContent = part('meta').textContent.trim();
		}
		const actions = main.querySelector('[data-dc-ws-actions]');
		if (actions && part('actions')) {
			actions.replaceChildren(...part('actions').cloneNode(true).childNodes);
			window.htmx?.process(actions);
		}
		const stale = main.querySelector('[data-dc-ws-stale]');
		if (stale && part('stale')) {
			stale.replaceChildren(...part('stale').cloneNode(true).childNodes);
			stale.hidden = false;
			window.htmx?.process(stale);
		}
	}

	/** shows a change in the right pane */
	function selectChange(review, key) {
		review.querySelectorAll('[data-dc-ws-change]').forEach((row) => {
			row.classList.toggle('dc-ws-change--selected', row.dataset.dcWsChange === key);
		});
		let found = false;
		review.querySelectorAll('[data-dc-ws-detail]').forEach((detail) => {
			detail.hidden = detail.dataset.dcWsDetail !== key;
			found ||= !detail.hidden;
		});
		const placeholder = review.querySelector('[data-dc-ws-placeholder]');
		if (placeholder) {
			placeholder.hidden = found;
		}
	}

	/** a dialog of the workspace module is open (a popover; older browsers do not know the selector) */
	const dialogOpen = () => {
		try {
			return document.querySelector(':popover-open') !== null;
		} catch {
			return false;
		}
	};

	/**
	 * Selecting pages, like the list of the moderation app: "select several" turns the selection mode on (the pages get
	 * their checkboxes, a click on a page selects it, the bar at the bottom shows the selection and its actions); the
	 * same button or Escape turns it off. A new or moved page needs the pages above it that are new or moved too
	 * (published together), and the pages below it go with it when it is unselected, as in the review of Neos.
	 */
	function initSelection(review) {
		const pages = [...review.querySelectorAll('[data-dc-ws-check-page]')];
		const toggle = review.querySelector('[data-dc-ws-select-toggle]');
		const bar = review.querySelector('[data-dc-ws-selection]');
		const count = review.querySelector('[data-dc-ws-count]');
		if (!toggle || !bar) {
			return;
		}
		const sectionOf = (checkbox) => checkbox.closest('[data-dc-ws-page]');
		const update = () => {
			const checked = pages.filter((page) => page.checked).length;
			pages.forEach((page) => sectionOf(page).toggleAttribute('data-selected', page.checked));
			count.textContent = checked > 0 ? count.dataset.some.replace('{0}', String(checked)) : count.dataset.none;
			review.querySelectorAll('[data-dc-ws-needs-selection]').forEach((button) => {
				button.disabled = checked === 0 || !button.dataset.allowed;
			});
			review.querySelector('[data-dc-ws-select-all]').hidden = checked === pages.length;
			review.querySelector('[data-dc-ws-select-none]').hidden = checked === 0;
		};
		const setMode = (selecting) => {
			review.classList.toggle('dc-ws-review--selecting', selecting);
			toggle.setAttribute('aria-pressed', String(selecting));
			const label = selecting ? toggle.dataset.labelOn : toggle.dataset.labelOff;
			toggle.setAttribute('aria-label', label);
			toggle.title = label;
			bar.hidden = !selecting;
			if (!selecting) {
				pages.forEach((page) => (page.checked = false));
			}
			update();
		};
		const select = (checkbox, checked) => {
			checkbox.checked = checked;
			const section = sectionOf(checkbox);
			const path = section.dataset.path ?? '';
			if (section.dataset.new || section.dataset.moved) {
				for (const other of pages) {
					const otherSection = sectionOf(other);
					const otherPath = otherSection.dataset.path ?? '';
					const isNewOrMoved = otherSection.dataset.new || otherSection.dataset.moved;
					if (checked && isNewOrMoved && path.startsWith(otherPath + '/')) {
						other.checked = true;
					}
					if (!checked && otherPath.startsWith(path + '/')) {
						other.checked = false;
					}
				}
			}
			update();
		};
		toggle.addEventListener('click', () => setMode(!review.classList.contains('dc-ws-review--selecting')));
		for (const checkbox of pages) {
			checkbox.addEventListener('change', () => select(checkbox, checkbox.checked));
			// in selection mode the whole head of a page selects it (not its links and buttons)
			sectionOf(checkbox).querySelector('[data-dc-ws-page-head]')?.addEventListener('click', (event) => {
				if (!review.classList.contains('dc-ws-review--selecting') || event.target.closest('a, button, label')) {
					return;
				}
				select(checkbox, !checkbox.checked);
			});
		}
		review.querySelector('[data-dc-ws-select-all]').addEventListener('click', () => {
			pages.forEach((page) => (page.checked = true));
			update();
		});
		review.querySelector('[data-dc-ws-select-none]').addEventListener('click', () => {
			pages.forEach((page) => (page.checked = false));
			update();
		});
		document.addEventListener('keydown', (event) => {
			// not while a dialog of Neos is open: it takes Escape itself
			if (event.key === 'Escape' && review.isConnected && !dialogOpen()) {
				setMode(false);
			}
		});
		setMode(false);
	}

	function initReview(review) {
		if (review.dataset.ready) {
			return;
		}
		review.dataset.ready = 'true';
		review.querySelectorAll('[data-dc-ws-change]').forEach((row) => {
			row.addEventListener('click', () => selectChange(review, row.dataset.dcWsChange));
		});
		initSelection(review);
		const first = review.querySelector('[data-dc-ws-change]');
		if (first) {
			selectChange(review, first.dataset.dcWsChange);
		}
	}

	/**
	 * On wide screens the panes scroll each on their own and the page does not: the module as high as the window below
	 * its top, less whatever Neos puts below it (measured). Narrow: as high as its content.
	 */
	function fitHeight(force = false) {
		const root = document.querySelector('[data-dc-ws]');
		// a swap inside the frame keeps its height: measuring again would make the page jump
		if (!root || (root.dataset.fitted && !force)) {
			return;
		}
		root.dataset.fitted = 'true';
		root.style.height = '';
		if (window.matchMedia('(max-width: 800px)').matches) {
			return;
		}
		const top = root.getBoundingClientRect().top + window.scrollY;
		root.style.height = `${Math.max(480, window.innerHeight - top)}px`;
		const overflow = document.documentElement.scrollHeight - window.innerHeight;
		if (overflow > 0) {
			root.style.height = `${Math.max(480, root.offsetHeight - overflow)}px`;
		}
	}

	/** the tab of the page shown (the tabs swap only the page below them) */
	function markTab() {
		const tab = document.getElementById('dc-ws-page')?.dataset.tab;
		document.querySelectorAll('[data-dc-ws-tab]').forEach((link) => {
			link.classList.toggle('dc-ws__tab--active', link.dataset.dcWsTab === tab);
		});
	}

	function sync() {
		const main = document.getElementById('dc-ws-main');
		if (main) {
			fillHeader(main);
		}
		markTab();
		document.querySelectorAll('[data-dc-ws-review]').forEach(initReview);
	}

	function start() {
		sync();
		fitHeight();
		window.addEventListener('resize', () => fitHeight(true));
		// a swap of the whole module (a publish, a rebase) renders a new frame: measured once
		document.body.addEventListener('htmx:afterSettle', () => fitHeight());
		// the tree, a workspace, a tab, a publish: every swap of htmx, right after it (before the page is painted, so the
		// header does not fill in visibly) and once more when it settled
		document.body.addEventListener('htmx:afterSwap', sync);
		document.body.addEventListener('htmx:afterSettle', sync);
	}

	// Neos loads the scripts of a module in the <head>
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
