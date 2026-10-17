import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useDispatch, useSelector} from 'react-redux';
import {actions, selectors} from '@neos-project/neos-ui-redux-store';
import {getConfiguration} from '@neos-project/neos-ui-configuration';
import {Icon} from '@neos-project/react-ui-components';

import type {Neos} from '../neos';
import {Button} from './Button';

const SEARCH_DELAY = 300;

type FilterOption = {value: string; label: string; icon?: string};

/** The node types to filter by: the presets of the node tree, otherwise all document node types (as NodeTreeFilter) */
function filterOptions(neos: Neos): FilterOption[] {
	const presets = getConfiguration((configuration) => configuration?.nodeTree?.presets) ?? {};
	const options: FilterOption[] = Object.entries(presets)
		.filter(([name]) => name !== 'default')
		.map(([name, preset]) => ({
			value: preset?.baseNodeType ?? '',
			label: neos.i18n.translate(preset?.ui?.label ?? `[${name}]`, preset?.ui?.label ?? `[${name}]`),
			icon: preset?.ui?.icon
		}));
	if (options.length) {
		return options;
	}
	const documentRole = neos.nodeTypes.getRole('document');
	return (documentRole ? neos.nodeTypes.getSubTypesOf(documentRole) : [])
		.map((name) => ({name, nodeType: neos.nodeTypes.get(name)}))
		.filter(({nodeType}) => nodeType && !nodeType.abstract)
		.map(({name, nodeType}) => ({
			value: name,
			label: neos.i18n.translate(nodeType?.label ?? name, nodeType?.label ?? name),
			icon: nodeType?.ui?.icon
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The search of the document tree, in place of the title in the header of the sidebar while it is open; the node type
 * filter is an icon next to it. Searches like the search bar of the Neos UI (UI.PageTree.commenceSearch).
 */
export function createSearchField(neos: Neos) {
	const t = (id: string, fallback: string) => neos.i18n.translate(`Neos.Neos.Ui:Main:${id}`, fallback);

	return function SearchField({onClose}: {onClose(): void}) {
		const dispatch = useDispatch();
		const siteNode = useSelector(selectors.CR.Nodes.siteNodeSelector);
		const [query, setQuery] = useState('');
		const [filter, setFilter] = useState<string | null>(null);
		const options = useMemo(() => filterOptions(neos), []);
		const activeOption = options.find((option) => option.value === filter);
		const searched = useRef({query: '', filter: null as string | null});

		const search = (nextQuery: string, nextFilter: string | null) => {
			searched.current = {query: nextQuery, filter: nextFilter};
			if (siteNode) {
				dispatch(actions.UI.PageTree.commenceSearch(siteNode.contextPath, {query: nextQuery, filterNodeType: nextFilter}));
			}
		};

		useEffect(() => {
			const trimmed = query.trim();
			if (trimmed === searched.current.query && filter === searched.current.filter) {
				return;
			}
			const timeout = window.setTimeout(() => search(trimmed, filter), SEARCH_DELAY);
			return () => window.clearTimeout(timeout);
		}, [query, filter]);

		// back to the title: the whole tree again
		const close = () => {
			if (searched.current.query || searched.current.filter) {
				search('', null);
			}
			onClose();
		};

		return (
			<div className="devclaim-search" onClick={(event) => event.stopPropagation()}>
				<Icon icon="search" className="devclaim-search__icon" />
				<input
					id="neos-NodeTreeSearchInput"
					type="search"
					autoFocus
					value={query}
					placeholder={t('search', 'Search')}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Escape') {
							query ? setQuery('') : close();
						}
					}}
				/>
				{options.length ? (
					<Filter options={options} active={activeOption} label={t('filter', 'Filter')} allLabel={t('all', 'All')} onChange={setFilter} />
				) : null}
				<Button icon="times" title={t('close', 'Close')} onClick={close} />
			</div>
		);
	};
}

function Filter({
	options,
	active,
	label,
	allLabel,
	onChange
}: {
	options: FilterOption[];
	active?: FilterOption;
	label: string;
	allLabel: string;
	onChange(value: string | null): void;
}) {
	const [position, setPosition] = useState<{top: number; right: number} | null>(null);
	const [term, setTerm] = useState('');
	const button = useRef<HTMLButtonElement>(null);
	const popover = useRef<HTMLDivElement>(null);
	const isOpen = position !== null;
	const close = () => {
		setPosition(null);
		setTerm('');
	};
	const choose = (value: string | null) => {
		onChange(value);
		close();
	};

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const onPointer = (event: Event) => {
			const target = event.target as Node;
			if (!popover.current?.contains(target) && !button.current?.contains(target)) {
				close();
			}
		};
		const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
		document.addEventListener('pointerdown', onPointer);
		document.addEventListener('keydown', onKey);
		window.addEventListener('resize', close);
		return () => {
			document.removeEventListener('pointerdown', onPointer);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('resize', close);
		};
	}, [isOpen]);

	const open = () => {
		const rect = button.current?.getBoundingClientRect();
		if (rect) {
			setPosition({top: rect.bottom + 4, right: window.innerWidth - rect.right});
		}
	};
	const visible = term ? options.filter((option) => option.label.toLowerCase().includes(term.toLowerCase())) : options;

	return (
		<>
			<Button
				ref={button}
				id="neos-NodeTreeFilter"
				icon={active?.icon ?? 'filter'}
				title={active ? `${label}: ${active.label}` : label}
				isActive={Boolean(active) || isOpen}
				aria-expanded={isOpen}
				onClick={() => (isOpen ? close() : open())}
			/>
			{position
				? createPortal(
						<div ref={popover} className="devclaim-search__popover" role="listbox" style={{top: position.top, right: position.right}}>
							{options.length > 8 ? (
								<input
									className="devclaim-search__popoverSearch"
									type="search"
									autoFocus
									value={term}
									placeholder={label}
									onChange={(event) => setTerm(event.target.value)}
								/>
							) : null}
							{active ? (
								<button type="button" className="devclaim-search__option" onClick={() => choose(null)}>
									<Icon icon="times" />
									<span>{allLabel}</span>
								</button>
							) : null}
							{visible.map((option) => (
								<button
									key={option.value}
									type="button"
									role="option"
									aria-selected={option === active}
									className={option === active ? 'devclaim-search__option devclaim-search__option--active' : 'devclaim-search__option'}
									onClick={() => choose(option.value)}
								>
									<Icon icon={option.icon ?? 'file'} />
									<span>{option.label}</span>
								</button>
							))}
						</div>,
						document.body
					)
				: null}
		</>
	);
}
