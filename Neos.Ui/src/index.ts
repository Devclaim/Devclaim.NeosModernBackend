/**
 * Devclaim.NeosModernBackend: the outline of the hovered and the selected node in the Neos UI as an overlay of its own,
 * with the node toolbar of the Neos UI docked to it, and CKEditor in the same style (see README.md).
 */
import manifest from '@neos-project/neos-ui-extensibility';

import {attach} from './attach';
import {watchGuestFrame} from './guestFrame';
import type {Neos} from './neos';
import {readOptions} from './options';

const PACKAGE = 'Devclaim.NeosModernBackend';

manifest(PACKAGE, {}, (globalRegistry, {store, frontendConfiguration}) => {
	const options = readOptions(frontendConfiguration[PACKAGE]);
	const neos: Neos = {
		store,
		nodeTypes: globalRegistry.get('@neos-project/neos-ui-contentrepository') as Neos['nodeTypes'],
		i18n: globalRegistry.get('i18n') as Neos['i18n']
	};
	watchGuestFrame((frameWindow) => attach(frameWindow, options, neos));
});
