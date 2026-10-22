# Devclaim.NeosModernBackend

A modern editing experience for the Neos backend (Neos 9): selection, toolbars, inline editing and drag and drop in
the content frame. Works with any frontend (Fusion or headless).

## Features

- **Outline** – the selected and hovered node get an outline of their own: never cut off by `overflow`, the frame or
  positioned content; moves from node to node, the hover fades.
- **Node toolbar** – a tab on the outline (node type, drag handle, `⋯` menu with icon buttons); the `+` sits on the
  edge where the new node goes; disabled actions are hidden; moves to the bottom or floats for big nodes.
- **CKEditor** – its toolbar in the same dark style, on the dashed line of the edited text.
- **Drag and drop** – drag or click the handle: the page zooms out, the node moves live, the others slide aside;
  click or release to drop, `Esc` cancels. Only where Neos allows the node. A node type whose nodes stay where they
  are: `ui.draggable: false` (no drag handle).
- **Loading screen** – the splash screen of the Neos UI stays until the page in the content frame has loaded (not only
  until the UI started), then fades out.
- **Steady placeholders** – the placeholders of inline editable properties are drawn by the package for their whole
  life (rendered empty, CKEditor starting, focused, re-rendered), CKEditor's own is hidden: they never disappear, the
  height of an empty property never changes.
- **Sidebar** – improved modernised sidebar
- **Date and time picker** – replaces the date and time picker of the Neos UI: calendar and time in one floating
  popover, also in other plugins that use it (e.g. `NeosSvelte.Events`).
- **Steady reloads** – reloading or publishing the page keeps the content tree and the selection: Neos resets its
  nodes on publish and loses the selection, the package keeps the nodes of the page in the frame and selects the node
  again. One loading state from the publish until the page is there (also when the browser no longer fires `unload`),
  and editors like the link editor do not load their previews again. Works with any frontend (Fusion or headless).

## Installation

```bash
composer require devclaim/neos-modern-backend
```

## Configuration

```yaml
Neos:
  Neos:
    Ui:
      frontendConfiguration:
        'Devclaim.NeosModernBackend':
          offset: 10         # px between node and outline
          gap: 8             # px kept free to the edge of the frame
          animate: true      # the outline moves from node to node
          duration: 180      # ms
          dragAndDrop: true  # false: the native drag and drop of the Neos UI
          sidebar: true      # false: the left sidebar of the Neos UI as it is
          dateTimeEditor: true # false: the DateTimeEditor of the Neos UI
```

## Development

The plugin is TypeScript in `Neos.Ui/src`, built with esbuild into `Resources/Public/Neos.Ui/Plugin.js` (committed).

```bash
yarn install
yarn build   # or: yarn watch
yarn check
```

It restyles and repositions the toolbars of the Neos UI by their classes and ids (written against Neos UI 9.2), and
needs CSS anchor positioning in the browser (without it, only the outline).
