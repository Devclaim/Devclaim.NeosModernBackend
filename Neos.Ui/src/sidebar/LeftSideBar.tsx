import React, {type ComponentType, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {actions} from '@neos-project/neos-ui-redux-store';
import {Icon, IconButton} from '@neos-project/react-ui-components';

import type {Neos} from '../neos';
import {Button} from './Button';
import {useRevealFocused} from './reveal';
import {createSearchField} from './SearchBar';
import {NodeActionBar, TreeHeaderActions} from './TreeActions';
import {TreeLoading, useTreeLoading} from './TreeLoading';

/** The container registry of the Neos UI ('containers') */
export type Containers = {
	get(key: string): ComponentType<any>;
	set(key: string, component: ComponentType<any>): void;
	getChildren(key: string): Array<ComponentType<any>>;
};

type LeftSideBarState = {
	ui?: {
		fullScreen?: {isFullScreen?: boolean};
		leftSideBar?: {isHidden?: boolean; contentTree?: {isHidden?: boolean}};
	};
};

const useLeftSideBar = () =>
	useSelector((state: LeftSideBarState) => state.ui?.leftSideBar) ?? {};

const className = (base: string, modifiers: Record<string, boolean | undefined>) =>
	[base, ...Object.entries(modifiers).filter(([, active]) => active).map(([modifier]) => `${base}--${modifier}`)].join(' ');

/**
 * The left sidebar of the Neos UI (registered as 'LeftSideBar'): the actions for each tree in its header row, the ones
 * for its selected node in a row below (and in a context menu).
 * The trees and everything else registered for the sidebar stay the ones of the Neos UI.
 */
export function createLeftSideBar(containers: Containers, neos: Neos) {
	const t = (id: string, fallback: string) => neos.i18n.translate(`Neos.Neos.Ui:Main:${id}`, fallback);
	const SearchField = createSearchField(neos);

	return function LeftSideBar() {
		const dispatch = useDispatch();
		const sideBar = useLeftSideBar();
		const isFullScreen = useSelector((state: LeftSideBarState) => Boolean(state.ui?.fullScreen?.isFullScreen));
		const isHidden = Boolean(sideBar.isHidden);
		const isContentTreeHidden = Boolean(sideBar.contentTree?.isHidden);
		const [isSearching, setSearching] = useState(false);
		const top = useRef<HTMLDivElement>(null);
		const bottom = useRef<HTMLDivElement>(null);
		const pageTreeLoading = useTreeLoading('PageTree');
		const contentTreeLoading = useTreeLoading('ContentTree');
		useRevealFocused(top, bottom, {pageTree: pageTreeLoading === 'first', contentTree: contentTreeLoading === 'first'});

		const Top = containers.getChildren('LeftSideBar/Top');
		const Bottom = containers.getChildren('LeftSideBar/Bottom');
		const ContentTreeToolbar = containers.get('LeftSideBar/ContentTreeToolbar');
		const toggle = () => dispatch(actions.UI.LeftSideBar.toggle());

		return (
			<>
				<div className={className('devclaim-sidebar__header', {isHidden})} role="button" onClick={toggle}>
					{isFullScreen ? null : isSearching && !isHidden ? (
						<SearchField onClose={() => setSearching(false)} />
					) : (
						<>
							<IconButton
								id="neos-LeftSideBarToggler"
								icon={isHidden ? 'chevron-circle-right' : 'chevron-circle-left'}
								className="devclaim-sidebar__toggle"
								hoverStyle="clean"
								title={t('navigate', 'Navigate')}
							/>
							{isHidden ? null : (
								<>
									<span className="devclaim-sidebar__title">{t('documentTree', 'Document Tree')}</span>
									<TreeHeaderActions treeType="PageTree" neos={neos}>
										<Button id="neos-PageTree-Search" icon="search" title={t('search', 'Search')} onClick={() => setSearching(true)} />
									</TreeHeaderActions>
								</>
							)}
						</>
					)}
				</div>
				<div className={className('devclaim-sidebar', {isHidden: isHidden || isFullScreen})} aria-hidden={isHidden}>
					<div
						ref={top}
						className={className('devclaim-sidebar__top', {
							isFullHeight: isContentTreeHidden,
							[pageTreeLoading ?? 'isLoaded']: true
						})}
					>
						{isHidden ? null : <NodeActionBar treeType="PageTree" neos={neos} />}
						{isHidden ? null : <TreeLoading state={pageTreeLoading} />}
						{isHidden ? null : Top.map((Item, key) => <Item key={key} isExpanded={!isContentTreeHidden} />)}
					</div>
					<div
						ref={bottom}
						className={className('devclaim-sidebar__bottom', {
							isCollapsed: isContentTreeHidden,
							[contentTreeLoading ?? 'isLoaded']: true
						})}
					>
						<ContentTreeToolbar />
						{isHidden || isContentTreeHidden ? null : <TreeLoading state={contentTreeLoading} />}
						{isHidden || isContentTreeHidden ? null : Bottom.map((Item, key) => <Item key={key} />)}
					</div>
				</div>
			</>
		);
	};
}

/** The header row of the content tree (registered as 'LeftSideBar/ContentTreeToolbar') and the row for its selected node */
export function createContentTreeHeader(neos: Neos) {
	const t = (id: string, fallback: string) => neos.i18n.translate(`Neos.Neos.Ui:Main:${id}`, fallback);

	return function ContentTreeHeader() {
		const dispatch = useDispatch();
		const isOpen = !useLeftSideBar().contentTree?.isHidden;

		return (
			<>
				<div
					className={className('devclaim-sidebar__treeHeader', {isOpen})}
					role="button"
					aria-expanded={isOpen}
					aria-label={t('toggleContentTree', 'Toggle content tree')}
					onClick={() => dispatch(actions.UI.LeftSideBar.toggleContentTree())}
				>
					<span id="neos-ContentTree-ToggleContentTree" className="devclaim-sidebar__chevron">
						<Icon icon="chevron-down" />
					</span>
					<span className="devclaim-sidebar__title">{t('contentTree', 'Content Tree')}</span>
					{isOpen ? <TreeHeaderActions treeType="ContentTree" neos={neos} /> : null}
				</div>
				{isOpen ? <NodeActionBar treeType="ContentTree" neos={neos} /> : null}
			</>
		);
	};
}

/** The toolbar and search rows of the document tree are gone: they are in the header of the sidebar */
export function NoToolbar() {
	return null;
}
