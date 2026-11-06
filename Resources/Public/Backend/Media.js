/*
 * The media module (Media.css). An image that was dragged does not open when it is let go, the rows it can be dropped
 * on know their word for it. The upload: the drop area over the whole window while a file is dragged over it, the
 * link "Upload" opens the file dialog of the uploader of Neos.Media.Browser (the page to upload stays where it has
 * none). The button in the heading of a list says how to leave its edit mode; Neos.Media.Browser switches the mode.
 */
(() => {
	const translate = (id, fallback) =>
		window.NeosCMS?.I18n?.translate(id, fallback, 'Devclaim.NeosModernBackend', 'Main') ?? fallback;

	document.addEventListener(
		'click',
		(event) => {
			const toggle = event.target.closest?.('.neos-media-aside-list-edit-toggle');
			if (toggle) {
				toggle.dataset.done = translate('media.done', 'Done');
			}
		},
		true
	);

	document.addEventListener('click', (event) => {
		const input = event.target.closest?.('.neos-file-options > a') && document.querySelector('#uploader input[type="file"]');
		if (input) {
			event.preventDefault();
			input.click();
		}
	});

	// let go where it started, the browser clicks the link of the image; Neos prevents that only where a click event
	// names its element (event.toElement), not in Firefox
	let start = null;
	let moved = false;
	window.addEventListener(
		'pointerdown',
		(event) => {
			moved = false;
			const asset = event.target.closest?.('.draggable-asset');
			if (asset) {
				start = { x: event.clientX, y: event.clientY };
				const box = asset.getBoundingClientRect();
				document.documentElement.style.setProperty('--dc-media-grab-x', `${event.clientX - box.left}px`);
				document.documentElement.style.setProperty('--dc-media-grab-y', `${event.clientY - box.top}px`);
				const add = translate('media.add', 'Add');
				document.querySelectorAll('.droppable-tag, .droppable-assetcollection').forEach((row) => (row.dataset.add = add));
			}
		},
		true
	);
	window.addEventListener(
		'pointermove',
		(event) => {
			moved ||= start !== null && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4;
		},
		true
	);
	for (const type of ['pointerup', 'pointercancel']) {
		window.addEventListener(type, () => (start = null), true);
	}
	window.addEventListener(
		'click',
		(event) => {
			if (moved) {
				moved = false;
				event.preventDefault();
				event.stopPropagation();
			}
		},
		true
	);

	/** what the drop area says: when a file arrives, the translations have loaded */
	function label(dropzone) {
		let drop = dropzone.querySelector('.dc-media-drop');
		if (!drop) {
			drop = document.createElement('div');
			drop.className = 'dc-media-drop';
			drop.append(document.createElement('i'), document.createElement('strong'), document.createElement('span'));
			drop.firstChild.className = 'fas fa-upload';
			dropzone.append(drop);
		}
		drop.children[1].textContent = translate('media.drop', 'Drop files here');
		drop.children[2].textContent = translate('media.drop.hint', 'They will be added to the media');
	}

	// dragenter and dragleave come for every element the pointer crosses, the area appears under it: they are counted
	let depth = 0;
	const dropping = (on) => document.body.classList.toggle('dc-media-dropping', on);
	const hasFiles = (event) => event.dataTransfer?.types.includes('Files');

	window.addEventListener('dragenter', (event) => {
		const dropzone = document.getElementById('dropzone');
		if (dropzone && hasFiles(event)) {
			if (depth++ === 0) {
				label(dropzone);
				dropping(true);
			}
		}
	});
	window.addEventListener('dragleave', (event) => {
		if (hasFiles(event) && depth > 0 && --depth === 0) {
			dropping(false);
		}
	});
	for (const type of ['drop', 'dragend']) {
		window.addEventListener(type, () => {
			depth = 0;
			dropping(false);
		});
	}
})();
