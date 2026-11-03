# Devclaim.NeosModernBackend

A modern editing experience for the Neos backend (Neos 9): selection, toolbars, inline editing and drag and drop in
the content frame. Works with any frontend (Fusion or headless).

## Features

- **Outline** – the selected and hovered node get an outline of their own: never cut off by `overflow`, the frame or
  positioned content; moves from node to node, the hover fades.
- **Node toolbar** – a tab on the outline (node type, drag handle, `⋯` menu with icon buttons); the `+` sits on the
  edge where the new node goes; disabled actions are hidden, a node the user may not edit (its policy) has no
  controls at all, only the tab with its type; moves to the bottom or floats for big nodes.
- **CKEditor** – its toolbar in the same dark style, on the dashed line of the edited text.
- **Drag and drop** – drag or click the handle: the page zooms out, the node moves live, the others slide aside;
  click or release to drop, `Esc` cancels. Only where Neos allows the node. A node type whose nodes stay where they
  are: `ui.draggable: false` (no drag handle).
- **Loading screen** – the splash screen of the Neos UI stays until the page in the content frame has loaded (not only
  until the UI started), then fades out.
- **Change between the modules** – going from the content module to a backend module, from one module to another or
  back, the page stays as it is when the next one is there soon (an instant change, dark from its first paint, no
  white in between); only when it takes longer, the splash screen fades in after the click and the next page keeps it
  until it has loaded (`Resources/Public/Backend/Transition.js` and `.css`).
- **Steady placeholders** – the placeholders of inline editable properties are drawn by the package for their whole
  life (rendered empty, CKEditor starting, focused, re-rendered), CKEditor's own is hidden: they never disappear, the
  height of an empty property never changes.
- **Sidebar** – improved modernised sidebar
- **Date and time picker** – replaces the date and time picker of the Neos UI: calendar and time in one floating
  popover, also in other plugins that use it (e.g. `NeosSvelte.Events`).
- **Number input** – integer properties get the number input of
  [Devclaim.NeosUiEditors](https://github.com/Devclaim/Devclaim.NeosUiEditors) instead of a text field: minus and plus
  around the value, the arrow keys count, the range of `editorOptions` `min` and `max` below; a value beyond it becomes
  the nearest limit.
- **Steady reloads** – reloading or publishing the page keeps the content tree and the selection: Neos resets its
  nodes on publish and loses the selection, the package keeps the nodes of the page in the frame and selects the node
  again. One loading state from the publish until the page is there (also when the browser no longer fires `unload`),
  and editors like the link editor do not load their previews again. Works with any frontend (Fusion or headless).

- **Compare of changes** – a change shown as the website shows it: the node before and after, rendered by the
  frontend through the node previews of [Devclaim.NeosStyleguide](https://github.com/Devclaim/Devclaim.NeosStyleguide)
  (its adapter, any frontend), side by side or one over the other with a line to drag, the changed words marked. In
  the review of the workspace module for each change (the node in the workspace against its base workspace, node
  references `workspace:before|after:<node address>`); as a Fusion component
  (`Devclaim.NeosModernBackend:Compare`, `Resources/Public/Backend/Compare.js` and `.css`) for other backend modules,
  e.g. the activity log of Devclaim.NeosActivity.

- **Workspace module** – the workspace module of Neos (Neos.Workspace.Ui) in three panes, in the look of the
  backend: the workspaces as a tree by base workspace (their changes in short, outdated ones marked), the selected one
  with its header (who and what it is, edit, permissions, delete, synchronise when outdated), its changes by page
  (pages with their changes below them, each named by its kind of element; a selection mode like the moderation app
  for publishing or discarding pages) and its trash, and the selected change with the compare and its changed
  fields. Its controller, actions and dialogs stay those of Neos; only its Fusion
  (`Resources/Private/Fusion/Backend/Workspaces`) and the styles (`Workspaces.css`, `Workspaces.js`) are this
  package's.

- **Roles in the user module** – every role of an account with what it is for, the roles it contains and what it
  allows (the modules it opens and the labels of its privileges from the policy, or texts of the project in the setting
  `Devclaim.NeosModernBackend.userRoles`); a ticked role ticks and locks the roles it contains, below them what the
  roles allow altogether. The same form field as Neos', so its controller and rules stay as they are
  (`Resources/Private/Partials/UserModule`, `Classes/UserRoles`, `Users.js` and `.css`).

- **Backend frame** – one top bar and one menu for the content module and all backend modules, module overviews as
  cards, and many modern UI and UX optimisations across the backend (menu, inspector, focus, fields). A module made
  for phones as well sets its viewport (`viewport` in its module settings, e.g. the moderation module): the module page
  of Neos has none.

## Installation

It requires [devclaim/neos-ui-editors](https://github.com/Devclaim/Devclaim.NeosUiEditors), which is not on
Packagist: add both repositories to the `composer.json` of the project (Composer ignores the repositories of a
dependency).

```json
"repositories": [
    { "type": "vcs", "url": "https://github.com/Devclaim/Devclaim.NeosModernBackend" },
    { "type": "vcs", "url": "https://github.com/Devclaim/Devclaim.NeosUiEditors" }
]
```

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

The roles in the user module, per role identifier (all optional):

```yaml
Devclaim:
  NeosModernBackend:
    userRoles:
      'Neos.Neos:Editor':
        label: 'Redaktion'
        description: 'Bearbeitet und veröffentlicht die Website.'
        can: ['Inhalte bearbeiten', 'Live veröffentlichen']   # what it allows
        derive: false   # leave out what the policy grants (its modules and the labels of its privileges)
        position: 20    # the order: smaller first, the rest by name
```

The number input for integer properties (back to the text field of the Neos UI):

```yaml
Neos:
  Neos:
    userInterface:
      inspector:
        dataTypes:
          integer:
            editor: 'Neos.Neos/Inspector/Editors/TextFieldEditor'
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
