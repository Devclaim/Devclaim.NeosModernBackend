import type {Neos} from '../neos';
import sidebarStyles from '../styles/sidebar.css';
import {type Containers, createContentTreeHeader, createLeftSideBar, NoToolbar} from './LeftSideBar';
import {ignoreScrollIntoViewIn} from './reveal';

/** The left sidebar with the actions of the trees in their header rows and the search, instead of rows of their own */
export function registerSidebar(containers: Containers, neos: Neos) {
	containers.set('LeftSideBar', createLeftSideBar(containers, neos));
	containers.set('LeftSideBar/Top/PageTreeToolbar', NoToolbar);
	containers.set('LeftSideBar/Top/PageTreeSearchbar', NoToolbar);
	containers.set('LeftSideBar/ContentTreeToolbar', createContentTreeHeader(neos));
	ignoreScrollIntoViewIn('.devclaim-sidebar');

	const style = document.createElement('style');
	style.textContent = sidebarStyles;
	document.head.appendChild(style);
}
