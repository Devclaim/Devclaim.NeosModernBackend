const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const extensibilityMap = require('@neos-project/neos-ui-extensibility/extensibilityMap.json');

const isWatch = process.argv.includes('--watch');

/** The stylesheets as minified text (injected into the content frame by src/attach.ts); also checks their syntax */
const cssAsText = {
	name: 'css-as-text',
	setup(build) {
		build.onLoad({ filter: /\.css$/ }, async (args) => {
			const source = await fs.promises.readFile(args.path, 'utf8');
			const { code } = await esbuild.transform(source, { loader: 'css', minify: true, target: 'chrome125' });
			return { contents: code, loader: 'text' };
		});
	}
};

/** @type {import("esbuild").BuildOptions} */
const options = {
	logLevel: 'info',
	bundle: true,
	minify: true,
	sourcemap: 'linked',
	legalComments: 'linked',
	target: 'es2022',
	entryPoints: { Plugin: path.join(__dirname, 'src/index.ts') },
	outdir: path.join(__dirname, '../Resources/Public/Neos.Ui'),
	plugins: [cssAsText],
	// the packages of the Neos UI come from the host (window['@Neos:HostPluginAPI'])
	alias: extensibilityMap
};

if (isWatch) {
	esbuild.context(options).then((context) => context.watch());
} else {
	esbuild.build(options);
}
