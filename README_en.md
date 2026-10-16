[简体中文](README.md) · English

<h1 align="center">Magical Cards</h1>
<p align="center">Browse your books and films as cover cards, and bring them into your notes.</p>
<p align="center">
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/AbigBlackCat/Obsidian-Magical_Cards?style=flat-square"></a>
  <a href="LICENSE"><img alt="Code license: MIT" src="https://img.shields.io/badge/code-MIT-blue?style=flat-square"></a>
</p>
<p align="center">
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/latest">Download</a> ·
  <a href="#usage">Usage</a> ·
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases">Changelog</a> ·
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/issues">Report a bug</a>
</p>

**The author’s preferred card style; the plugin offers several layouts:**

<img width="1509" height="947" alt="The author’s preferred card layout" src="https://github.com/user-attachments/assets/b4a68687-3389-4eb4-8da3-5a91ffc45ca9" />

[Available in the Obsidian community](https://community.obsidian.md/plugins/magical-cards), with ongoing updates.

<img width="688" height="761" alt="Magical Cards community listing" src="https://github.com/user-attachments/assets/e37d8e9a-3b02-46fe-8985-22c086d64986" />

Magical Cards is an Obsidian plugin for browsing and editing book, film and image showcase cards on desktop and mobile. Open a dedicated cards view or embed collections in your notes. Both use the same work notes, with search, sorting, linked notes, and editable summaries on the back of each card.

**The interface is currently in Chinese.** This guide includes the original labels so you can find the controls. Install from the community browser or use the manual steps below.

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features and layouts](#features-and-layouts)
- [Settings](#settings)
- [Note embeds](#note-embeds)
- [FAQ and data](#faq-and-data)
- [Development and license](#development-and-license)

## Installation

Requires **Obsidian 1.11.4 or later**. In Settings → Community plugins → Browse, search for **Magical Cards**, install and enable it.

For manual installation:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/latest).
2. Put all three files in `<vault>/.obsidian/plugins/magical-cards/`.
3. Reload Obsidian and enable **Magical Cards** in Settings → Community plugins.

Supports Obsidian for iOS/iPadOS and Android. HarmonyOS devices that can run Android Obsidian use the same plugin files. Native HarmonyOS hosts and compatibility containers depend on their ability to run Obsidian plugins and are unverified; the [official mobile downloads](https://obsidian.md/download) currently list iOS and Android. Mobile browser emulation is not physical-device acceptance. iOS, Android, HarmonyOS and Windows have not been tested on physical hardware.

On mobile, run **打开 Magical Cards** from the command palette. Use the module menu to select multiple images or SVGs (choose SVGs through the system file picker). Swipe to browse, tap the transparent top-right area to flip, and tap elsewhere to open the note. In the vertical gallery, swipe vertically through cards; scroll the page from outside the gallery. Swipe the Dashboard tab strip to see more categories; use **Dashboard 向前移动 / 向后移动** in its menu to reorder. Module title handles still support dragging. Finish syncing notes and attachments with your chosen vault sync tool before opening cards; the plugin itself performs no sync.

## Usage

On first use in an empty directory, the plugin creates a guide, three books, and three films in `卡片库` and opens the guide. The six editable covers are bundled with the plugin and work offline.

The initial appearance is **cylindrical layout, full cover, fill and crop, paper material, 2:3, and at most three visible cards**. You can still browse every work by swiping or using the arrow keys.

1. **Open cards:** use the ribbon cards icon or the **打开卡片视图** (Open cards view) command.
2. **Add a work:** click `+` in a module and enter its title, cover, and details.
3. **Write a summary:** flip a card to edit its back, or open the linked work note.

The **查看示例及用法说明** (Open examples and guide) command reopens the guide and can retry an interrupted initialization. Existing collections and appearances are preserved. Deleted examples do not return on restart.

## Features and layouts

| Feature | How to use it |
| --- | --- |
| Browse and search | Swipe, scroll, or use arrow keys. Click the magnifying glass to search. |
| Manage works | Add or edit covers and details, link notes, delete works, and change their order. |
| Back-of-card summaries | Flip the card and write. Switching layouts preserves the current card and summary draft. |
| Dashboards | Organize modules into equal categories, assign them in Settings, and drag tabs to reorder categories. Each category has an independent module order. |
| Reorder modules | Drag the title handle, or focus it and press Alt / Option + ↑ / ↓. |
| Embed collections | Use reading mode or Live Preview; the same collection can appear in multiple notes. |

### Dashboards

Every Dashboard is an ordinary category and can contain any number of modules. There is no fixed All tab. A module may belong to several Dashboards when explicitly assigned, while its notes and images remain shared. Unassigned modules stay in Settings and remain available for note embeds.

Use the horizontal category menu in the cards tab to create, rename or delete a Dashboard. Deleting a category preserves its modules and data. Drag the tabs, or focus a tab and press Alt / Option + Left or Right, to reorder categories. Each Dashboard keeps its own module order, and each window remembers the selected category by ID.

Manage module membership in **Settings**:

- **Add to Dashboard:** expand a module, choose existing categories, or create a category and save it together with the module. Category selection is optional when creating a module.
- **Remove from Dashboard:** the exit-arrow icon beside a membership removes only that category reference; other categories and note embeds keep displaying the module.
- **Delete module:** the trash icon beside an expanded module title removes its configuration, category references and positions after confirmation. Work notes, showcase notes, images and work IDs remain intact. Existing embeds report a deleted module; there is no module restoration control.
- **Delete current card or image:** use the module's horizontal action menu. The confirmation identifies the individual card being deleted.

First-time users get a normal, renameable and deletable 示例 (Example) Dashboard containing Reading and Films. Existing libraries do not receive an automatic category. During upgrade, historically hidden modules become unassigned, both old hiding states are cleared, and affected note embeds and compatible host views display those modules again. Upgrade an enabled compatible host to **0.1.38**; an older shared runtime displays existing categories read-only and prompts an upgrade without replacing the library or drafts.

### Five layouts

| Coverflow carousel | Album rail |
| --- | --- |
| ![Coverflow carousel in a native Obsidian note](previews/coverflow-carousel.png) | ![Album rail in a native Obsidian note, showing sleeves only](previews/album-rail.png) |
| Horizontal curved gallery | Skewed carousel |
| ![Horizontal scroll-bend gallery in a native Obsidian note](previews/scroll-bend.png) | ![Skewed carousel in a native Obsidian note](previews/skewed-carousel.png) |

The cylindrical layout is shown at the top of this page. The curved gallery also supports vertical scrolling:

![Vertical scroll-bend gallery in a native Obsidian note](previews/scroll-bend-vertical.png)

Layouts do not autoplay. Album rail displays sleeves without playback controls or a spinning record. The curved gallery provides an **打开笔记** (Open note) control for the current card and a summary editor. It falls back to ordinary cards if WebGL or texture loading fails. The system's reduced-motion preference disables bending and transitions.

![Dashboard categories reference shared modules and save their own order](previews/dashboards.png)

## Appearance and settings

Settings are ordered as **Card directory → Examples → Add cards module → Add image showcase → Existing modules → Note code generator**. Both creation groups, examples, existing modules and advanced settings start collapsed.

Expand **添加卡片模块** (Add cards module) or **添加图片橱窗** (Add image showcase), enter a **module name**, choose its **aspect ratio**, optionally select one or more Dashboards or create a new category, then click **保存并收起** (Save and collapse). Each creator keeps its own draft and a fixed storage type; advanced card style offers full cover or minimal without converting the module type. Click the purple stacked-card ribbon icon to experience the module in the **Magical Cards** tab. Settings previews support browsing and sliding only; they cannot flip or start editing sessions.

![Basic module settings with name, aspect ratio, save controls and collapsed advanced settings](previews/settings.png)

**高级设置** (Advanced settings) contains **card style → image fit → material → layout → three-card limit**. Direction appears only for the curved gallery. New modules default to **full cover, fill and crop, paper, 2:3, skewed carousel, three-card limit off**. Reading/film examples and existing modules keep their appearance. The three-card option is per module and does not remove any images.

![Showcase advanced settings with layout, three-card limit, flipping, name position and a read-only preview](previews/settings-advanced.png)

The trash icon beside an expanded module heading **deletes the module**, preserving work notes, showcase notes and images. The exit-arrow beside a Dashboard membership **removes only that category reference**. Both operations are available only in Settings and have explicit icon labels. Save failures keep the membership or module and retain unsaved appearance drafts.

Cards and showcase toolbars use a horizontal action menu for search, add, sort, edit and individual-card deletion. Success messages disappear after four seconds; errors and retry prompts remain visible. Click the transparent region at the upper-right of the current card to flip it, or focus the carousel and press F. No flip icon covers the image. Other card areas still open the note; Save, Cancel and Retry remain accessible.

Enter a directory relative to the current vault, such as `卡片库`. Work notes live under `书籍` (books) and `观影` (films); showcases live under `橱窗/<module ID>/`. Configuration is in `_数据/卡片配置.md`. Changing this setting does not move existing data. Absolute computer paths are rejected.

### Ordinary-card image imports and note properties

Reading, film and custom ordinary-module menus include **批量导入图片／SVG** (Import multiple images/SVGs). Each selected file creates a separate card and work note, using the filename without its extension as the title and an empty summary. PNG, JPEG, WebP, GIF and safe SVGs are supported, up to 10 MB per image and 2 MB per SVG.

Partial retries resend only unfinished files and retain stable IDs. They never duplicate successful cards or overwrite later title, summary or cover edits. Complete or explicitly discard unfinished imports before switching categories or deleting modules; discard keeps files already written. File retry queues last only while the shared library remains open. After a full application exit, selecting files again starts a new import.

Work notes initially show only **Name and Summary**. Expand **更多信息** (More information) for the other properties. Watching date/status controls are removed while stored values remain intact. Each film-type card can rename its “Director” field, for example to “Developer”; an empty label restores the default.

The new **32:15 wide image** ratio suits banners near 2.13:1. **2:3 portrait cover** is the general portrait preset. Contain preserves the full image; fill/crop fills the card and may trim its edges.

### Image showcases

Expand the separate **添加图片橱窗** (Add image showcase) settings group, enter a name, choose the aspect ratio, and save. This creator always creates a showcase; existing work modules cannot be converted. Failed saves keep the draft and any already-created showcase note, so retry does not create another note.

| Image front | Description on the back |
| --- | --- |
| ![An image-only showcase front with an optional empty name](previews/showcase-front.png) | ![The showcase back provides a plain-text description editor and a shared-note control](previews/showcase-back.png) |

- Select multiple images or drag images into the showcase. Folders are never scanned automatically. PNG, JPEG, WebP, GIF and SVG are supported, up to 10 MB per image and 2 MB per SVG.
- Each showcase has its own folder containing one `橱窗.md` note and all imported images. The note uses local embeds to show every image, optional name and description. Names may be empty.
- Advanced options enable flipping and place names on the front, back, or nowhere. Flipping is on and names are on the back by default. Front-name mode shows only the description on the back; hiding names preserves the stored text.
- Descriptions are plain text, limited to 400 characters, and saved automatically. IME composition waits for confirmation; failed saves and conflicts retain the draft with retry controls. With flipping off, use **编辑当前图片** (Edit current image) or edit the shared note.
- Removing a card removes only its note block and keeps the image file. Ordering and field edits preserve other blocks, unknown properties and surrounding text. Keep card IDs and management markers intact. Missing notes or damaged markers require repair; an empty replacement note is never generated.
- Partial imports preserve saved files and stable IDs. Retry while the same library remains open does not duplicate successful cards. Retry before closing the vault or disabling the last shared cards plugin; after a full restart, selecting images again is a new import and may duplicate cards. Saved image files remain intact.

## Note embeds

![Reading and film modules embedded in a native Obsidian note](previews/note-embed.png)

Expand **笔记代码块生成** (Generate a note code block) in Settings. Select one or more existing modules, generate and copy the code, then paste it into a note. Alternatively, run **插入卡片模块** (Insert cards modules) in a note; selecting modules inserts the code block directly into that note.

Each generation creates new block and module-instance IDs. The block references existing works and inherits collection appearance; it does not duplicate work data.

````markdown
```magical-cards
id: reading-and-films
modules:
  - id: reading-instance
    collection: book
  - id: films-instance
    collection: film
```
````

Dragging modules inside an embed changes only that block. The plugin atomically updates its `modules` array and preserves the rest of the note. Duplicate IDs, source conflicts, or unsaved native editor changes block an overwrite and preserve the draft. Generate fresh IDs when duplicating a block within the same note.

<details>
<summary>Advanced: override a layout for one embed</summary>

`collection` refers to `book`, `film`, or an existing custom collection's stable ID. Add `layout` to a module to select `cylinder`, `coverflow-carousel`, `album-rail`, `scroll-bend`, or `skewed-carousel`. A curved gallery can also use `orientation: vertical`. Overrides apply only to that embed; omitted values inherit collection settings.

</details>

## FAQ and data

**Does the three-card option hide or delete other works?**

No. It shows the current card and at most two neighbors at once. Every work remains available to browse; collection size is unchanged.

**Why is there space around a cover?**

Show whole image preserves all image content and may leave space when the ratios differ. Fill and crop fills the card and crops part of the image. A border already present in the original image remains part of that image.

**Where is my data saved?**

Works are ordinary Markdown notes inside the card directory. Appearance and module order are stored in `_数据/卡片配置.md`. Local plugin configuration stores the directory, first-run progress, and recovery information. Switching directories neither imports examples again nor moves existing works.

**What if the tab turns black after changing an appearance?**

Wait for the save to finish, quit and restart Obsidian, then reopen the same vault. The appearance is saved and works and images are preserved. Saving appearance changes to an existing module also shows this recovery hint.

**Does the plugin use the network or clipboard?**

No account or data sync is required. Built-in examples work offline. User-supplied remote cover URLs load from their image servers. The Copy control writes generated code only after you click it. When editing a title, pasting reads only the plain text from that paste event; there is no background clipboard reading. The linked-note picker searches note paths within your vault and does not send note content elsewhere.

<details>
<summary>Upgrading from Barry Cards and recovering drafts</summary>

Existing `barry-cards` blocks, work IDs, `bw_*` properties, views, and recovery drafts remain compatible. Previous directory settings and unknown configuration fields are preserved.

Back up `.obsidian/plugins/barry-cards/` and your card directory, then disable the old plugin and let pending edits finish saving. Install the three new files in `magical-cards`, preserve the old `data.json` and recovery JSON files in the new directory, then enable the new plugin according to the previous enabled state. Do not enable both standalone plugins together.

Compatible hosts share the existing runtime. New versions add missing block languages and cover-reading support without recreating collections or clearing editing and sorting drafts. If a draft cannot be saved during final shutdown, it is written to a recovery JSON file in the plugin directory and its location is shown.

</details>

**0.3.0 changes:** image showcases add batch import, optional names and editable back descriptions. Basic module settings are now name and aspect ratio, with advanced options collapsed and a three-card limit per module. Reading, film and custom modules can be hidden and restored without losing data or order. Settings previews only browse; use the purple cards ribbon icon to open the Magical Cards tab for editing.

**0.3.1 changes:** curved galleries retire unused WebGL contexts and reuse their canvas for ratio and direction changes; the first-run guide uses the author's revised text; the new showcase option is named “添加图片橱窗” (Add image showcase); appearance saves include a recovery hint for a black tab.

**0.4.0 changes:** cards modules and image showcases have separate collapsed creators with independent drafts. The cards view adds All and named Dashboards with manual existing-module selection, editing, deletion and independent module ordering. Categories share existing data, new modules are not assigned automatically, and module hiding remains global.

**0.4.2 changes:** hiding remains reversible, and **移出此 Dashboard** (Remove from this Dashboard) changes only the current category. Confirmed **移除模块** (Delete module) removes module configuration, all category references and module positions while preserving work notes and images. Existing embeds report a deleted module; there is no module restoration control. Unsaved edits and ordering are checked before deletion; failures and conflicts preserve the original module and drafts. Compatible host: **0.1.38**.

## Development and license

The [example vault](examples/vault/) contains only three books, three films, and independent example IDs. Install the three plugin files and open it with Obsidian. Its card directory is `示例`. The [guide template](examples/Magical_Cards示例及用法说明.md) is used for the first-run experience.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

For the browser development preview, run `npm run preview` and open `http://127.0.0.1:4319`. See [VERIFICATION.md](VERIFICATION.md) for recorded checks and platform limits, and [COMMUNITY.md](COMMUNITY.md) for community review status.

Code is licensed under [MIT](LICENSE). Third-party covers and previews containing them are excluded from the code license and remain the property of their rights holders. Preserve the [cover sources and rights notice](examples/SOURCES.md). Layout, React, and build adaptation notices are in [THIRD_PARTY.md](THIRD_PARTY.md).
