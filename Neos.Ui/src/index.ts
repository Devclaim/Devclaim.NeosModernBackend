/**
 * Devclaim.NeosModernBackend: the outline of the hovered and the selected node in the Neos UI as an overlay of its own,
 * with the node toolbar of the Neos UI docked to it, and CKEditor in the same style (see README.md).
 */
import manifest from '@neos-project/neos-ui-extensibility';

import {attach} from './attach';
import {type Editors, registerDateTimeEditor, replaceDateInputOfPlugins} from './dateTime';
import {leaveFrameDocument, watchFrameContent} from './frameContent';
import {watchGuestFrame} from './guestFrame';
import type {Neos} from './neos';
import {readOptions} from './options';
import {holdSplashScreen, whenLoaded} from './splash';
import {registerSidebar} from './sidebar';
import nodeTypesStyles from './styles/node-types.css';
import type {Containers} from './sidebar/LeftSideBar';

const PACKAGE = 'Devclaim.NeosModernBackend';

// when this script is loaded: before the plugins loaded after it read the components of the Neos UI
replaceDateInputOfPlugins();

manifest(PACKAGE, {}, (globalRegistry, {store, frontendConfiguration}) => {
	// before the Neos UI renders its app (and removes its splash screen): kept until the first page in the frame loaded
	const releaseSplash = holdSplashScreen();
	const options = readOptions(frontendConfiguration[PACKAGE]);
	const neos: Neos = {
		store,
		nodeTypes: globalRegistry.get('@neos-project/neos-ui-contentrepository') as Neos['nodeTypes'],
		i18n: globalRegistry.get('i18n') as Neos['i18n']
	};
	// the backend page has no language: needed to hyphenate long words (e.g. in the node type dialog)
	const interfaceLanguage = (store.getState() as {user?: {preferences?: {interfaceLanguage?: string}}}).user?.preferences
		?.interfaceLanguage;
	if (!document.documentElement.lang && interfaceLanguage) {
		document.documentElement.lang = interfaceLanguage;
	}
	const style = document.createElement('style');
	style.textContent = nodeTypesStyles;
	document.head.appendChild(style);
	if (options.sidebar) {
		registerSidebar(globalRegistry.get('containers') as Containers, neos);
	}
	if (options.dateTimeEditor) {
		const inspector = globalRegistry.get('inspector') as {get(key: string): unknown};
		registerDateTimeEditor(inspector.get('editors') as Editors, neos);
	}
	watchGuestFrame(
		(frameWindow) => {
			attach(frameWindow, options, neos);
			whenLoaded(frameWindow, releaseSplash);
		},
		(previous) => leaveFrameDocument(neos, previous)
	);
	watchFrameContent(neos);
});
