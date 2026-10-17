import React, {type RefObject, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import type {Neos} from '../neos';
import {Button} from './Button';
import {type NodeActions, type TreeAction, type TreeType, useNodeActions, useRefreshAction} from './useTreeActions';

const ROW = '[class*="_header__data"]';
const FOCUSED_ROW = '[class*="_header__data--isFocused"]';

function ActionButton({action, onDone}: {action: TreeAction; onDone?: () => void}) {
	return (
		<Button
			id={action.id}
			icon={action.icon}
			title={action.label}
			isActive={action.isActive}
			disabled={action.disabled}
			spin={action.spin}
			onClick={(event) => {
				event.stopPropagation();
				action.run();
				onDone?.();
			}}
		/>
	);
}

/** "Collapse all" of a tree: the button of the Neos UI in the tree (hidden), with its logic */
function collapseAll(treeType: TreeType) {
	const panel = treeType === 'PageTree' ? '.devclaim-sidebar__top' : '.devclaim-sidebar__bottom';
	document.querySelector<HTMLElement>(`${panel} button[class*="_collapseAll"]`)?.click();
}

/** The actions for the tree in its header row: search (passed in), collapse all, refresh */
export function TreeHeaderActions({treeType, neos, children}: {treeType: TreeType; neos: Neos; children?: React.ReactNode}) {
	const refresh = useRefreshAction(treeType, neos);

	return (
		<div className="devclaim-sidebar__actions" onClick={(event) => event.stopPropagation()}>
			{children}
			<Button
				id={`neos-${treeType}-CollapseAll`}
				icon="far minus-square"
				title={neos.i18n.translate('Neos.Neos.Ui:Main:collapseAll', 'Collapse all')}
				onClick={() => collapseAll(treeType)}
			/>
			<ActionButton action={refresh} />
		</div>
	);
}

/**
 * The actions for the selected node in a row of their own below the header: `+` first, delete apart on the right; the
 * same in the context menu of the tree
 */
export function NodeActionBar({treeType, neos}: {treeType: TreeType; neos: Neos}) {
	const nodeActions = useNodeActions(treeType, neos);
	const {add, edit, remove} = nodeActions;
	const bar = useRef<HTMLDivElement>(null);

	return (
		<div ref={bar} className="devclaim-sidebar__nodeActions">
			<ContextMenu nodeActions={nodeActions} bar={bar} />
			<ActionButton action={add} />
			<span className="devclaim-sidebar__gap" />
			{edit.map((action) => (
				<ActionButton key={action.id} action={action} />
			))}
			<span className="devclaim-sidebar__spacer" />
			<ActionButton action={remove} />
		</div>
	);
}

/**
 * Right click on a row of the tree in the panel of the bar: selects it (as a click does) and opens the actions for the
 * node as a row of icons at the pointer
 */
function ContextMenu({nodeActions, bar}: {nodeActions: NodeActions; bar: RefObject<HTMLElement>}) {
	const {add, edit, remove} = nodeActions;
	const [position, setPosition] = useState<{left: number; top: number} | null>(null);
	const menu = useRef<HTMLDivElement>(null);
	// only what concerns the node (reloading the tree is in the header)
	const actions = [add, ...edit, remove].filter((action) => !action.disabled);

	useEffect(() => {
		const element = bar.current?.closest<HTMLElement>('.devclaim-sidebar__top, .devclaim-sidebar__bottom');
		const open = (event: MouseEvent) => {
			const row = (event.target as Element).closest(ROW);
			if (!row || !element?.contains(row)) {
				return;
			}
			event.preventDefault();
			if (!row.matches(FOCUSED_ROW)) {
				(row as HTMLElement).click();
			}
			setPosition({left: event.clientX, top: event.clientY});
		};
		element?.addEventListener('contextmenu', open);
		return () => element?.removeEventListener('contextmenu', open);
	}, []);

	useEffect(() => {
		if (!position) {
			return;
		}
		const close = () => setPosition(null);
		const onPointer = (event: Event) => !menu.current?.contains(event.target as Node) && close();
		const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
		document.addEventListener('pointerdown', onPointer);
		document.addEventListener('keydown', onKey);
		window.addEventListener('resize', close);
		const panel = bar.current?.closest('.devclaim-sidebar__top, .devclaim-sidebar__bottom');
		panel?.addEventListener('scroll', close, true);
		return () => {
			document.removeEventListener('pointerdown', onPointer);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('resize', close);
			panel?.removeEventListener('scroll', close, true);
		};
	}, [position]);

	// kept inside the window
	useLayoutEffect(() => {
		const element = menu.current;
		if (element && position) {
			const rect = element.getBoundingClientRect();
			const left = Math.min(position.left, window.innerWidth - rect.width - 8);
			const top = Math.min(position.top, window.innerHeight - rect.height - 8);
			if (left !== position.left || top !== position.top) {
				setPosition({left, top});
			}
		}
	}, [position]);

	return position && actions.length
		? createPortal(
				<div ref={menu} className="devclaim-context-menu" role="menu" style={position}>
					{actions.map((action) => (
						<ActionButton key={action.id} action={action} onDone={() => setPosition(null)} />
					))}
				</div>,
				document.body
			)
		: null;
}
