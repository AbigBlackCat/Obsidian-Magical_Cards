[简体中文](README.md) · English

<h1 align="center">Magical Cards</h1>
<p align="center">Browse your books and films as cover cards, and bring them into your notes.</p>
<p align="center">
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/AbigBlackCat/Obsidian-Magical_Cards?style=flat-square"></a>
  <a href="LICENSE"><img alt="License: free use, restricted redistribution" src="https://img.shields.io/badge/license-free_use-blue?style=flat-square"></a>
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

From **0.9.0**, the complete source is maintained in a private repository. This public repository continues to provide installation, updates, documentation and Issues. Personal and business use is free under the [license and redistribution terms](#license-and-source).

**The interface is currently in Chinese.** This guide includes the original labels so you can find the controls. Install from the community browser or use the manual steps below.

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features and layouts](#features-and-layouts)
- [WeRead bookshelf import](#weread-bookshelf-import)
- [Appearance and settings](#appearance-and-settings)
- [Note embeds](#note-embeds)
- [FAQ and data](#faq-and-data)
- [License and source](#license-and-source)

## Installation

Requires **Obsidian 1.11.4 or later**. In Settings → Community plugins → Browse, search for **Magical Cards**, install and enable it.

For manual installation:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/latest).
2. Put all three files in `<vault>/.obsidian/plugins/magical-cards/`.
3. Reload Obsidian and enable **Magical Cards** in Settings → Community plugins.

Supports Obsidian for iOS/iPadOS and Android. HarmonyOS devices that can run Android Obsidian use the same plugin files. Native HarmonyOS hosts and compatibility containers depend on their ability to run Obsidian plugins and are unverified; the [official mobile downloads](https://obsidian.md/download) currently list iOS and Android. Mobile browser emulation is not physical-device acceptance. iOS, Android, HarmonyOS and Windows have not been tested on physical hardware.

On mobile, choose **打开 Magical Cards** (Open Magical Cards) from the bottom menu, or run **Magical Cards：打开卡片视图** from the command palette. Use **上一张 / 下一张** (Previous / Next) below the cards: tap once to advance one card, or hold for 400ms to begin advancing every 160ms; release to stop. Single-finger swipes remain available to Obsidian sidebars and page scrolling, and pinch zoom stays available. Both gallery directions use the same paging buttons. Tap a neighboring card to center it, the transparent top-right area to flip, or elsewhere on the current card to open its note. The back expands inside its module for editing and pauses paging; returning to the front keeps your position. Three cards fit the module width and visible height without changing saved ratios or appearance. Use the module menu to select multiple images or SVGs (choose SVGs through the system file picker). Swipe the Dashboard tab strip to see more categories; use **Dashboard 向前移动 / 向后移动** in its menu to reorder. Module title handles still support dragging. Finish syncing notes and attachments with your chosen vault sync tool before opening cards; the plugin itself performs no sync.

## Usage

On first use in an empty directory, the plugin creates a guide, three books, and three films in `卡片库` and opens the guide. The six editable covers are bundled with the plugin and work offline.

The initial appearance is **cylindrical layout, full cover, fill and crop, paper material, 2:3, and at most three visible cards**. You can still browse every work using paging buttons on mobile, or dragging and arrow keys on desktop.

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
| WeRead import | Authorize in Settings, load the current shelf, and select books to import into a book module. |
| Module works Dashboard | Use the portal action before search to open the module’s statistics, latest work, filters and cover grid. |
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

First-time users get a normal, renameable and deletable 示例 (Example) Dashboard containing Reading and Films. Existing libraries do not receive an automatic category. During upgrade, historically hidden modules become unassigned, old hiding states are cleared, and affected note embeds display those modules again.

### Module works Dashboard

Click the portal action immediately before search in a module menu to browse its statistics, latest update, search, filters, temporary sorting and cover grid. Opening from the Magical Cards category view uses the same tab; note embeds reuse a Magical Cards tab in the same window, creating one only when needed. The page header contains only **返回** (Return) and the module name. Temporary sorting does not rewrite saved module order; existing cover proportions and note-opening behavior are retained.

Return restores the source page's scroll position and portal focus. If the source was closed, or the works page was restored after restarting Obsidian, Return opens the Magical Cards category view. Custom cards prefer their linked note; showcase cards open the module note.

**启用模组作品 Dashboard** (Enable module works Dashboard) is enabled by default and saved in local plugin configuration. Turning it off immediately hides portal actions and shows a disabled message on open works pages, with Return still available. Existing installations open Magical Cards Settings after an upgrade and show the update dialog once for that version; closing it or choosing **知道了** records it as read. Fresh installations keep the existing starter guide. No work-data migration, film fields or Dashboard category changes are introduced.

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

## WeRead bookshelf import

In Settings → Magical Cards, expand **微信读书** (collapsed by default). Open [获取 API Key](https://weread.qq.com/r/weread-skills), paste your key, and choose **保存授权**. The password field clears after saving. Choose **读取书架**, search by title or author, and select books; none are selected initially. Ebooks and audio albums are supported.

Choose a book module and select **导入所选**. Leaving the target unset uses the built-in reading module under its current name. Deleted targets require a valid replacement and are never restored automatically. New ordinary modules offer **作品类型：影视／书籍** (Film / Book), defaulting to Film; existing types cannot be converted. Showcases and film modules are excluded.

The same source book is skipped within a target without changing existing notes or manual content. Other modules receive independent notes; manual books without source IDs are not matched by title. Successful and skipped books are deselected; failed books stay selected for retry. Import locks authorization, target and directory changes. Closing Settings allows the import to finish; disabling the plugin or deleting the target stops subsequent writes. The target, shelf and selection last only for this Settings session.

The key is stored only in an independent Obsidian SecretStorage slot, never in plugin settings, card configuration or work notes. Only the official current-shelf endpoint is requested after your click. No automatic sync, highlights, thoughts, reading time, per-book details or article-collection cards are included. Missing summaries and personal ratings stay empty. Audio-series completion is not treated as your reading completion.

## Appearance and settings

Settings are ordered as **Enable module works Dashboard → Card directory → WeRead → Examples → Add cards module → Add image showcase → Existing modules → Note code generator**. Both creation groups, examples, existing modules and advanced settings start collapsed.

Expand **添加卡片模块** (Add cards module) or **添加图片橱窗** (Add image showcase), enter a **module name**, choose its **work type** (ordinary modules only) and **aspect ratio**, optionally select one or more Dashboards or create a new category, then click **保存并收起** (Save and collapse). Each creator keeps its own draft and a fixed storage type; advanced card style offers full cover or minimal without converting the module type. Click the purple stacked-card ribbon icon to experience the module in the **Magical Cards** tab. Settings previews support browsing and sliding only; they cannot flip or start editing sessions.

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

Works are ordinary Markdown notes inside the card directory. Appearance and module order are stored in `_数据/卡片配置.md`. Local plugin configuration stores the directory, first-run progress, module works Dashboard preference, update-dialog read state, and recovery information. Switching directories neither imports examples again nor moves existing works.

**What if the tab turns black after changing an appearance?**

Wait for the save to finish, quit and restart Obsidian, then reopen the same vault. The appearance is saved and works and images are preserved. Saving appearance changes to an existing module also shows this recovery hint.

**Does the plugin use the network or clipboard?**

WeRead import is optional. Only clicking **读取书架** sends a current-shelf request to the official WeRead gateway at `https://i.weread.qq.com/api/agent/gateway`, using the authorization key held in SecretStorage. There is no automatic sync or note upload. Built-in examples work offline. Remote cover URLs, including imported covers, load from their image servers. The plugin does not collect telemetry. The Copy control writes generated code only after you click it. When editing a title, pasting reads only the plain text from that paste event; there is no background clipboard reading. The linked-note picker searches note paths within your vault and does not send note content elsewhere.

<details>
<summary>Upgrading from the previous plugin and recovering drafts</summary>

Existing `barry-cards` blocks, work IDs, `bw_*` properties, views, and recovery drafts remain compatible. Previous directory settings and unknown configuration fields are preserved.

Back up `.obsidian/plugins/barry-cards/` and your card directory, then disable the old plugin and let pending edits finish saving. Install the three new files in `magical-cards`, preserve the old `data.json` and recovery JSON files in the new directory, then enable the new plugin according to the previous enabled state. Do not enable both standalone plugins together.

New versions preserve existing collections, editing and sorting drafts. If a draft cannot be saved during final shutdown, it is written to a recovery JSON file in the plugin directory and its location is shown.

</details>

## 0.9.1 fixes

Fix transparent module deletion confirmations overlapping Settings. The dialog supports separate settings windows, light and dark themes, and narrow panels, including when another plugin loads older styles with the same class name.

## 0.9.0 changes

- **WeRead bookshelf import:** authorize in Settings, load your shelf, search and select ebooks or audio albums, then import into the built-in reading module or an ordinary book module. Existing cards are skipped within a module; other modules can hold independent copies.
- **Independent module works Dashboard:** the portal action before search opens a compact statistics, featured-work and cover-grid page. Search, status filters and temporary sorting are available, and Return restores the source position.
- **Book modules:** choose Film or Book when creating an ordinary module. Film remains the default; existing module types cannot be converted.

See [Releases](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases) for the full release history.

## License and source

From **0.9.0**, author-owned Magical Cards code uses a [proprietary license](LICENSE). Personal and business use is free, and personal backups and private modifications are allowed. Redistributing, rebranding for distribution or selling the plugin or source from this version onward requires the author’s permission. The complete project, tests and build process are maintained in a private source repository. This public repository provides installation, updates, documentation and [issue tracking](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/issues).

Previously published MIT versions retain their original [MIT license](LICENSE-LEGACY-MIT); the new terms do not revoke rights already granted for those versions. Third-party components retain their own licenses in [THIRD_PARTY.md](THIRD_PARTY.md). Covers and previews containing them remain the property of their respective rights holders and are excluded from the author’s code license. Preserve the [cover sources and rights notice](examples/SOURCES.md).

The [example vault](examples/vault/) contains only three books, three films, and independent example IDs. Install the three plugin files and open it with Obsidian. Its card directory is `示例`. The [guide template](examples/Magical_Cards示例及用法说明.md) is used for the first-run experience.
