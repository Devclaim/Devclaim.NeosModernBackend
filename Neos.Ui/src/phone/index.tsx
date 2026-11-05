import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {actions} from '@neos-project/neos-ui-redux-store';
import {IconButton} from '@neos-project/react-ui-components';

import type {Neos} from '../neos';
import type {Containers} from '../sidebar/LeftSideBar';
import phoneStyles from '../styles/phone.css';

/** the width of styles/phone.css */
const PHONE = '(max-width: 1023px)';

type SideBarsState = {ui?: {leftSideBar?: {isHidden?: boolean}; rightSideBar?: {isHidden?: boolean}}};

const isPhone = () => window.matchMedia(PHONE).matches;

/** outside the drawers in the Neos UI; its dialogs and dropdowns can open from the drawers and belong to them */
const TOOLBARS = "[class*='_primaryToolbar'], [class*='_secondaryToolbar']";

const TREE_NODE = ".devclaim-sidebar [class*='_header__data']";
const TREE_CHEVRON = "[class*='_header__chevron']";

/** on the root element while the popover of the top bar is open (styles/phone.css) */
const MORE_OPEN = 'data-devclaim-neos-modern-backend-more';

/** the button of the popover toggles it itself, a dropdown in it (language, workspace) opens on top of it */
const KEEPS_MORE_OPEN = ".devclaim-phone-more, [class*='_dropDown']";

/** how the sidebars were on the wider layout, while the narrow one uses them as drawers (the Neos UI remembers them) */
const WIDE_LAYOUT_SIDEBARS = 'devclaim-neos-modern-backend-wide-sidebars';

/**
 * The narrow layout starts with the page, its drawers closed; the wide one gets its sidebars back as they were: what
 * happens to the drawers stays out of them, also over a reload and when the width changes in the running page.
 */
function keepSidebarsPerLayout(neos: Neos) {
	const phone = window.matchMedia(PHONE);
	const hide = (left: boolean, right: boolean) => {
		const {ui} = neos.store.getState();
		if (Boolean(ui?.leftSideBar?.isHidden) !== left) {
			neos.store.dispatch(actions.UI.LeftSideBar.toggle());
		}
		if (Boolean(ui?.rightSideBar?.isHidden) !== right) {
			neos.store.dispatch(actions.UI.RightSideBar.toggle());
		}
	};
	const follow = () => {
		const remembered = localStorage.getItem(WIDE_LAYOUT_SIDEBARS);
		document.documentElement.removeAttribute(MORE_OPEN);
		if (phone.matches) {
			if (remembered === null) {
				const {ui} = neos.store.getState();
				localStorage.setItem(
					WIDE_LAYOUT_SIDEBARS,
					JSON.stringify({left: Boolean(ui?.leftSideBar?.isHidden), right: Boolean(ui?.rightSideBar?.isHidden)})
				);
			}
			hide(true, true);
		} else if (remembered !== null) {
			const {left, right} = JSON.parse(remembered) as {left: boolean; right: boolean};
			localStorage.removeItem(WIDE_LAYOUT_SIDEBARS);
			hide(left, right);
		}
	};

	follow();
	phone.addEventListener('change', follow);
	return () => phone.removeEventListener('change', follow);
}

/** A click in the document closes the open drawers and popover; it stays a click: the page selects what it was on */
function closeDrawersOnClick(doc: Document, neos: Neos, isOutside: (target: Element) => boolean = () => true) {
	doc.addEventListener(
		'click',
		(event) => {
			if (!isPhone() || !isOutside(event.target as Element)) {
				return;
			}
			if (!(event.target as Element).closest(KEEPS_MORE_OPEN)) {
				document.documentElement.removeAttribute(MORE_OPEN);
			}
			const {ui} = neos.store.getState();
			if (!ui?.leftSideBar?.isHidden) {
				neos.store.dispatch(actions.UI.LeftSideBar.toggle());
			}
			if (!ui?.rightSideBar?.isHidden) {
				neos.store.dispatch(actions.UI.RightSideBar.toggle());
			}
		},
		true
	);
}

/**
 * A node chosen in the trees of the left drawer: show it. After the click: the trees go with the closed sidebar, the
 * Neos UI still has to handle it. Its chevron only opens the node in the tree.
 */
function closeLeftDrawerOnNodeClick(neos: Neos) {
	document.addEventListener('click', (event) => {
		const target = event.target as Element;
		if (isPhone() && target.closest(TREE_NODE) && !target.closest(TREE_CHEVRON)) {
			setTimeout(() => {
				if (!neos.store.getState().ui?.leftSideBar?.isHidden) {
					neos.store.dispatch(actions.UI.LeftSideBar.toggle());
				}
			});
		}
	});
}

/** The page in the content frame, for every document loaded into it */
export function closeDrawersOnClickInFrame(frameDocument: Document, neos: Neos) {
	closeDrawersOnClick(frameDocument, neos);
}

/**
 * On phones the sidebars of the Neos UI are drawers over the page, from the left and the right, as wide as on desktop
 * (styles/phone.css); a button at the bottom corner of each side opens it, their own toggles or a click beside them
 * close them. What is in them stays the same, opening and closing is the toggle of the sidebars. One at a time:
 * together they would cover the page.
 *
 * The top bar keeps its menu, logo, language, workspace and publishing, on phones as icons; the rest of it is a popover
 * behind `⋯`: its own elements, also those of other plugins, as rows of the same layout (styles/phone.css). The
 * secondary toolbar keeps the mode and the preview.
 * Above that width nothing changes.
 */
export function registerPhoneDrawers(containers: Containers, neos: Neos) {
	const t = (id: string, fallback: string) => neos.i18n.translate(`Neos.Neos.Ui:Main:${id}`, fallback);
	const own = (id: string, fallback: string) =>
		neos.i18n.translate(`Devclaim.NeosModernBackend:Main:phone.${id}`, fallback);
	const RightSideBar = containers.get('RightSideBar');

	function RightSideBarWithDrawerButtons() {
		const dispatch = useDispatch();
		const isLeftHidden = useSelector((state: SideBarsState) => Boolean(state.ui?.leftSideBar?.isHidden));
		const isRightHidden = useSelector((state: SideBarsState) => Boolean(state.ui?.rightSideBar?.isHidden));
		const toggleLeft = () => dispatch(actions.UI.LeftSideBar.toggle());
		const toggleRight = () => dispatch(actions.UI.RightSideBar.toggle());

		useEffect(() => keepSidebarsPerLayout(neos), []);

		return (
			<>
				<RightSideBar />
				{isLeftHidden ? (
					<IconButton
						className="devclaim-phone-drawer-button devclaim-phone-drawer-button--left"
						icon="sitemap"
						hoverStyle="clean"
						title={t('navigate', 'Navigate')}
						onClick={() => {
							toggleLeft();
							if (!isRightHidden) {
								toggleRight();
							}
						}}
					/>
				) : null}
				{isRightHidden ? (
					<IconButton
						className="devclaim-phone-drawer-button devclaim-phone-drawer-button--right"
						icon="sliders-h"
						hoverStyle="clean"
						title={t('toggleInspector', 'Toggle inspector')}
						onClick={() => {
							toggleRight();
							if (!isLeftHidden) {
								toggleLeft();
							}
						}}
					/>
				) : null}
			</>
		);
	}

	function MoreButton() {
		return (
			<IconButton
				className="devclaim-phone-more"
				icon="ellipsis-h"
				hoverStyle="clean"
				title={own('more', 'More')}
				onClick={() => document.documentElement.toggleAttribute(MORE_OPEN)}
			/>
		);
	}

	containers.set('RightSideBar', RightSideBarWithDrawerButtons);
	containers.set('PrimaryToolbar/Middle/PhoneMore', MoreButton);
	closeDrawersOnClick(document, neos, (target) => target.closest(TOOLBARS) !== null);
	closeLeftDrawerOnNodeClick(neos);

	const style = document.createElement('style');
	style.textContent = phoneStyles;
	document.head.appendChild(style);
}
